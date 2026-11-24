#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Assize — Real Midnight Preprod Deployment Preflight & Runner
// Strictly refuses to fabricate addresses or mock deployments if live credentials or proof-server are absent.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const KEYS_DIR = path.join(ROOT, 'contracts', 'managed', 'assize', 'keys');
const ZKIR_DIR = path.join(ROOT, 'contracts', 'managed', 'assize', 'zkir');

async function checkProofServer(url) {
  try {
    const resp = await fetch(`${url.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(4000) });
    return { reachable: resp.ok || resp.status < 500, status: resp.status };
  } catch (err) {
    return { reachable: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  const projectId = process.env.BLOCKFROST_PROJECT_ID?.trim();
  const seed = process.env.MIDNIGHT_SEED?.trim();
  const proofServerUrl = process.env.MIDNIGHT_PROOF_SERVER_URL?.trim() || 'http://127.0.0.1:6300';

  console.log('=== Assize Midnight Preprod Deployment Preflight ===');

  const keys = fs.existsSync(KEYS_DIR) ? fs.readdirSync(KEYS_DIR) : [];
  const zkirs = fs.existsSync(ZKIR_DIR) ? fs.readdirSync(ZKIR_DIR) : [];
  console.log(`Compiled Artifacts: ${zkirs.length} ZKIR circuits, ${keys.length} prover/verifier keys`);

  if (zkirs.length < 8 || keys.length < 16) {
    console.error('FAIL: Missing compiled Compact 0.36.1 ZKIR or prover/verifier keys in contracts/managed/assize/.');
    process.exit(1);
  }

  const missing = [];
  if (!projectId) missing.push('BLOCKFROST_PROJECT_ID (Midnight Preprod Blockfrost token)');
  if (!seed) missing.push('MIDNIGHT_SEED (64-hex Preprod wallet seed funded with tNIGHT -> DUST)');

  const ps = await checkProofServer(proofServerUrl);
  console.log(`Proof Server (${proofServerUrl}): ${ps.reachable ? `ONLINE (HTTP ${ps.status})` : `OFFLINE (${ps.error})`}`);

  if (missing.length > 0 || !ps.reachable) {
    console.error('\nDeployment cannot proceed without live Preprod infrastructure:');
    for (const m of missing) console.error(`  - Missing env var: ${m}`);
    if (!ps.reachable) {
      console.error(`  - Proof server not reachable at ${proofServerUrl}.`);
      console.error('    Start locally: docker run -p 6300:6300 midnightntwrk/proof-server:latest -- midnight-proof-server --network preprod');
      console.error('    Or trigger `.github/workflows/deploy-preprod.yml` in GitHub Actions.');
    }
    process.exit(1);
  }

  console.log('\nPreflight passed! Live Midnight Preprod deployment environment is ready.');
  console.log('Target Endpoints:');
  console.log('  Indexer: https://midnight-preprod.blockfrost.io/api/v0');
  console.log('  Node:    https://rpc.midnight-preprod.blockfrost.io');
  console.log('  Prover: ', proofServerUrl);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
