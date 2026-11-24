// SPDX-License-Identifier: Apache-2.0
// Assize — Real Compiled Compact 0.36.1 Runtime Simulator & Prequalification Tree Builder

import * as runtime from '@midnight-ntwrk/compact-runtime';
import {
  Contract,
  ExclusionCode,
  Phase,
  ledger,
  type BidOpening,
  type Ledger,
  type Witnesses,
} from '../managed/assize/contract/index.js';

export { ExclusionCode, Phase, type BidOpening, type Ledger };

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

export function hexToBytes32(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(32);
  for (let i = 0; i < 32 && i * 2 + 1 < clean.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToHex(b: Uint8Array): string {
  return Array.from(b)
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}

export function hashBidderPubKey(secret: Uint8Array): Uint8Array {
  return runtime.persistentHash(VEC2_B32, [pad32('ASSIZE_BIDDER_PK_V1'), secret]);
}

export function hashAdjPubKey(secret: Uint8Array): Uint8Array {
  return runtime.persistentHash(VEC2_B32, [pad32('ASSIZE_ADJ_PK_V1'), secret]);
}

export function hashPrequalLeaf(tenderId: Uint8Array, bidderPk: Uint8Array): Uint8Array {
  return runtime.persistentHash(VEC3_B32, [pad32('ASSIZE_PREQUAL_V1'), tenderId, bidderPk]);
}

export function hashNullifier(tenderId: Uint8Array, secret: Uint8Array): Uint8Array {
  return runtime.persistentHash(VEC3_B32, [pad32('ASSIZE_NULLIFIER_V1'), tenderId, secret]);
}

export interface PrequalTreeResult {
  root: { field: bigint };
  leaves: Uint8Array[];
  getPath(index: number): {
    leaf: Uint8Array;
    path: { sibling: { field: bigint }; goes_left: boolean }[];
  };
}

export function buildPrequalTree(
  tenderId: Uint8Array,
  bidderPubKeys: Uint8Array[]
): PrequalTreeResult {
  if (bidderPubKeys.length === 0 || bidderPubKeys.length > 32) {
    throw new Error('Prequal roster must contain 1..32 bidders (depth 5)');
  }
  let tree = new runtime.StateBoundedMerkleTree(5);
  const leaves: Uint8Array[] = [];
  for (let i = 0; i < bidderPubKeys.length; i++) {
    const leaf = hashPrequalLeaf(tenderId, bidderPubKeys[i]);
    leaves.push(leaf);
    const aligned = { value: BYTES32.toValue(leaf), alignment: BYTES32.alignment() };
    tree = tree.update(BigInt(i), aligned);
  }
  tree = tree.rehash();
  const rootAligned = tree.root();
  if (!rootAligned) throw new Error('Failed to compute Merkle root');
  const rootDigest = runtime.CompactTypeMerkleTreeDigest.fromValue([...rootAligned.value]);
  const pathType = new runtime.CompactTypeMerkleTreePath(5, BYTES32);

  return {
    root: rootDigest,
    leaves,
    getPath(index: number) {
      const leaf = leaves[index];
      const aligned = { value: BYTES32.toValue(leaf), alignment: BYTES32.alignment() };
      const mp = tree.pathForLeaf(BigInt(index), aligned);
      const decoded = pathType.fromValue([...mp.value]);
      return {
        leaf: decoded.leaf,
        path: decoded.path,
      };
    },
  };
}

export function makeEmptyOpening(): BidOpening {
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

export interface AssizePrivateState {
  activeBidderSecret: Uint8Array;
  activePrequalPath: {
    leaf: Uint8Array;
    path: { sibling: { field: bigint }; goes_left: boolean }[];
  };
  activeOpening: BidOpening;
  activeAdjSecret: Uint8Array;
  activeAdjOpenings: BidOpening[];
}

export interface TenderConfig {
  tenderId: Uint8Array;
  adjudicatorPubKey: Uint8Array;
  adjudicatorEncPubKey: Uint8Array;
  prequalRoot: { field: bigint };
  prequalRosterHash: Uint8Array;
  selectionRuleHash: Uint8Array;
  maxAwardBudget: bigint;
  minBondBps: bigint;
}

export class AssizeSimulator {
  readonly contract: Contract<AssizePrivateState>;
  readonly contractAddress: string;
  readonly coinPublicKey: string;
  contractState: runtime.ContractState;
  privateState: AssizePrivateState;

  private constructor(
    contract: Contract<AssizePrivateState>,
    contractAddress: string,
    coinPublicKey: string,
    contractState: runtime.ContractState,
    privateState: AssizePrivateState
  ) {
    this.contract = contract;
    this.contractAddress = contractAddress;
    this.coinPublicKey = coinPublicKey;
    this.contractState = contractState;
    this.privateState = privateState;
  }

  static async create(config: TenderConfig): Promise<AssizeSimulator> {
    const witnesses: Witnesses<AssizePrivateState> = {
      bidderSecret: ({ privateState }) => [privateState, privateState.activeBidderSecret],
      bidderPrequalPath: ({ privateState }) => [privateState, privateState.activePrequalPath],
      bidderOpening: ({ privateState }) => [privateState, privateState.activeOpening],
      adjudicatorSecret: ({ privateState }) => [privateState, privateState.activeAdjSecret],
      adjudicatorOpenings: ({ privateState }) => [privateState, privateState.activeAdjOpenings],
    };

    const contract = new Contract<AssizePrivateState>(witnesses);
    const contractAddress = runtime.sampleContractAddress();
    const coinPublicKey = runtime.sampleUserAddress();

    const emptyPath = {
      leaf: new Uint8Array(32),
      path: Array.from({ length: 5 }, () => ({ sibling: { field: 0n }, goes_left: false })),
    };

    const initialPS: AssizePrivateState = {
      activeBidderSecret: new Uint8Array(32),
      activePrequalPath: emptyPath,
      activeOpening: makeEmptyOpening(),
      activeAdjSecret: new Uint8Array(32),
      activeAdjOpenings: [
        makeEmptyOpening(),
        makeEmptyOpening(),
        makeEmptyOpening(),
        makeEmptyOpening(),
      ],
    };

    const ctorCtx = runtime.createConstructorContext(initialPS, coinPublicKey);
    const res = await contract.initialState(
      ctorCtx,
      config.tenderId,
      config.adjudicatorPubKey,
      config.adjudicatorEncPubKey,
      config.prequalRoot,
      config.prequalRosterHash,
      config.selectionRuleHash,
      config.maxAwardBudget,
      config.minBondBps
    );

    return new AssizeSimulator(
      contract,
      contractAddress,
      coinPublicKey,
      res.currentContractState,
      res.currentPrivateState
    );
  }

  private makeCircuitCtx(circuitId: string): runtime.CircuitContext<AssizePrivateState> {
    return runtime.createCircuitContext({
      circuitId,
      contractAddress: this.contractAddress,
      coinPublicKeyOrZswapState: this.coinPublicKey,
      contractState: this.contractState,
      privateState: this.privateState,
    });
  }

  private commitResult<T>(res: runtime.CircuitResults<AssizePrivateState, T>): T {
    this.contractState = res.context.callContext.currentQueryContext
      ? this.updateStateFromContext(res.context)
      : this.contractState;
    this.privateState = res.context.callContext.currentPrivateState;
    return res.result;
  }

  private updateStateFromContext(
    ctx: runtime.CircuitContext<AssizePrivateState>
  ): runtime.ContractState {
    const next = new runtime.ContractState();
    next.data = ctx.callContext.currentQueryContext.state;
    return next;
  }

  getLedger(): Ledger {
    return ledger(this.contractState.data);
  }

  async submitSealedBid(
    bidderSecret: Uint8Array,
    prequalPath: { leaf: Uint8Array; path: { sibling: { field: bigint }; goes_left: boolean }[] },
    opening: BidOpening
  ): Promise<bigint> {
    this.privateState = {
      ...this.privateState,
      activeBidderSecret: bidderSecret,
      activePrequalPath: prequalPath,
      activeOpening: opening,
    };
    const res = await this.contract.impureCircuits.submitSealedBid(
      this.makeCircuitCtx('submitSealedBid')
    );
    return this.commitResult(res);
  }

  async closeBidding(): Promise<void> {
    const res = await this.contract.impureCircuits.closeBidding(
      this.makeCircuitCtx('closeBidding')
    );
    this.commitResult(res);
  }

  async deliverOpening(
    slotIndex: bigint,
    envelopeHash: Uint8Array,
    bidderSecret: Uint8Array,
    opening: BidOpening
  ): Promise<void> {
    this.privateState = {
      ...this.privateState,
      activeBidderSecret: bidderSecret,
      activeOpening: opening,
    };
    const res = await this.contract.impureCircuits.deliverOpening(
      this.makeCircuitCtx('deliverOpening'),
      slotIndex,
      envelopeHash
    );
    this.commitResult(res);
  }

  async closeReveal(): Promise<void> {
    const res = await this.contract.impureCircuits.closeReveal(
      this.makeCircuitCtx('closeReveal')
    );
    this.commitResult(res);
  }

  async proveAward(params: {
    adjudicatorSecret: Uint8Array;
    openings: BidOpening[];
    hasWinner: boolean;
    winningSlot: bigint;
    awardedPrice: bigint;
    winnerFirmIdHash: Uint8Array;
    winnerSubListHash: Uint8Array;
    codes: ExclusionCode[];
    evidence: Uint8Array[];
  }): Promise<void> {
    this.privateState = {
      ...this.privateState,
      activeAdjSecret: params.adjudicatorSecret,
      activeAdjOpenings: params.openings,
    };
    const res = await this.contract.impureCircuits.proveAward(
      this.makeCircuitCtx('proveAward'),
      params.hasWinner,
      params.winningSlot,
      params.awardedPrice,
      params.winnerFirmIdHash,
      params.winnerSubListHash,
      params.codes,
      params.evidence
    );
    this.commitResult(res);
  }

  async challengeAward(
    slotIndex: bigint,
    bidderSecret: Uint8Array,
    opening: BidOpening
  ): Promise<void> {
    this.privateState = {
      ...this.privateState,
      activeBidderSecret: bidderSecret,
      activeOpening: opening,
    };
    const res = await this.contract.impureCircuits.challengeAward(
      this.makeCircuitCtx('challengeAward'),
      slotIndex
    );
    this.commitResult(res);
  }

  async finalizeAward(adjudicatorSecret: Uint8Array): Promise<void> {
    this.privateState = {
      ...this.privateState,
      activeAdjSecret: adjudicatorSecret,
    };
    const res = await this.contract.impureCircuits.finalizeAward(
      this.makeCircuitCtx('finalizeAward')
    );
    this.commitResult(res);
  }

  async declareAdjudicatorDefault(): Promise<void> {
    const res = await this.contract.impureCircuits.declareAdjudicatorDefault(
      this.makeCircuitCtx('declareAdjudicatorDefault')
    );
    this.commitResult(res);
  }

  /**
   * Serialize the entire public on-chain ledger state to a canonical string for
   * automated zero-leakage scanning (verifying zero losing prices, salts, or IDs appear).
   */
  serializePublicLedger(): string {
    const l = this.getLedger();
    const mapToObj = <V>(m: { [Symbol.iterator](): Iterator<[bigint, V]> }) => {
      const o: Record<string, unknown> = {};
      for (const [k, v] of m) {
        o[k.toString()] = v instanceof Uint8Array ? bytesToHex(v) : v;
      }
      return o;
    };
    return JSON.stringify(
      {
        tenderId: bytesToHex(l.tenderId),
        adjudicatorPubKey: bytesToHex(l.adjudicatorPubKey),
        adjudicatorEncPubKey: bytesToHex(l.adjudicatorEncPubKey),
        prequalRoot: l.prequalRoot.field.toString(),
        prequalRosterHash: bytesToHex(l.prequalRosterHash),
        selectionRuleHash: bytesToHex(l.selectionRuleHash),
        maxAwardBudget: l.maxAwardBudget.toString(),
        minBondBps: l.minBondBps.toString(),
        phase: l.phase,
        bidCount: l.bidCount.toString(),
        rollingCommitRoot: bytesToHex(l.rollingCommitRoot),
        frozenBidCount: l.frozenBidCount.toString(),
        frozenCommitRoot: bytesToHex(l.frozenCommitRoot),
        bidCommitments: mapToObj(l.bidCommitments),
        usedNullifiers: Array.from(l.usedNullifiers).map(bytesToHex),
        openingReceipts: mapToObj(l.openingReceipts),
        deliveredFlags: mapToObj(l.deliveredFlags),
        hasWinner: l.hasWinner,
        winningSlot: l.winningSlot.toString(),
        awardedPrice: l.awardedPrice.toString(),
        winnerCommitment: bytesToHex(l.winnerCommitment),
        winnerFirmIdHash: bytesToHex(l.winnerFirmIdHash),
        winnerSubListHash: bytesToHex(l.winnerSubListHash),
        exclusionCodes: mapToObj(l.exclusionCodes),
        exclusionEvidence: mapToObj(l.exclusionEvidence),
        nonRevealCount: l.nonRevealCount.toString(),
        challengerSlot: l.challengerSlot.toString(),
        challengerCommitment: bytesToHex(l.challengerCommitment),
      },
      null,
      2
    );
  }
}
