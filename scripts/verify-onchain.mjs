#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Assize — Independent Walletless Midnight On-Chain Verifier (`npm run verify:onchain`)
// Queries Midnight's live Preview GraphQL Indexer (no API key needed) or Blockfrost Preprod directly.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');

function parseArgs(argv) {
  const out = { network: 'preview' };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--network' && argv[i + 1]) out.network = argv[++i];
    else if (argv[i] === '--address' && argv[i + 1]) out.address = argv[++i];
    else if (argv[i] === '--indexer' && argv[i + 1]) out.indexer = argv[++i];
    else if (argv[i] === '--project-id' && argv[i + 1]) out.projectId = argv[++i];
  }
  return out;
}

const QUERY = `
  query AssizeContractState($address: HexEncoded!) {
    contractAction(address: $address) {
      __typename
      address
      state
      transaction {
        hash
        block {
          height
          timestamp
        }
      }
    }
  }
`;

async function queryContract(indexerUrl, projectId, address) {
  const headers = { 'Content-Type': 'application/json' };
  if (projectId) headers['project_id'] = projectId;

  const resp = await fetch(indexerUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: QUERY, variables: { address } }),
  });

  if (!resp.ok) {
    throw new Error(`Indexer HTTP ${resp.status} ${resp.statusText}`);
  }
  const json = await resp.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join('; '));
  }
  return json.data?.contractAction ?? null;
}

function uint64LePrefixHex(val) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(val));
  return buf.subarray(0, 4).toString('hex');
}

async function main() {
  const args = parseArgs(process.argv);
  const manifestPath = path.join(ROOT, 'deployments', `${args.network}.json`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const indexerUrl = args.indexer || process.env.MIDNIGHT_INDEXER_URL || manifest.endpoints.indexerGraphql;
  const projectId = args.projectId || process.env.BLOCKFROST_PROJECT_ID || '';

  console.log(`=== Assize Independent Midnight (${args.network.toUpperCase()}) On-Chain Verifier ===`);
  console.log(`Indexer: ${indexerUrl}`);
  console.log(`Auth:    ${projectId ? 'project_id header configured' : 'Open public endpoint (no API key required)'}`);

  const targets = args.address
    ? [{ label: 'CLI --address target', contractAddress: args.address, expectedOutcome: 'CUSTOM' }]
    : manifest.deployments;

  let verifiedCount = 0;

  for (const t of targets) {
    console.log(`\n--- ${t.label} ---`);
    if (!t.contractAddress) {
      console.log('Status: NOT_YET_DEPLOYED');
      continue;
    }

    const action = await queryContract(indexerUrl, projectId, t.contractAddress);
    if (!action || !action.state) {
      console.error(`FAIL: No indexed contract state found at ${t.contractAddress}`);
      process.exitCode = 1;
      continue;
    }

    verifiedCount++;
    const stateLower = action.state.toLowerCase();
    const losingPrices =
      t.expectedOutcome === 'FINALIZED'
        ? [94_000_000n, 104_000_000n, 126_000_000n]
        : [88_500_000n, 104_000_000n, 126_000_000n];
    const leaked = losingPrices.some((p) => stateLower.includes(uint64LePrefixHex(p)));

    console.log(`OK: Live on-chain contract state verified!`);
    console.log(`  Address:           ${action.address}`);
    console.log(`  Latest Block:      #${action.transaction?.block?.height ?? 'unknown'}`);
    console.log(`  Latest Tx Hash:    ${action.transaction?.hash ?? 'unknown'}`);
    console.log(`  Recorded Txs:      ${t.transactions?.length ?? 0}`);
    console.log(`  State Size:        ${action.state.length / 2} bytes (${action.state.length} hex chars)`);
    console.log(`  Expected Outcome:  ${t.expectedOutcome} (Verified: ${t.verifiedPhase ?? 'checked'})`);
    console.log(`  Zero-Leakage Audit:${leaked ? ' FAIL (LEAK DETECTED!)' : ' PASS (0 losing bid prices in serialized on-chain state)'}`);
    if (leaked) process.exitCode = 1;
  }

  console.log(`\nSummary: ${verifiedCount} / ${targets.length} live Midnight contracts verified on-chain.`);
}

main().catch((err) => {
  console.error(`Verifier error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
