// SPDX-License-Identifier: Apache-2.0
// Assize — Real Live Midnight Ledger 9 Deployer (Preview & Preprod)
// Deploys Tender A (FINALIZED) and Tender B (CONTESTED) with real ZK proofs via proof-server:9.0.2.

import { WebSocket } from 'ws';
(globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocket;

import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import * as Rx from 'rxjs';
import {
  WalletSeeds,
  WalletFacade,
  ShieldedWallet,
  DustWallet,
  UnshieldedWallet,
  createKeystore,
  PublicKey,
  InMemoryTransactionHistoryStorage,
  WalletEntrySchema,
  mergeWalletEntries,
  DustAddress,
  MidnightBech32m,
} from '@midnightntwrk/wallet-sdk';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import {
  createLedger9MidnightProvider,
  createLedger9WalletProvider,
  type MidnightProviders,
} from '@midnight-ntwrk/midnight-js-types';
import { ZswapSecretKeys, unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/v9';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/v9/compact-js';
import * as runtime from '@midnight-ntwrk/midnight-js-protocol/v9/compact-runtime';
import {
  Contract,
  ExclusionCode,
  Phase,
  ledger as assizeLedger,
  type BidOpening,
  type Witnesses,
} from '../managed/assize/contract/index.js';
import {
  encryptBidOpening,
  generateEphemeralAdjudicatorKeypair,
} from '../../packages/crypto/index.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const MANAGED_DIR = path.join(ROOT, 'contracts', 'managed', 'assize');

type NetworkName = 'preview' | 'preprod';

function parseArgs() {
  const args = process.argv.slice(2);
  let network: NetworkName = (process.env.MIDNIGHT_NETWORK as NetworkName) || 'preview';
  let scenario: 'both' | 'finalized' | 'contested' = 'both';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--network' && args[i + 1]) network = args[++i] as NetworkName;
    if (args[i] === '--scenario' && args[i + 1]) scenario = args[++i] as 'both' | 'finalized' | 'contested';
  }
  return { network, scenario };
}

function getNetworkConfig(network: NetworkName) {
  const proofServer = process.env.MIDNIGHT_PROOF_SERVER_URL?.trim() || 'http://127.0.0.1:6300';
  if (network === 'preview') {
    return {
      networkId: 'preview' as const,
      indexerHttpUrl: 'https://indexer.preview.midnight.network/api/v4/graphql',
      indexerWsUrl: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
      nodeHttpUrl: 'https://rpc.preview.midnight.network',
      nodeWsUrl: 'wss://rpc.preview.midnight.network',
      explorerBaseUrl: 'https://preview.midnightexplorer.com',
      proofServer,
    };
  }
  const projectId = process.env.BLOCKFROST_PROJECT_ID?.trim();
  if (!projectId) throw new Error('BLOCKFROST_PROJECT_ID is required for preprod.');
  const q = `?project_id=${encodeURIComponent(projectId)}`;
  return {
    networkId: 'preprod' as const,
    indexerHttpUrl: `https://midnight-preprod.blockfrost.io/api/v0${q}`,
    indexerWsUrl: `wss://midnight-preprod.blockfrost.io/api/v0/ws${q}`,
    nodeHttpUrl: `https://rpc.midnight-preprod.blockfrost.io${q}`,
    nodeWsUrl: `wss://rpc.midnight-preprod.blockfrost.io${q}`,
    explorerBaseUrl: 'https://preprod.midnightexplorer.com',
    proofServer,
  };
}

const BYTES32 = new runtime.CompactTypeBytes(32);
const VEC2_B32 = new runtime.CompactTypeVector(2, BYTES32);
const VEC3_B32 = new runtime.CompactTypeVector(3, BYTES32);

function pad32(label: string): Uint8Array {
  const out = new Uint8Array(32);
  const enc = new TextEncoder().encode(label);
  out.set(enc.subarray(0, 32), 0);
  return out;
}

function randomBytes32(): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(32));
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b)
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes32(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(32);
  for (let i = 0; i < 32 && i * 2 + 1 < clean.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function hashBidderPubKey(secret: Uint8Array): Uint8Array {
  return runtime.persistentHash(VEC2_B32, [pad32('ASSIZE_BIDDER_PK_V1'), secret]);
}

function hashAdjPubKey(secret: Uint8Array): Uint8Array {
  return runtime.persistentHash(VEC2_B32, [pad32('ASSIZE_ADJ_PK_V1'), secret]);
}

function hashPrequalLeaf(tenderId: Uint8Array, bidderPk: Uint8Array): Uint8Array {
  return runtime.persistentHash(VEC3_B32, [pad32('ASSIZE_PREQUAL_V1'), tenderId, bidderPk]);
}

function hashNullifier(tenderId: Uint8Array, secret: Uint8Array): Uint8Array {
  return runtime.persistentHash(VEC3_B32, [pad32('ASSIZE_NULLIFIER_V1'), tenderId, secret]);
}

function makeEmptyOpening(): BidOpening {
  return {
    nullifier: new Uint8Array(32),
    price: 0n,
    bondAmount: 0n,
    firmIdHash: new Uint8Array(32),
    subListHash: new Uint8Array(32),
    bidDocsHash: new Uint8Array(32),
    bidSalt: new Uint8Array(32),
  };
}

interface AssizePS {
  activeBidderSecret: Uint8Array;
  activePrequalPath: {
    leaf: Uint8Array;
    path: { sibling: { field: bigint }; goes_left: boolean }[];
  };
  activeOpening: BidOpening;
  activeAdjSecret: Uint8Array;
  activeAdjOpenings: BidOpening[];
}

// Mutable witness pointer updated cleanly before each sequential circuit call in our CLI deployer.
let currentPS: AssizePS = {
  activeBidderSecret: new Uint8Array(32),
  activePrequalPath: {
    leaf: new Uint8Array(32),
    path: Array.from({ length: 5 }, () => ({ sibling: { field: 0n }, goes_left: false })),
  },
  activeOpening: makeEmptyOpening(),
  activeAdjSecret: new Uint8Array(32),
  activeAdjOpenings: [makeEmptyOpening(), makeEmptyOpening(), makeEmptyOpening(), makeEmptyOpening()],
};

const witnesses: Witnesses<AssizePS> = {
  bidderSecret: ({ privateState }) => [privateState, currentPS.activeBidderSecret],
  bidderPrequalPath: ({ privateState }) => [privateState, currentPS.activePrequalPath],
  bidderOpening: ({ privateState }) => [privateState, currentPS.activeOpening],
  adjudicatorSecret: ({ privateState }) => [privateState, currentPS.activeAdjSecret],
  adjudicatorOpenings: ({ privateState }) => [privateState, currentPS.activeAdjOpenings],
};

interface TxRecord {
  step: string;
  circuit: string;
  txId: string;
  txHash: string;
  blockHeight: number;
  note: string;
}

interface TenderDeploymentRecord {
  label: string;
  tenderCode: string;
  expectedOutcome: 'FINALIZED' | 'CONTESTED';
  contractAddress: string | null;
  deployedAt: string | null;
  verifiedPhase: string | null;
  verifiedAwardedPriceCents: string | null;
  verifiedZeroLosingPricesOnChain: boolean;
  transactions: TxRecord[];
}

function loadEnvFallback() {
  const envFile = path.join(ROOT, '.env');
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim();
    }
  }
}

async function runTenderScenario(args: {
  providers: MidnightProviders<any, string, AssizePS>;
  compiledContract: any;
  outcome: 'FINALIZED' | 'CONTESTED';
  tenderCode: string;
  label: string;
  onUpdate: (rec: TenderDeploymentRecord) => void;
}): Promise<TenderDeploymentRecord> {
  const { providers, compiledContract, outcome, tenderCode, label, onUpdate } = args;
  const tenderId = randomBytes32();
  const adjSecret = randomBytes32();
  const adjPubKey = hashAdjPubKey(adjSecret);
  const adjKeypair = await generateEphemeralAdjudicatorKeypair();

  const defs = [
    { slot: 0, name: 'Pacific Concrete Corp.', licenseNo: 'CA-A-849201', priceCents: 94_000_000n },
    { slot: 1, name: 'Sierra Structural LLC', licenseNo: 'CA-A-912450', priceCents: 88_500_000n },
    { slot: 2, name: 'Redwood Civil Works', licenseNo: 'CA-A-771309', priceCents: 104_000_000n },
    { slot: 3, name: 'Valley Heavy Builders', licenseNo: 'CA-A-658912', priceCents: 126_000_000n },
  ];

  const contractors = defs.map((d) => {
    const secret = randomBytes32();
    const pubKey = hashBidderPubKey(secret);
    const bondCents = (d.priceCents * 1000n) / 10000n + 50_000n;
    const firmIdHash = pad32(`FIRM:${d.licenseNo}`);
    const subListHash = pad32(`PCC4101_SUBS:${d.licenseNo}`);
    const bidDocsHash = pad32(`BOQ_SEAL:${d.licenseNo}`);
    const opening: BidOpening = {
      nullifier: hashNullifier(tenderId, secret),
      price: d.priceCents,
      bondAmount: bondCents,
      firmIdHash,
      subListHash,
      bidDocsHash,
      bidSalt: randomBytes32(),
    };
    return { ...d, secret, pubKey, firmIdHash, subListHash, bidDocsHash, opening };
  });

  let tree = new runtime.StateBoundedMerkleTree(5);
  const leaves = contractors.map((c) => hashPrequalLeaf(tenderId, c.pubKey));
  for (let i = 0; i < leaves.length; i++) {
    tree = tree.update(BigInt(i), { value: BYTES32.toValue(leaves[i]), alignment: BYTES32.alignment() });
  }
  tree = tree.rehash();
  const rootAligned = tree.root()!;
  const prequalRoot = runtime.CompactTypeMerkleTreeDigest.fromValue([...rootAligned.value]);
  const pathType = new runtime.CompactTypeMerkleTreePath(5, BYTES32);
  const prequalPaths = leaves.map((leaf, i) => {
    const mp = tree.pathForLeaf(BigInt(i), { value: BYTES32.toValue(leaf), alignment: BYTES32.alignment() });
    const decoded = pathType.fromValue([...mp.value]);
    return { leaf: decoded.leaf, path: decoded.path };
  });

  currentPS = {
    activeBidderSecret: new Uint8Array(32),
    activePrequalPath: prequalPaths[0],
    activeOpening: makeEmptyOpening(),
    activeAdjSecret: adjSecret,
    activeAdjOpenings: contractors.map((c) => c.opening),
  };

  const record: TenderDeploymentRecord = {
    label,
    tenderCode,
    expectedOutcome: outcome,
    contractAddress: null,
    deployedAt: null,
    verifiedPhase: null,
    verifiedAwardedPriceCents: null,
    verifiedZeroLosingPricesOnChain: false,
    transactions: [],
  };

  console.log(`\n=============================================================`);
  console.log(`Deploying ${label} (${tenderCode})...`);
  console.log(`=============================================================`);

  const deployed: any = await deployContract(providers as any, {
    compiledContract,
    privateStateId: `assize-${tenderCode}-${Date.now()}`,
    initialPrivateState: currentPS,
    args: [
      tenderId,
      adjPubKey,
      hexToBytes32(adjKeypair.publicKeyFingerprintHex),
      prequalRoot,
      pad32(`ROSTER_${tenderCode}`),
      pad32('CA_PCC_20128_LOWEST_RESP'),
      120_000_000n,
      1000n,
    ],
  } as any);

  const contractAddress: string = deployed.deployTxData.public.contractAddress;
  record.contractAddress = contractAddress;
  record.deployedAt = new Date().toISOString();
  record.transactions.push({
    step: '0. Deploy Tender',
    circuit: 'constructor',
    txId: String(deployed.deployTxData.public.txId ?? ''),
    txHash: String(deployed.deployTxData.public.txHash ?? ''),
    blockHeight: Number(deployed.deployTxData.public.blockHeight ?? 0),
    note: `Deployed Assize contract (${tenderCode}, budget cap $1,200,000, 10% surety bond)`,
  });
  onUpdate(record);
  console.log(`  [DEPLOYED] address=${contractAddress} block=${record.transactions[0].blockHeight} txHash=${record.transactions[0].txHash}`);

  // 1. Seal all 4 bids
  for (const c of contractors) {
    currentPS.activeBidderSecret = c.secret;
    currentPS.activePrequalPath = prequalPaths[c.slot];
    currentPS.activeOpening = c.opening;
    console.log(`  -> Proving & submitting submitSealedBid (Slot #${c.slot})...`);
    const tx = await deployed.callTx.submitSealedBid();
    record.transactions.push({
      step: `1.${c.slot + 1} Seal Bid Slot #${c.slot}`,
      circuit: 'submitSealedBid',
      txId: String(tx.public.txId ?? ''),
      txHash: String(tx.public.txHash ?? ''),
      blockHeight: Number(tx.public.blockHeight ?? 0),
      note: `Slot #${c.slot} commitment anchored (Merkle membership + 10% bond proven in ZK)`,
    });
    onUpdate(record);
    console.log(`     [OK] block=${tx.public.blockHeight} txHash=${tx.public.txHash}`);
  }

  // 2. Freeze bidding root
  console.log(`  -> Proving & submitting closeBidding...`);
  const closeBidTx = await deployed.callTx.closeBidding();
  record.transactions.push({
    step: '2. Freeze Bidding Root',
    circuit: 'closeBidding',
    txId: String(closeBidTx.public.txId ?? ''),
    txHash: String(closeBidTx.public.txHash ?? ''),
    blockHeight: Number(closeBidTx.public.blockHeight ?? 0),
    note: 'OPEN -> REVEAL (frozenBidCount=4 & frozenCommitRoot locked)',
  });
  onUpdate(record);
  console.log(`     [OK] block=${closeBidTx.public.blockHeight} txHash=${closeBidTx.public.txHash}`);

  // 3. Deliver 4 encrypted openings (WebCrypto off-chain + sha256 receipt on-chain)
  for (const c of contractors) {
    const env = await encryptBidOpening(bytesToHex(tenderId), c.slot, adjKeypair.publicKeySpkiB64, {
      nullifierHex: bytesToHex(c.opening.nullifier),
      price: c.opening.price.toString(),
      bondAmount: c.opening.bondAmount.toString(),
      firmIdHashHex: bytesToHex(c.opening.firmIdHash),
      subListHashHex: bytesToHex(c.opening.subListHash),
      bidDocsHashHex: bytesToHex(c.opening.bidDocsHash),
      bidSaltHex: bytesToHex(c.opening.bidSalt),
      firmName: c.name,
    });
    currentPS.activeBidderSecret = c.secret;
    currentPS.activeOpening = c.opening;
    console.log(`  -> Proving & submitting deliverOpening (Slot #${c.slot})...`);
    const tx = await deployed.callTx.deliverOpening(BigInt(c.slot), hexToBytes32(env.envelopeHashHex));
    record.transactions.push({
      step: `3.${c.slot + 1} Deliver Opening Receipt Slot #${c.slot}`,
      circuit: 'deliverOpening',
      txId: String(tx.public.txId ?? ''),
      txHash: String(tx.public.txHash ?? ''),
      blockHeight: Number(tx.public.blockHeight ?? 0),
      note: `Slot #${c.slot} WebCrypto envelope encrypted off-chain; sha256 receipt anchored on-chain`,
    });
    onUpdate(record);
    console.log(`     [OK] block=${tx.public.blockHeight} txHash=${tx.public.txHash}`);
  }

  // 4. Close reveal window
  console.log(`  -> Proving & submitting closeReveal...`);
  const closeRevTx = await deployed.callTx.closeReveal();
  record.transactions.push({
    step: '4. Lock Reveal Window',
    circuit: 'closeReveal',
    txId: String(closeRevTx.public.txId ?? ''),
    txHash: String(closeRevTx.public.txHash ?? ''),
    blockHeight: Number(closeRevTx.public.blockHeight ?? 0),
    note: 'REVEAL -> EVALUATION barrier locked',
  });
  onUpdate(record);
  console.log(`     [OK] block=${closeRevTx.public.blockHeight} txHash=${closeRevTx.public.txHash}`);

  // 5. Prove Award + Final Step (FINALIZED vs CONTESTED)
  currentPS.activeAdjSecret = adjSecret;
  currentPS.activeAdjOpenings = contractors.map((c) => c.opening);

  if (outcome === 'FINALIZED') {
    console.log(`  -> Proving & submitting proveAward (Honest Award: Slot #1 $885,000)...`);
    const awardTx = await deployed.callTx.proveAward(
      true,
      1n,
      88_500_000n,
      contractors[1].firmIdHash,
      contractors[1].subListHash,
      [ExclusionCode.NONE, ExclusionCode.NONE, ExclusionCode.NONE, ExclusionCode.OVER_BUDGET],
      [pad32(''), pad32(''), pad32(''), pad32('EXCEEDS_1_2M_CAP')]
    );
    record.transactions.push({
      step: '5. Prove Honest Complete-Set Award',
      circuit: 'proveAward',
      txId: String(awardTx.public.txId ?? ''),
      txHash: String(awardTx.public.txHash ?? ''),
      blockHeight: Number(awardTx.public.blockHeight ?? 0),
      note: 'Slot #1 ($885,000) proven lowest compliant bidder; Slot #3 proved OVER_BUDGET',
    });
    onUpdate(record);
    console.log(`     [OK] block=${awardTx.public.blockHeight} txHash=${awardTx.public.txHash}`);

    console.log(`  -> Proving & submitting finalizeAward...`);
    const finTx = await deployed.callTx.finalizeAward();
    record.transactions.push({
      step: '6. Finalize Uncontested Award',
      circuit: 'finalizeAward',
      txId: String(finTx.public.txId ?? ''),
      txHash: String(finTx.public.txHash ?? ''),
      blockHeight: Number(finTx.public.blockHeight ?? 0),
      note: 'AWARDED -> FINALIZED permanently on-chain',
    });
    onUpdate(record);
    console.log(`     [OK] block=${finTx.public.blockHeight} txHash=${finTx.public.txHash}`);
  } else {
    console.log(`  -> Proving & submitting proveAward (Pretextual NOT_RESPONSIBLE on Slot #1 -> $940k wins)...`);
    const awardTx = await deployed.callTx.proveAward(
      true,
      0n,
      94_000_000n,
      contractors[0].firmIdHash,
      contractors[0].subListHash,
      [ExclusionCode.NONE, ExclusionCode.NOT_RESPONSIBLE, ExclusionCode.NONE, ExclusionCode.OVER_BUDGET],
      [pad32(''), pad32('DISQUAL_MEMO_SLOT1_SHA256'), pad32(''), pad32('EXCEEDS_1_2M_CAP')]
    );
    record.transactions.push({
      step: '5. Prove Award with Pretextual Exclusion',
      circuit: 'proveAward',
      txId: String(awardTx.public.txId ?? ''),
      txHash: String(awardTx.public.txHash ?? ''),
      blockHeight: Number(awardTx.public.blockHeight ?? 0),
      note: 'Slot #1 marked NOT_RESPONSIBLE with public evidenceHash; Slot #0 awarded $940,000',
    });
    onUpdate(record);
    console.log(`     [OK] block=${awardTx.public.blockHeight} txHash=${awardTx.public.txHash}`);

    currentPS.activeBidderSecret = contractors[1].secret;
    currentPS.activeOpening = contractors[1].opening;
    console.log(`  -> Proving & submitting challengeAward (Slot #1 ZK Protest, $885k stays sealed!)...`);
    const protestTx = await deployed.callTx.challengeAward(1n);
    record.transactions.push({
      step: '6. File ZK Protest (Slot #1, Price Hidden)',
      circuit: 'challengeAward',
      txId: String(protestTx.public.txId ?? ''),
      txHash: String(protestTx.public.txHash ?? ''),
      blockHeight: Number(protestTx.public.blockHeight ?? 0),
      note: 'Slot #1 proved myPrice < $940,000 in ZK WITHOUT disclosing $885,000 -> CONTESTED',
    });
    onUpdate(record);
    console.log(`     [OK] block=${protestTx.public.blockHeight} txHash=${protestTx.public.txHash}`);
  }

  // Verify live on-chain decoded ledger state + zero losing-price leakage
  const queried = await providers.publicDataProvider.queryContractState(contractAddress);
  if (queried) {
    const decodedState = queried.contractState.deserialize({ v9: runtime.ContractState });
    const rawHex = Buffer.from(decodedState.serialize()).toString('hex');
    const l = assizeLedger(decodedState.data);
    record.verifiedPhase = Phase[l.phase];
    record.verifiedAwardedPriceCents = l.awardedPrice.toString();
    // Verify losing prices (88_500_000 in CONTESTED, 94_000_000 in FINALIZED, 104_000_000, 126_000_000) are absent from raw bytes
    const losingPrices =
      outcome === 'FINALIZED' ? [94_000_000n, 104_000_000n, 126_000_000n] : [88_500_000n, 104_000_000n, 126_000_000n];
    const leaked = losingPrices.some((p) => {
      const leHex = Buffer.alloc(8);
      leHex.writeBigUInt64LE(p);
      return rawHex.includes(leHex.subarray(0, 4).toString('hex'));
    });
    record.verifiedZeroLosingPricesOnChain = !leaked;
    console.log(
      `  [VERIFIED ON-CHAIN] phase=${record.verifiedPhase} awardedPrice=${record.verifiedAwardedPriceCents} zeroLosingPricesLeaked=${record.verifiedZeroLosingPricesOnChain}`
    );
    onUpdate(record);
  }

  return record;
}

async function main() {
  loadEnvFallback();
  const { network, scenario } = parseArgs();
  const cfg = getNetworkConfig(network);
  const seedHex = (process.env.WALLET_SEED || process.env.MIDNIGHT_SEED || '').trim();
  const password = (process.env.PRIVATE_STATE_PASSWORD || 'AssizeWave3PrivateState!2026').trim();

  if (!seedHex) {
    throw new Error('Set WALLET_SEED (64+ hex chars) in .env or environment.');
  }

  console.log(`=== Assize Live Deployment (${network.toUpperCase()} · Ledger 9) ===`);
  const psRes = await fetch(`${cfg.proofServer}/health`, { signal: AbortSignal.timeout(5000) });
  if (!psRes.ok) throw new Error(`Proof server unhealthy at ${cfg.proofServer}: HTTP ${psRes.status}`);
  console.log(`Proof Server (${cfg.proofServer}): ONLINE`);

  const seeds = WalletSeeds.fromMasterSeed(Buffer.from(seedHex, 'hex'));
  const unshieldedKeystore = createKeystore({ kind: 'schnorr', secret: seeds.unshielded }, cfg.networkId);
  const unshieldedAddr = String(unshieldedKeystore.getBech32Address());
  const zswapKeys = ZswapSecretKeys.fromSeed(seeds.shielded);
  console.log(`Deployer Unshielded Address: ${unshieldedAddr}`);

  const wallet = await WalletFacade.init({
    configuration: {
      networkId: cfg.networkId,
      indexerClientConnection: {
        indexerHttpUrl: cfg.indexerHttpUrl,
        indexerWsUrl: cfg.indexerWsUrl,
      },
      provingServerUrl: new URL(cfg.proofServer),
      relayURL: new URL(cfg.nodeWsUrl),
      txHistoryStorage: new InMemoryTransactionHistoryStorage(WalletEntrySchema, mergeWalletEntries),
      costParameters: {
        additionalFeeOverhead: 300_000_000_000_000n,
        feeBlocksMargin: 5,
      },
    },
    shielded: (c) => ShieldedWallet(c).startWithSeed(seeds.shielded),
    unshielded: (c) => UnshieldedWallet(c).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
    dust: (c) => DustWallet(c).startWithSeed(seeds.dust),
  });
  await wallet.start(seeds);

  console.log('Syncing wallet with Midnight network...');
  let state = await wallet.waitForSyncedState();
  const nightRaw = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
  console.log(`Synced! tNIGHT (STAR): ${nightRaw} | DUST (SPECK): ${state.dust.balance(new Date())}`);

  if (nightRaw === 0n && state.dust.balance(new Date()) === 0n) {
    await wallet.stop();
    throw new Error(
      `Wallet ${unshieldedAddr} has 0 tNIGHT and 0 DUST. Fund it via the ${network} faucet first!`
    );
  }

  const unregistered = state.unshielded.availableCoins.filter(
    (coin: any) => coin.meta?.registeredForDustGeneration !== true
  );
  if (unregistered.length > 0) {
    console.log(`Registering ${unregistered.length} NIGHT UTXO(s) for DUST generation...`);
    const target = String(DustAddress.encodePublicKey(cfg.networkId, state.dust.publicKey));
    const dustReceiver = MidnightBech32m.parse(target).decode(DustAddress, cfg.networkId);
    const { fee } = await wallet.estimateRegistration(unregistered);
    await wallet.waitForGeneratedDust(unregistered, fee);
    const recipe = await wallet.registerNightUtxosForDustGeneration(
      unregistered,
      unshieldedKeystore.getPublicKey(),
      async (payload: Uint8Array) => unshieldedKeystore.signData(payload),
      dustReceiver
    );
    const finalized = await wallet.finalizeRecipe(recipe);
    const regTxId = await wallet.submitTransaction(finalized);
    console.log(`Submitted DUST registration tx: ${regTxId}. Waiting for spendable DUST...`);
  }

  state = await Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.filter((s) => s.isSynced),
      Rx.filter((s) => s.dust.balance(new Date()) > 0n)
    )
  );
  console.log(`Spendable DUST ready: ${state.dust.balance(new Date())} SPECK`);

  const zkConfigProvider = new NodeZkConfigProvider(MANAGED_DIR);
  const walletProvider = createLedger9WalletProvider({
    getCoinPublicKey: () => zswapKeys.coinPublicKey,
    getEncryptionPublicKey: () => zswapKeys.encryptionPublicKey,
    balanceTx: async (tx, ttl) => {
      const handle = wallet.adoptTransaction(tx.serialize(), 'Unbound');
      const recipe = await wallet.balanceUnboundTransaction(handle, {
        ttl: ttl ?? new Date(Date.now() + 3600 * 1000),
      });
      const finalized = await wallet.finalizeRecipe(recipe);
      return finalized.serialize();
    },
  });

  const midnightProvider = createLedger9MidnightProvider(async (tx) => {
    const handle = wallet.adoptTransaction(tx.serialize(), 'Finalized');
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await wallet.submitTransaction(handle);
      } catch (err) {
        if (attempt >= 3) throw err;
        console.warn(`submitTransaction attempt ${attempt} failed; retrying in 3s...`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    throw new Error('submitTransaction exhausted retries');
  });

  const providers: MidnightProviders<any, string, AssizePS> = {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: `assize-ps-${network}`,
      signingKeyStoreName: `assize-sk-${network}`,
      privateStoragePasswordProvider: () => password,
      accountId: unshieldedAddr,
    }),
    publicDataProvider: indexerPublicDataProvider(cfg.indexerHttpUrl, cfg.indexerWsUrl),
    zkConfigProvider,
    proofProvider: httpClientProofProvider({ url: cfg.proofServer, zkConfigProvider }),
    walletProvider,
    midnightProvider,
    config: {
      networkId: cfg.networkId,
      ttlSeconds: 3600,
    },
  };

  const compiledContract = CompiledContract.make('assize', Contract as any).pipe(
    CompiledContract.withWitnesses(witnesses as any),
    CompiledContract.withCompiledFileAssets(MANAGED_DIR)
  );

  const manifestPath = path.join(ROOT, 'deployments', `${network}.json`);
  const deployments: TenderDeploymentRecord[] = [];
  const persistManifest = () => {
    const cleanIndexer = cfg.indexerHttpUrl.split('?')[0];
    const cleanWs = cfg.indexerWsUrl.split('?')[0];
    const cleanRpc = cfg.nodeHttpUrl.split('?')[0];
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          schema: 'ASSIZE-DEPLOYMENT-MANIFEST-V1',
          network,
          compactVersion: '0.36.1',
          runtimeVersion: '0.21.0',
          midnightJsVersion: '5.0.1',
          proofServerVersion: '9.0.2',
          explorerBaseUrl: cfg.explorerBaseUrl,
          endpoints: {
            indexerGraphql: cleanIndexer,
            indexerWs: cleanWs,
            nodeRpc: cleanRpc,
          },
          status: deployments.every((d) => d.verifiedPhase !== null) ? 'LIVE_VERIFIED' : 'IN_PROGRESS',
          updatedAt: new Date().toISOString(),
          deployments,
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
  };

  if (scenario === 'both' || scenario === 'finalized') {
    const idx = deployments.length;
    deployments.push({
      label: 'Tender A — Clean Fair Award (FINALIZED)',
      tenderCode: 'PW-2026-041-A',
      expectedOutcome: 'FINALIZED',
      contractAddress: null,
      deployedAt: null,
      verifiedPhase: null,
      verifiedAwardedPriceCents: null,
      verifiedZeroLosingPricesOnChain: false,
      transactions: [],
    });
    await runTenderScenario({
      providers,
      compiledContract,
      outcome: 'FINALIZED',
      tenderCode: 'PW-2026-041-A',
      label: 'Tender A — Clean Fair Award (FINALIZED)',
      onUpdate: (rec) => {
        deployments[idx] = rec;
        persistManifest();
      },
    });
  }

  if (scenario === 'both' || scenario === 'contested') {
    const idx = deployments.length;
    deployments.push({
      label: 'Tender B — Pretextual Exclusion Caught (CONTESTED)',
      tenderCode: 'PW-2026-041-B',
      expectedOutcome: 'CONTESTED',
      contractAddress: null,
      deployedAt: null,
      verifiedPhase: null,
      verifiedAwardedPriceCents: null,
      verifiedZeroLosingPricesOnChain: false,
      transactions: [],
    });
    await runTenderScenario({
      providers,
      compiledContract,
      outcome: 'CONTESTED',
      tenderCode: 'PW-2026-041-B',
      label: 'Tender B — Pretextual Exclusion Caught (CONTESTED)',
      onUpdate: (rec) => {
        deployments[idx] = rec;
        persistManifest();
      },
    });
  }

  await wallet.stop();
  console.log(`\nDONE! Wrote verified live manifest to ${manifestPath}`);
}

main().catch((err) => {
  console.error('LIVE DEPLOY FAILED:', err);
  process.exit(1);
});
