import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum Phase { OPEN = 0,
                    REVEAL = 1,
                    EVALUATION = 2,
                    AWARDED = 3,
                    NO_AWARD = 4,
                    CONTESTED = 5,
                    FINALIZED = 6,
                    CANCELLED_NO_BIDS = 7,
                    ADJUDICATOR_DEFAULT = 8
}

export enum ExclusionCode { NONE = 0,
                            NO_BID = 1,
                            NON_REVEAL = 2,
                            UNDECRYPTABLE = 3,
                            OVER_BUDGET = 4,
                            BOND_DEFECT = 5,
                            NON_RESPONSIVE = 6,
                            NOT_RESPONSIBLE = 7
}

export type BidOpening = { nullifier: Uint8Array;
                           price: bigint;
                           bondAmount: bigint;
                           firmIdHash: Uint8Array;
                           subListHash: Uint8Array;
                           bidDocsHash: Uint8Array;
                           bidSalt: Uint8Array
                         };

export type Witnesses<PS> = {
  bidderSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  bidderPrequalPath(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, { leaf: Uint8Array,
                                                                                  path: { sibling: { field: bigint
                                                                                                   },
                                                                                          goes_left: boolean
                                                                                        }[]
                                                                                }];
  bidderOpening(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, BidOpening];
  adjudicatorSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  adjudicatorOpenings(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, BidOpening[]];
}

export type ImpureCircuits<PS> = {
  submitSealedBid(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, bigint>>;
  closeBidding(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, []>>;
  deliverOpening(context: __compactRuntime.CircuitContext<PS>,
                 slotIndex_0: bigint,
                 envelopeHash_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  closeReveal(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, []>>;
  proveAward(context: __compactRuntime.CircuitContext<PS>,
             hasWinnerIn_0: boolean,
             winningSlotIn_0: bigint,
             awardedPriceIn_0: bigint,
             winnerFirmIn_0: Uint8Array,
             winnerSubListIn_0: Uint8Array,
             codesIn_0: ExclusionCode[],
             evidenceIn_0: Uint8Array[]): Promise<__compactRuntime.CircuitResults<PS, []>>;
  challengeAward(context: __compactRuntime.CircuitContext<PS>,
                 slotIndex_0: bigint): Promise<__compactRuntime.CircuitResults<PS, []>>;
  finalizeAward(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, []>>;
  declareAdjudicatorDefault(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, []>>;
}

export type ProvableCircuits<PS> = {
  submitSealedBid(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, bigint>>;
  closeBidding(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, []>>;
  deliverOpening(context: __compactRuntime.CircuitContext<PS>,
                 slotIndex_0: bigint,
                 envelopeHash_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  closeReveal(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, []>>;
  proveAward(context: __compactRuntime.CircuitContext<PS>,
             hasWinnerIn_0: boolean,
             winningSlotIn_0: bigint,
             awardedPriceIn_0: bigint,
             winnerFirmIn_0: Uint8Array,
             winnerSubListIn_0: Uint8Array,
             codesIn_0: ExclusionCode[],
             evidenceIn_0: Uint8Array[]): Promise<__compactRuntime.CircuitResults<PS, []>>;
  challengeAward(context: __compactRuntime.CircuitContext<PS>,
                 slotIndex_0: bigint): Promise<__compactRuntime.CircuitResults<PS, []>>;
  finalizeAward(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, []>>;
  declareAdjudicatorDefault(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, []>>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  submitSealedBid(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, bigint>>;
  closeBidding(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, []>>;
  deliverOpening(context: __compactRuntime.CircuitContext<PS>,
                 slotIndex_0: bigint,
                 envelopeHash_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  closeReveal(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, []>>;
  proveAward(context: __compactRuntime.CircuitContext<PS>,
             hasWinnerIn_0: boolean,
             winningSlotIn_0: bigint,
             awardedPriceIn_0: bigint,
             winnerFirmIn_0: Uint8Array,
             winnerSubListIn_0: Uint8Array,
             codesIn_0: ExclusionCode[],
             evidenceIn_0: Uint8Array[]): Promise<__compactRuntime.CircuitResults<PS, []>>;
  challengeAward(context: __compactRuntime.CircuitContext<PS>,
                 slotIndex_0: bigint): Promise<__compactRuntime.CircuitResults<PS, []>>;
  finalizeAward(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, []>>;
  declareAdjudicatorDefault(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, []>>;
}

export type Ledger = {
  readonly tenderId: Uint8Array;
  readonly adjudicatorPubKey: Uint8Array;
  readonly adjudicatorEncPubKey: Uint8Array;
  readonly prequalRoot: { field: bigint };
  readonly prequalRosterHash: Uint8Array;
  readonly selectionRuleHash: Uint8Array;
  readonly maxAwardBudget: bigint;
  readonly minBondBps: bigint;
  readonly phase: Phase;
  readonly bidCount: bigint;
  readonly rollingCommitRoot: Uint8Array;
  readonly frozenBidCount: bigint;
  readonly frozenCommitRoot: Uint8Array;
  bidCommitments: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): Uint8Array;
    [Symbol.iterator](): Iterator<[bigint, Uint8Array]>
  };
  usedNullifiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  openingReceipts: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): Uint8Array;
    [Symbol.iterator](): Iterator<[bigint, Uint8Array]>
  };
  deliveredFlags: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): boolean;
    [Symbol.iterator](): Iterator<[bigint, boolean]>
  };
  readonly hasWinner: boolean;
  readonly winningSlot: bigint;
  readonly awardedPrice: bigint;
  readonly winnerCommitment: Uint8Array;
  readonly winnerFirmIdHash: Uint8Array;
  readonly winnerSubListHash: Uint8Array;
  exclusionCodes: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): ExclusionCode;
    [Symbol.iterator](): Iterator<[bigint, ExclusionCode]>
  };
  exclusionEvidence: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): Uint8Array;
    [Symbol.iterator](): Iterator<[bigint, Uint8Array]>
  };
  readonly nonRevealCount: bigint;
  readonly challengerSlot: bigint;
  readonly challengerCommitment: Uint8Array;
}

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               initTenderId_0: Uint8Array,
               initAdjPubKey_0: Uint8Array,
               initAdjEncPubKey_0: Uint8Array,
               initPrequalRoot_0: { field: bigint },
               initPrequalRosterHash_0: Uint8Array,
               initSelectionRuleHash_0: Uint8Array,
               initMaxAwardBudget_0: bigint,
               initMinBondBps_0: bigint): Promise<__compactRuntime.ConstructorResult<PS>>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
export declare const expectedVk: Record<string, string>;
export declare const circuitSignatures: __compactRuntime.CircuitSignatures;
export declare const declaredInterfaces: __compactRuntime.DeclaredInterfaces;
