// SPDX-License-Identifier: Apache-2.0
// Assize — Real Compiled Compact 0.36.1 Browser Engine + Real WebCrypto E2E Envelopes
// Executes the actual compiled assize.compact circuits locally (unproven; clearly labeled).

import * as runtime from '@midnight-ntwrk/compact-runtime';
import {
  Contract,
  ExclusionCode,
  Phase,
  ledger,
  type BidOpening,
  type Ledger,
  type Witnesses,
} from '@assize/contract';
import {
  decryptBidOpening,
  encryptBidOpening,
  generateEphemeralAdjudicatorKeypair,
  type EncryptedBidEnvelope,
  type EphemeralAdjudicatorKeypair,
} from '@assize/crypto';

export { ExclusionCode, Phase };

const BYTES32 = new runtime.CompactTypeBytes(32);
const VEC2_B32 = new runtime.CompactTypeVector(2, BYTES32);
const VEC3_B32 = new runtime.CompactTypeVector(3, BYTES32);

export function pad32(label: string): Uint8Array {
  const out = new Uint8Array(32);
  const enc = new TextEncoder().encode(label);
  out.set(enc.subarray(0, 32), 0);
  return out;
}

export function randomBytes32(): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(32));
}

export function bytesToHex(b: Uint8Array): string {
  return Array.from(b)
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes32(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(32);
  for (let i = 0; i < 32 && i * 2 + 1 < clean.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function shortHex(hex: string, n = 8): string {
  if (!hex || /^0+$/.test(hex)) return '—';
  return `0x${hex.slice(0, n)}…${hex.slice(-6)}`;
}

export function formatUsdFromCents(cents: bigint): string {
  const dollars = Number(cents) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(dollars);
}

export interface DemoContractor {
  slot: number;
  name: string;
  licenseNo: string;
  roleLabel: string;
  priceCents: bigint;
  bondCents: bigint;
  secret: Uint8Array;
  pubKey: Uint8Array;
  firmIdHash: Uint8Array;
  subListHash: Uint8Array;
  bidDocsHash: Uint8Array;
  opening: BidOpening;
  envelope?: EncryptedBidEnvelope;
  committed: boolean;
  receiptDelivered: boolean;
}

export interface LedgerSnapshot {
  tenderId: string;
  adjudicatorPubKey: string;
  adjudicatorEncPubKey: string;
  prequalRoot: string;
  prequalRosterHash: string;
  selectionRuleHash: string;
  maxAwardBudget: bigint;
  minBondBps: bigint;
  phase: Phase;
  bidCount: number;
  rollingCommitRoot: string;
  frozenBidCount: number;
  frozenCommitRoot: string;
  bidCommitments: string[];
  usedNullifiers: string[];
  openingReceipts: string[];
  deliveredFlags: boolean[];
  hasWinner: boolean;
  winningSlot: number;
  awardedPrice: bigint;
  winnerCommitment: string;
  winnerFirmIdHash: string;
  winnerSubListHash: string;
  exclusionCodes: ExclusionCode[];
  exclusionEvidence: string[];
  nonRevealCount: number;
  challengerSlot: number;
  challengerCommitment: string;
}

export interface ActionLogEntry {
  id: number;
  circuit: string;
  status: 'OK' | 'REJECTED';
  detail: string;
  elapsedMs: number;
  changedFields: string[];
  timestamp: string;
}

interface PS {
  activeBidderSecret: Uint8Array;
  activePrequalPath: {
    leaf: Uint8Array;
    path: { sibling: { field: bigint }; goes_left: boolean }[];
  };
  activeOpening: BidOpening;
  activeAdjSecret: Uint8Array;
  activeAdjOpenings: BidOpening[];
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

export class AssizeBrowserSession {
  readonly tenderCode = 'PW-2026-041';
  readonly tenderTitle = 'Civic Bridge Deck Rehabilitation — Phase II';
  readonly agencyName = 'County Department of Public Works';
  readonly statutoryBasis = 'CA PCC § 20128 (Lowest Responsible Bidder) · § 4101 (Subcontractor Listing)';

  readonly tenderId: Uint8Array;
  readonly adjSecret: Uint8Array;
  readonly adjKeypair: EphemeralAdjudicatorKeypair;
  readonly contractors: DemoContractor[];

  private readonly contract: Contract<PS>;
  private readonly contractAddress: string;
  private readonly coinPublicKey: string;
  private readonly prequalPaths: Map<number, PS['activePrequalPath']>;
  private contractState: runtime.ContractState;
  private privateState: PS;
  private logSeq = 0;

  logs: ActionLogEntry[] = [];
  lastChangedFields: string[] = [];

  private constructor(args: {
    tenderId: Uint8Array;
    adjSecret: Uint8Array;
    adjKeypair: EphemeralAdjudicatorKeypair;
    contractors: DemoContractor[];
    contract: Contract<PS>;
    contractAddress: string;
    coinPublicKey: string;
    prequalPaths: Map<number, PS['activePrequalPath']>;
    contractState: runtime.ContractState;
    privateState: PS;
  }) {
    this.tenderId = args.tenderId;
    this.adjSecret = args.adjSecret;
    this.adjKeypair = args.adjKeypair;
    this.contractors = args.contractors;
    this.contract = args.contract;
    this.contractAddress = args.contractAddress;
    this.coinPublicKey = args.coinPublicKey;
    this.prequalPaths = args.prequalPaths;
    this.contractState = args.contractState;
    this.privateState = args.privateState;
  }

  static async createDefaultFixture(): Promise<AssizeBrowserSession> {
    const tenderId = randomBytes32();
    const adjSecret = randomBytes32();
    const adjPubKey = hashAdjPubKey(adjSecret);
    const adjKeypair = await generateEphemeralAdjudicatorKeypair();

    const defs = [
      {
        slot: 0,
        name: 'Pacific Concrete Corp.',
        licenseNo: 'CA-A-849201',
        roleLabel: 'Preferred Incumbent',
        priceCents: 94_000_000n, // $940,000
      },
      {
        slot: 1,
        name: 'Sierra Structural LLC',
        licenseNo: 'CA-A-912450',
        roleLabel: 'Lowest Compliant Bidder',
        priceCents: 88_500_000n, // $885,000
      },
      {
        slot: 2,
        name: 'Redwood Civil Works',
        licenseNo: 'CA-A-771309',
        roleLabel: 'Higher Compliant Loser',
        priceCents: 104_000_000n, // $1,040,000
      },
      {
        slot: 3,
        name: 'Valley Heavy Builders',
        licenseNo: 'CA-A-658912',
        roleLabel: 'Over $1.2M Budget Cap',
        priceCents: 126_000_000n, // $1,260,000
      },
    ];

    const contractors: DemoContractor[] = defs.map((d) => {
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
      return {
        ...d,
        bondCents,
        secret,
        pubKey,
        firmIdHash,
        subListHash,
        bidDocsHash,
        opening,
        committed: false,
        receiptDelivered: false,
      };
    });

    // Build depth-5 prequalification Merkle tree
    let tree = new runtime.StateBoundedMerkleTree(5);
    const leaves = contractors.map((c) => hashPrequalLeaf(tenderId, c.pubKey));
    for (let i = 0; i < leaves.length; i++) {
      const aligned = { value: BYTES32.toValue(leaves[i]), alignment: BYTES32.alignment() };
      tree = tree.update(BigInt(i), aligned);
    }
    tree = tree.rehash();
    const rootAligned = tree.root();
    if (!rootAligned) throw new Error('Failed to build prequalification root');
    const prequalRoot = runtime.CompactTypeMerkleTreeDigest.fromValue([...rootAligned.value]);
    const pathType = new runtime.CompactTypeMerkleTreePath(5, BYTES32);
    const prequalPaths = new Map<number, PS['activePrequalPath']>();
    for (let i = 0; i < leaves.length; i++) {
      const aligned = { value: BYTES32.toValue(leaves[i]), alignment: BYTES32.alignment() };
      const mp = tree.pathForLeaf(BigInt(i), aligned);
      const decoded = pathType.fromValue([...mp.value]);
      prequalPaths.set(i, { leaf: decoded.leaf, path: decoded.path });
    }

    const witnesses: Witnesses<PS> = {
      bidderSecret: ({ privateState }) => [privateState, privateState.activeBidderSecret],
      bidderPrequalPath: ({ privateState }) => [privateState, privateState.activePrequalPath],
      bidderOpening: ({ privateState }) => [privateState, privateState.activeOpening],
      adjudicatorSecret: ({ privateState }) => [privateState, privateState.activeAdjSecret],
      adjudicatorOpenings: ({ privateState }) => [privateState, privateState.activeAdjOpenings],
    };

    const contract = new Contract<PS>(witnesses);
    const contractAddress = runtime.sampleContractAddress();
    const coinPublicKey = runtime.sampleUserAddress();
    const emptyPath = {
      leaf: new Uint8Array(32),
      path: Array.from({ length: 5 }, () => ({ sibling: { field: 0n }, goes_left: false })),
    };
    const initialPS: PS = {
      activeBidderSecret: new Uint8Array(32),
      activePrequalPath: emptyPath,
      activeOpening: makeEmptyOpening(),
      activeAdjSecret: adjSecret,
      activeAdjOpenings: [makeEmptyOpening(), makeEmptyOpening(), makeEmptyOpening(), makeEmptyOpening()],
    };

    const ctorCtx = runtime.createConstructorContext(initialPS, coinPublicKey);
    const init = await contract.initialState(
      ctorCtx,
      tenderId,
      adjPubKey,
      hexToBytes32(adjKeypair.publicKeyFingerprintHex),
      prequalRoot,
      pad32('ROSTER_COUNTY_PW_2026_041'),
      pad32('CA_PCC_20128_LOWEST_RESP'),
      120_000_000n, // $1,200,000 public cap
      1000n // 10% statutory surety bond
    );

    return new AssizeBrowserSession({
      tenderId,
      adjSecret,
      adjKeypair,
      contractors,
      contract,
      contractAddress,
      coinPublicKey,
      prequalPaths,
      contractState: init.currentContractState,
      privateState: init.currentPrivateState,
    });
  }

  getSnapshot(): LedgerSnapshot {
    const l: Ledger = ledger(this.contractState.data);
    return {
      tenderId: bytesToHex(l.tenderId),
      adjudicatorPubKey: bytesToHex(l.adjudicatorPubKey),
      adjudicatorEncPubKey: bytesToHex(l.adjudicatorEncPubKey),
      prequalRoot: l.prequalRoot.field.toString(),
      prequalRosterHash: bytesToHex(l.prequalRosterHash),
      selectionRuleHash: bytesToHex(l.selectionRuleHash),
      maxAwardBudget: l.maxAwardBudget,
      minBondBps: l.minBondBps,
      phase: l.phase,
      bidCount: Number(l.bidCount),
      rollingCommitRoot: bytesToHex(l.rollingCommitRoot),
      frozenBidCount: Number(l.frozenBidCount),
      frozenCommitRoot: bytesToHex(l.frozenCommitRoot),
      bidCommitments: [0n, 1n, 2n, 3n].map((i) => bytesToHex(l.bidCommitments.lookup(i))),
      usedNullifiers: Array.from(l.usedNullifiers).map(bytesToHex),
      openingReceipts: [0n, 1n, 2n, 3n].map((i) => bytesToHex(l.openingReceipts.lookup(i))),
      deliveredFlags: [0n, 1n, 2n, 3n].map((i) => l.deliveredFlags.lookup(i)),
      hasWinner: l.hasWinner,
      winningSlot: Number(l.winningSlot),
      awardedPrice: l.awardedPrice,
      winnerCommitment: bytesToHex(l.winnerCommitment),
      winnerFirmIdHash: bytesToHex(l.winnerFirmIdHash),
      winnerSubListHash: bytesToHex(l.winnerSubListHash),
      exclusionCodes: [0n, 1n, 2n, 3n].map((i) => l.exclusionCodes.lookup(i)),
      exclusionEvidence: [0n, 1n, 2n, 3n].map((i) => bytesToHex(l.exclusionEvidence.lookup(i))),
      nonRevealCount: Number(l.nonRevealCount),
      challengerSlot: Number(l.challengerSlot),
      challengerCommitment: bytesToHex(l.challengerCommitment),
    };
  }

  private diffSnapshots(before: LedgerSnapshot, after: LedgerSnapshot): string[] {
    const changed: string[] = [];
    const keys = Object.keys(after) as (keyof LedgerSnapshot)[];
    for (const k of keys) {
      const a = JSON.stringify(before[k], (_, v) => (typeof v === 'bigint' ? v.toString() : v));
      const b = JSON.stringify(after[k], (_, v) => (typeof v === 'bigint' ? v.toString() : v));
      if (a !== b) changed.push(k);
    }
    return changed;
  }

  private makeCtx(circuitId: string) {
    return runtime.createCircuitContext({
      circuitId,
      contractAddress: this.contractAddress,
      coinPublicKeyOrZswapState: this.coinPublicKey,
      contractState: this.contractState,
      privateState: this.privateState,
    });
  }

  private async runCircuit<T>(
    circuitName: string,
    detail: string,
    fn: () => Promise<runtime.CircuitResults<PS, T>>
  ): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
    const t0 = performance.now();
    const before = this.getSnapshot();
    try {
      const res = await fn();
      const nextState = new runtime.ContractState();
      nextState.data = res.context.callContext.currentQueryContext.state;
      this.contractState = nextState;
      this.privateState = res.context.callContext.currentPrivateState ?? this.privateState;
      const after = this.getSnapshot();
      const changed = this.diffSnapshots(before, after);
      this.lastChangedFields = changed;
      this.logs.unshift({
        id: ++this.logSeq,
        circuit: circuitName,
        status: 'OK',
        detail,
        elapsedMs: Math.round(performance.now() - t0),
        changedFields: changed,
        timestamp: new Date().toLocaleTimeString(),
      });
      return { ok: true, result: res.result };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.lastChangedFields = [];
      this.logs.unshift({
        id: ++this.logSeq,
        circuit: circuitName,
        status: 'REJECTED',
        detail: `${detail} -> ${msg}`,
        elapsedMs: Math.round(performance.now() - t0),
        changedFields: [],
        timestamp: new Date().toLocaleTimeString(),
      });
      return { ok: false, error: msg };
    }
  }

  async submitAllFourSealedBids(): Promise<{ ok: true } | { ok: false; error: string }> {
    for (const c of this.contractors) {
      if (c.committed) continue;
      const path = this.prequalPaths.get(c.slot)!;
      this.privateState = {
        ...this.privateState,
        activeBidderSecret: c.secret,
        activePrequalPath: path,
        activeOpening: c.opening,
      };
      const r = await this.runCircuit(
        'submitSealedBid',
        `Slot ${c.slot} sealed commitment anchored (Merkle membership + 10% surety bond proven in ZK)`,
        () => this.contract.impureCircuits.submitSealedBid(this.makeCtx('submitSealedBid'))
      );
      if (!r.ok) return { ok: false, error: r.error };
      c.committed = true;
    }
    return { ok: true };
  }

  async closeBidding() {
    return this.runCircuit(
      'closeBidding',
      'Bidding frozen permissionlessly: frozenBidCount=4 & frozenCommitRoot locked',
      () => this.contract.impureCircuits.closeBidding(this.makeCtx('closeBidding'))
    );
  }

  async deliverAllFourEncryptedOpenings(): Promise<{ ok: true } | { ok: false; error: string }> {
    for (const c of this.contractors) {
      if (c.receiptDelivered) continue;
      const env = await encryptBidOpening(
        bytesToHex(this.tenderId),
        c.slot,
        this.adjKeypair.publicKeySpkiB64,
        {
          nullifierHex: bytesToHex(c.opening.nullifier),
          price: c.opening.price.toString(),
          bondAmount: c.opening.bondAmount.toString(),
          firmIdHashHex: bytesToHex(c.opening.firmIdHash),
          subListHashHex: bytesToHex(c.opening.subListHash),
          bidDocsHashHex: bytesToHex(c.opening.bidDocsHash),
          bidSaltHex: bytesToHex(c.opening.bidSalt),
          firmName: c.name,
        }
      );
      c.envelope = env;
      // Verify real adjudicator decryption works off-chain
      await decryptBidOpening(env, this.adjKeypair.privateKeyPkcs8B64, env.envelopeHashHex);

      this.privateState = {
        ...this.privateState,
        activeBidderSecret: c.secret,
        activeOpening: c.opening,
      };
      const r = await this.runCircuit(
        'deliverOpening',
        `Slot ${c.slot} WebCrypto envelope encrypted off-chain; sha256 receipt anchored on-chain`,
        () =>
          this.contract.impureCircuits.deliverOpening(
            this.makeCtx('deliverOpening'),
            BigInt(c.slot),
            hexToBytes32(env.envelopeHashHex)
          )
      );
      if (!r.ok) return { ok: false, error: r.error };
      c.receiptDelivered = true;
    }
    return { ok: true };
  }

  async closeReveal() {
    return this.runCircuit(
      'closeReveal',
      'Reveal window locked (REVEAL -> EVALUATION) preventing early-cutoff race',
      () => this.contract.impureCircuits.closeReveal(this.makeCtx('closeReveal'))
    );
  }

  // Adversarial Attack 1: Silent Omission
  async attemptSilentOmission() {
    this.privateState = {
      ...this.privateState,
      activeAdjSecret: this.adjSecret,
      activeAdjOpenings: this.contractors.map((c) => c.opening),
    };
    return this.runCircuit(
      'proveAward [ATTACK: Silent Omission]',
      'Corrupt adjudicator tries marking Slot 1 ($885k) as NO_BID to award $940k',
      () =>
        this.contract.impureCircuits.proveAward(
          this.makeCtx('proveAward'),
          true,
          0n,
          94_000_000n,
          this.contractors[0].firmIdHash,
          this.contractors[0].subListHash,
          [ExclusionCode.NONE, ExclusionCode.NO_BID, ExclusionCode.NONE, ExclusionCode.OVER_BUDGET],
          [pad32(''), pad32(''), pad32(''), pad32('OVER_1_2M_CAP')]
        )
    );
  }

  // Adversarial Attack 2: Wrong Winner (Argmin Violation)
  async attemptWrongWinner() {
    this.privateState = {
      ...this.privateState,
      activeAdjSecret: this.adjSecret,
      activeAdjOpenings: this.contractors.map((c) => c.opening),
    };
    return this.runCircuit(
      'proveAward [ATTACK: Wrong Winner]',
      'Corrupt adjudicator includes all 4 bids but awards Slot 0 ($940k) over Slot 1 ($885k)',
      () =>
        this.contract.impureCircuits.proveAward(
          this.makeCtx('proveAward'),
          true,
          0n,
          94_000_000n,
          this.contractors[0].firmIdHash,
          this.contractors[0].subListHash,
          [ExclusionCode.NONE, ExclusionCode.NONE, ExclusionCode.NONE, ExclusionCode.OVER_BUDGET],
          [pad32(''), pad32(''), pad32(''), pad32('OVER_1_2M_CAP')]
        )
    );
  }

  // Adversarial Attack 3: Fake NON_REVEAL on Receipted Slot
  async attemptFakeNonReveal() {
    this.privateState = {
      ...this.privateState,
      activeAdjSecret: this.adjSecret,
      activeAdjOpenings: this.contractors.map((c) => c.opening),
    };
    return this.runCircuit(
      'proveAward [ATTACK: Fake NON_REVEAL]',
      'Corrupt adjudicator tries marking receipted Slot 1 ($885k) as NON_REVEAL',
      () =>
        this.contract.impureCircuits.proveAward(
          this.makeCtx('proveAward'),
          true,
          0n,
          94_000_000n,
          this.contractors[0].firmIdHash,
          this.contractors[0].subListHash,
          [ExclusionCode.NONE, ExclusionCode.NON_REVEAL, ExclusionCode.NONE, ExclusionCode.OVER_BUDGET],
          [pad32(''), pad32(''), pad32(''), pad32('OVER_1_2M_CAP')]
        )
    );
  }

  // Pretextual Exclusion (Allowed on-chain with explicit reason code + evidenceHash -> challengeable!)
  async executePretextualExclusion() {
    this.privateState = {
      ...this.privateState,
      activeAdjSecret: this.adjSecret,
      activeAdjOpenings: this.contractors.map((c) => c.opening),
    };
    return this.runCircuit(
      'proveAward [Pretextual Exclusion]',
      'Adjudicator excludes Slot 1 as NOT_RESPONSIBLE (with public evidenceHash) & awards Slot 0 ($940,000)',
      () =>
        this.contract.impureCircuits.proveAward(
          this.makeCtx('proveAward'),
          true,
          0n,
          94_000_000n,
          this.contractors[0].firmIdHash,
          this.contractors[0].subListHash,
          [ExclusionCode.NONE, ExclusionCode.NOT_RESPONSIBLE, ExclusionCode.NONE, ExclusionCode.OVER_BUDGET],
          [pad32(''), pad32('DISQUAL_MEMO_SLOT1_SHA256'), pad32(''), pad32('EXCEEDS_1_2M_CAP')]
        )
    );
  }

  // Honest Award ($885k wins)
  async executeHonestAward() {
    this.privateState = {
      ...this.privateState,
      activeAdjSecret: this.adjSecret,
      activeAdjOpenings: this.contractors.map((c) => c.opening),
    };
    return this.runCircuit(
      'proveAward [Honest Award]',
      'Complete-set award proven: Slot 1 (Sierra Structural LLC, $885,000) wins; Slot 3 proved OVER_BUDGET',
      () =>
        this.contract.impureCircuits.proveAward(
          this.makeCtx('proveAward'),
          true,
          1n,
          88_500_000n,
          this.contractors[1].firmIdHash,
          this.contractors[1].subListHash,
          [ExclusionCode.NONE, ExclusionCode.NONE, ExclusionCode.NONE, ExclusionCode.OVER_BUDGET],
          [pad32(''), pad32(''), pad32(''), pad32('EXCEEDS_1_2M_CAP')]
        )
    );
  }

  // ZK Protest Challenge by Slot 1 (without disclosing $885k!)
  async fileZkProtestSlot1() {
    const c = this.contractors[1];
    this.privateState = {
      ...this.privateState,
      activeBidderSecret: c.secret,
      activeOpening: c.opening,
    };
    return this.runCircuit(
      'challengeAward',
      'Slot 1 proved myPrice < $940,000 in ZK without disclosing $885,000 -> Tender flipped to CONTESTED',
      () => this.contract.impureCircuits.challengeAward(this.makeCtx('challengeAward'), 1n)
    );
  }

  async finalizeAward() {
    this.privateState = {
      ...this.privateState,
      activeAdjSecret: this.adjSecret,
    };
    return this.runCircuit(
      'finalizeAward',
      'Uncontested award finalized permanently on ledger',
      () => this.contract.impureCircuits.finalizeAward(this.makeCtx('finalizeAward'))
    );
  }

  buildDownloadableReceipt(slotIndex: number) {
    const snap = this.getSnapshot();
    const c = this.contractors[slotIndex];
    return {
      schema: 'ASSIZE-AUDIT-RECEIPT-V1',
      generatedAt: new Date().toISOString(),
      executionMode: 'LOCAL_COMPILED_COMPACT_0_36_1_RUNTIME_UNPROVEN',
      tenderCode: this.tenderCode,
      tenderId: snap.tenderId,
      slotIndex,
      onChainCommitment: snap.bidCommitments[slotIndex],
      onChainOpeningReceiptDigest: snap.openingReceipts[slotIndex],
      onChainExclusionCode: ExclusionCode[snap.exclusionCodes[slotIndex]],
      onChainExclusionEvidenceHash: snap.exclusionEvidence[slotIndex],
      phase: Phase[snap.phase],
      awardedPriceCents: snap.awardedPrice.toString(),
      challengerSlot: snap.phase === Phase.CONTESTED ? snap.challengerSlot : null,
      note: 'Private price, bidSalt, and WebCrypto ciphertext are intentionally omitted from public on-chain state.',
      encryptedEnvelopeMetadata: c.envelope
        ? {
            alg: c.envelope.alg,
            envelopeHashHex: c.envelope.envelopeHashHex,
          }
        : null,
    };
  }
}
