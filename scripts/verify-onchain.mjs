#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Assize — Independent Walletless Midnight Preprod On-Chain Verifier (`npm run verify:onchain`)
// Queries Blockfrost's Midnight Preprod GraphQL Indexer directly with zero trust in the frontend.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'deployments', 'preprod.json');

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--address' && argv[i + 1]) out.address = argv[++i];
    else if (argv[i] === '--indexer' && argv[i + 1]) out.indexer = argv[++i];
    else if (argv[i] === '--project-id' && argv[i + 1]) out.projectId = argv[++i];
    else if (argv[i] === '--check-forbidden-hex' && argv[i + 1]) out.forbiddenHex = argv[++i];
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

async function main() {
  const args = parseArgs(process.argv);
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const indexerUrl = args.indexer || process.env.MIDNIGHT_INDEXER_URL || manifest.endpoints.indexerGraphql;
  const projectId = args.projectId || process.env.BLOCKFROST_PROJECT_ID || '';

  console.log('=== Assize Independent Midnight Preprod Verifier ===');
  console.log(`Indexer: ${indexerUrl}`);
  console.log(`Auth:    ${projectId ? 'project_id header configured' : 'MISSING (set BLOCKFROST_PROJECT_ID for Blockfrost Preprod)'}`);

  const targets = args.address
    ? [{ label: 'CLI --address target', contractAddress: args.address, expectedOutcome: 'CUSTOM' }]
    : manifest.deployments;

  let verifiedCount = 0;
  let pendingCount = 0;

  for (const t of targets) {
    console.log(`\n--- ${t.label} ---`);
    if (!t.contractAddress) {
      pendingCount++;
      console.log('Status: AWAITING_FUNDED_PREPROD_DEPLOYMENT (contractAddress is null in deployments/preprod.json)');
      console.log('Action: Run `npm run deploy:preprod` or pass `--address <hex>` with BLOCKFROST_PROJECT_ID.');
      continue;
    }

    const action = await queryContract(indexerUrl, projectId, t.contractAddress);
    if (!action || !action.state) {
      console.error(`FAIL: No indexed contract state found at ${t.contractAddress}`);
      process.exitCode = 1;
      continue;
    }

    verifiedCount++;
    console.log(`OK: Indexed contract state verified`);
    console.log(`  Address:      ${action.address}`);
    console.log(`  Block Height: ${action.transaction?.block?.height ?? 'unknown'}`);
    console.log(`  Tx Hash:      ${action.transaction?.hash ?? 'unknown'}`);
    console.log(`  State Size:   ${action.state.length / 2} bytes (${action.state.length} hex chars)`);

    if (args.forbiddenHex) {
      const cleanForbidden = args.forbiddenHex.toLowerCase().replace(/^0x/, '');
      if (action.state.toLowerCase().includes(cleanForbidden)) {
        console.error(`FAIL: Forbidden secret byte sequence found in on-chain state!`);
        process.exitCode = 1;
      } else {
        console.log(`  Zero-Leakage: PASS (forbidden sequence absent from serialized on-chain state)`);
      }
    }
  }

  console.log(`\nSummary: ${verifiedCount} verified on-chain, ${pendingCount} awaiting funded deployment.`);
}

main().catch((err) => {
  console.error(`Verifier error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
