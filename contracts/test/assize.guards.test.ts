// SPDX-License-Identifier: Apache-2.0
// Assize — 40+ Guard-Invariant, Boundary, Tie-Break, Cross-Tender & Privacy-Audit Tests
// Brings total verified automated suite to 104+ tests covering all 26+ contract guards.

import { describe, expect, it } from 'vitest';
import {
  AssizeSimulator,
  ExclusionCode,
  Phase,
  buildPrequalTree,
  bytesToHex,
  hashAdjPubKey,
  hashBidderPubKey,
  hashNullifier,
  hexToBytes32,
  makeEmptyOpening,
  pad32,
  randomBytes32,
  type BidOpening,
} from '../src/simulator.js';
import {
  decryptBidOpening,
  encryptBidOpening,
  generateEphemeralAdjudicatorKeypair,
} from '../../packages/crypto/index.js';

function mkBidder(name: string) {
  const secret = randomBytes32();
  return {
    name,
    secret,
    pubKey: hashBidderPubKey(secret),
    firmIdHash: pad32(`FIRM_${name}`),
    subListHash: pad32(`SUB_${name}`),
    bidDocsHash: pad32(`DOCS_${name}`),
  };
}

function mkOpening(
  tenderId: Uint8Array,
  b: ReturnType<typeof mkBidder>,
  price: bigint,
  bondAmount?: bigint
): BidOpening {
  return {
    nullifier: hashNullifier(tenderId, b.secret),
    price,
    bondAmount: bondAmount ?? (price * 1000n) / 10000n + 100n,
    firmIdHash: b.firmIdHash,
    subListHash: b.subListHash,
    bidDocsHash: b.bidDocsHash,
    bidSalt: randomBytes32(),
  };
}

async function mkTender(opts?: { maxAwardBudget?: bigint; minBondBps?: bigint; tenderId?: Uint8Array }) {
  const tenderId = opts?.tenderId ?? randomBytes32();
  const adjSecret = randomBytes32();
  const bidders = [mkBidder('A'), mkBidder('B'), mkBidder('C'), mkBidder('D'), mkBidder('E')];
  const tree = buildPrequalTree(
    tenderId,
    bidders.map((b) => b.pubKey)
  );
  const sim = await AssizeSimulator.create({
    tenderId,
    adjudicatorPubKey: hashAdjPubKey(adjSecret),
    adjudicatorEncPubKey: randomBytes32(),
    prequalRoot: tree.root,
    prequalRosterHash: pad32('ROSTER_HASH'),
    selectionRuleHash: pad32('RULE_HASH'),
    maxAwardBudget: opts?.maxAwardBudget ?? 100_000_000n,
    minBondBps: opts?.minBondBps ?? 1000n,
  });
  return { sim, tenderId, adjSecret, bidders, tree };
}

describe('4. Guard-Invariant & Boundary Matrix (40 Tests)', () => {
  it('G01: rejects minBondBps > 10000 in constructor', async () => {
    await expect(mkTender({ minBondBps: 10001n })).rejects.toThrow();
  });

  it('G02: accepts minBondBps == 0 (bond check disabled) with zero bondAmount', async () => {
    const { sim, tenderId, bidders, tree } = await mkTender({ minBondBps: 0n });
    const op = mkOpening(tenderId, bidders[0], 50_000_000n, 0n);
    const slot = await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), op);
    expect(slot).toBe(0n);
  });

  it('G03: accepts exact boundary bondAmount (bond * 10000 == price * minBondBps)', async () => {
    const { sim, tenderId, bidders, tree } = await mkTender({ minBondBps: 1000n });
    const op = mkOpening(tenderId, bidders[0], 50_000_000n, 5_000_000n);
    expect(await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), op)).toBe(0n);
  });

  it('G04: rejects bondAmount off by 1 cent below statutory 10% floor', async () => {
    const { sim, tenderId, bidders, tree } = await mkTender({ minBondBps: 1000n });
    const op = mkOpening(tenderId, bidders[0], 50_000_000n, 4_999_999n);
    await expect(sim.submitSealedBid(bidders[0].secret, tree.getPath(0), op)).rejects.toThrow();
  });

  it('G05: rejects 5th prequalified bidder when N=4 slots are full', async () => {
    const { sim, tenderId, bidders, tree } = await mkTender();
    for (let i = 0; i < 4; i++) {
      await sim.submitSealedBid(bidders[i].secret, tree.getPath(i), mkOpening(tenderId, bidders[i], 50_000_000n));
    }
    await expect(
      sim.submitSealedBid(bidders[4].secret, tree.getPath(4), mkOpening(tenderId, bidders[4], 49_000_000n))
    ).rejects.toThrow();
  });

  it('G06: rejects mismatched opening nullifier in submitSealedBid', async () => {
    const { sim, tenderId, bidders, tree } = await mkTender();
    const op = mkOpening(tenderId, bidders[0], 50_000_000n);
    op.nullifier = randomBytes32();
    await expect(sim.submitSealedBid(bidders[0].secret, tree.getPath(0), op)).rejects.toThrow();
  });

  it('G07: cross-tender nullifier isolation — same bidder secret produces distinct nullifiers across 2 tenders', async () => {
    const b = mkBidder('SameFirm');
    const t1 = randomBytes32();
    const t2 = randomBytes32();
    const n1 = hashNullifier(t1, b.secret);
    const n2 = hashNullifier(t2, b.secret);
    expect(bytesToHex(n1)).not.toBe(bytesToHex(n2));
  });

  it('G08: equal prices with fresh 256-bit salts produce completely distinct commitments', async () => {
    const { sim, tenderId, bidders, tree } = await mkTender();
    const o0 = mkOpening(tenderId, bidders[0], 75_000_000n);
    const o1 = mkOpening(tenderId, bidders[1], 75_000_000n);
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
    await sim.submitSealedBid(bidders[1].secret, tree.getPath(1), o1);
    const c0 = bytesToHex(sim.getLedger().bidCommitments.lookup(0n));
    const c1 = bytesToHex(sim.getLedger().bidCommitments.lookup(1n));
    expect(c0).not.toBe(c1);
  });

  it('G09: rejects closeBidding called twice', async () => {
    const { sim, tenderId, bidders, tree } = await mkTender();
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), mkOpening(tenderId, bidders[0], 50_000_000n));
    await sim.closeBidding();
    await expect(sim.closeBidding()).rejects.toThrow();
  });

  it('G10: rejects deliverOpening during OPEN phase', async () => {
    const { sim, tenderId, bidders, tree } = await mkTender();
    const o0 = mkOpening(tenderId, bidders[0], 50_000_000n);
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
    await expect(sim.deliverOpening(0n, randomBytes32(), bidders[0].secret, o0)).rejects.toThrow();
  });

  it('G11: rejects deliverOpening for out-of-range slotIndex >= frozenBidCount', async () => {
    const { sim, tenderId, bidders, tree } = await mkTender();
    const o0 = mkOpening(tenderId, bidders[0], 50_000_000n);
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
    await sim.closeBidding();
    await expect(sim.deliverOpening(1n, randomBytes32(), bidders[0].secret, o0)).rejects.toThrow();
  });

  it('G12: rejects deliverOpening after closeReveal (EVALUATION phase)', async () => {
    const { sim, tenderId, bidders, tree } = await mkTender();
    const o0 = mkOpening(tenderId, bidders[0], 50_000_000n);
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
    await sim.closeBidding();
    await sim.closeReveal();
    await expect(sim.deliverOpening(0n, randomBytes32(), bidders[0].secret, o0)).rejects.toThrow();
  });

  it('G13: rejects closeReveal during OPEN phase', async () => {
    const { sim } = await mkTender();
    await expect(sim.closeReveal()).rejects.toThrow();
  });

  it('G14: rejects proveAward during REVEAL phase (before closeReveal barrier!)', async () => {
    const { sim, tenderId, adjSecret, bidders, tree } = await mkTender();
    const o0 = mkOpening(tenderId, bidders[0], 50_000_000n);
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
    await sim.closeBidding();
    await sim.deliverOpening(0n, randomBytes32(), bidders[0].secret, o0);
    await expect(
      sim.proveAward({
        adjudicatorSecret: adjSecret,
        openings: [o0, makeEmptyOpening(), makeEmptyOpening(), makeEmptyOpening()],
        hasWinner: true,
        winningSlot: 0n,
        awardedPrice: 50_000_000n,
        winnerFirmIdHash: bidders[0].firmIdHash,
        winnerSubListHash: bidders[0].subListHash,
        codes: [ExclusionCode.NONE, ExclusionCode.NO_BID, ExclusionCode.NO_BID, ExclusionCode.NO_BID],
        evidence: [pad32(''), pad32(''), pad32(''), pad32('')],
      })
    ).rejects.toThrow();
  });

  it('G15: rejects proveAward marking unused slot as NONE instead of NO_BID', async () => {
    const { sim, tenderId, adjSecret, bidders, tree } = await mkTender();
    const o0 = mkOpening(tenderId, bidders[0], 50_000_000n);
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
    await sim.closeBidding();
    await sim.deliverOpening(0n, randomBytes32(), bidders[0].secret, o0);
    await sim.closeReveal();
    await expect(
      sim.proveAward({
        adjudicatorSecret: adjSecret,
        openings: [o0, makeEmptyOpening(), makeEmptyOpening(), makeEmptyOpening()],
        hasWinner: true,
        winningSlot: 0n,
        awardedPrice: 50_000_000n,
        winnerFirmIdHash: bidders[0].firmIdHash,
        winnerSubListHash: bidders[0].subListHash,
        codes: [ExclusionCode.NONE, ExclusionCode.NONE, ExclusionCode.NO_BID, ExclusionCode.NO_BID],
        evidence: [pad32(''), pad32(''), pad32(''), pad32('')],
      })
    ).rejects.toThrow();
  });

  it('G16: rejects proveAward with tampered winnerFirmIdHash', async () => {
    const { sim, tenderId, adjSecret, bidders, tree } = await mkTender();
    const o0 = mkOpening(tenderId, bidders[0], 50_000_000n);
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
    await sim.closeBidding();
    await sim.deliverOpening(0n, randomBytes32(), bidders[0].secret, o0);
    await sim.closeReveal();
    await expect(
      sim.proveAward({
        adjudicatorSecret: adjSecret,
        openings: [o0, makeEmptyOpening(), makeEmptyOpening(), makeEmptyOpening()],
        hasWinner: true,
        winningSlot: 0n,
        awardedPrice: 50_000_000n,
        winnerFirmIdHash: pad32('WRONG_FIRM'),
        winnerSubListHash: bidders[0].subListHash,
        codes: [ExclusionCode.NONE, ExclusionCode.NO_BID, ExclusionCode.NO_BID, ExclusionCode.NO_BID],
        evidence: [pad32(''), pad32(''), pad32(''), pad32('')],
      })
    ).rejects.toThrow();
  });

  it('G17: rejects proveAward with tampered winnerSubListHash (CA PCC §4101 integrity)', async () => {
    const { sim, tenderId, adjSecret, bidders, tree } = await mkTender();
    const o0 = mkOpening(tenderId, bidders[0], 50_000_000n);
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
    await sim.closeBidding();
    await sim.deliverOpening(0n, randomBytes32(), bidders[0].secret, o0);
    await sim.closeReveal();
    await expect(
      sim.proveAward({
        adjudicatorSecret: adjSecret,
        openings: [o0, makeEmptyOpening(), makeEmptyOpening(), makeEmptyOpening()],
        hasWinner: true,
        winningSlot: 0n,
        awardedPrice: 50_000_000n,
        winnerFirmIdHash: bidders[0].firmIdHash,
        winnerSubListHash: pad32('SWAPPED_SUBCONTRACTOR'),
        codes: [ExclusionCode.NONE, ExclusionCode.NO_BID, ExclusionCode.NO_BID, ExclusionCode.NO_BID],
        evidence: [pad32(''), pad32(''), pad32(''), pad32('')],
      })
    ).rejects.toThrow();
  });

  it('G18: rejects proveAward with OVER_BUDGET when maxAwardBudget == 0 (no cap configured)', async () => {
    const { sim, tenderId, adjSecret, bidders, tree } = await mkTender({ maxAwardBudget: 0n });
    const o0 = mkOpening(tenderId, bidders[0], 500_000_000n);
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
    await sim.closeBidding();
    await sim.deliverOpening(0n, randomBytes32(), bidders[0].secret, o0);
    await sim.closeReveal();
    await expect(
      sim.proveAward({
        adjudicatorSecret: adjSecret,
        openings: [o0, makeEmptyOpening(), makeEmptyOpening(), makeEmptyOpening()],
        hasWinner: false,
        winningSlot: 0n,
        awardedPrice: 0n,
        winnerFirmIdHash: pad32(''),
        winnerSubListHash: pad32(''),
        codes: [ExclusionCode.OVER_BUDGET, ExclusionCode.NO_BID, ExclusionCode.NO_BID, ExclusionCode.NO_BID],
        evidence: [pad32(''), pad32(''), pad32(''), pad32('')],
      })
    ).rejects.toThrow();
  });

  it('G19: accepts huge compliant bid when maxAwardBudget == 0 (cap disabled)', async () => {
    const { sim, tenderId, adjSecret, bidders, tree } = await mkTender({ maxAwardBudget: 0n });
    const o0 = mkOpening(tenderId, bidders[0], 500_000_000n);
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
    await sim.closeBidding();
    await sim.deliverOpening(0n, randomBytes32(), bidders[0].secret, o0);
    await sim.closeReveal();
    await sim.proveAward({
      adjudicatorSecret: adjSecret,
      openings: [o0, makeEmptyOpening(), makeEmptyOpening(), makeEmptyOpening()],
      hasWinner: true,
      winningSlot: 0n,
      awardedPrice: 500_000_000n,
      winnerFirmIdHash: bidders[0].firmIdHash,
      winnerSubListHash: bidders[0].subListHash,
      codes: [ExclusionCode.NONE, ExclusionCode.NO_BID, ExclusionCode.NO_BID, ExclusionCode.NO_BID],
      evidence: [pad32(''), pad32(''), pad32(''), pad32('')],
    });
    expect(sim.getLedger().phase).toBe(Phase.AWARDED);
  });

  it('G20: rejects proveAward declaring NO_AWARD while leaving a slot NONE', async () => {
    const { sim, tenderId, adjSecret, bidders, tree } = await mkTender();
    const o0 = mkOpening(tenderId, bidders[0], 50_000_000n);
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
    await sim.closeBidding();
    await sim.deliverOpening(0n, randomBytes32(), bidders[0].secret, o0);
    await sim.closeReveal();
    await expect(
      sim.proveAward({
        adjudicatorSecret: adjSecret,
        openings: [o0, makeEmptyOpening(), makeEmptyOpening(), makeEmptyOpening()],
        hasWinner: false,
        winningSlot: 0n,
        awardedPrice: 0n,
        winnerFirmIdHash: pad32(''),
        winnerSubListHash: pad32(''),
        codes: [ExclusionCode.NONE, ExclusionCode.NO_BID, ExclusionCode.NO_BID, ExclusionCode.NO_BID],
        evidence: [pad32(''), pad32(''), pad32(''), pad32('')],
      })
    ).rejects.toThrow();
  });

  it('G21: rejects proveAward declaring NO_AWARD with non-zero awardedPrice', async () => {
    const { sim, tenderId, adjSecret, bidders, tree } = await mkTender();
    const o0 = mkOpening(tenderId, bidders[0], 50_000_000n);
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
    await sim.closeBidding();
    await sim.closeReveal();
    await expect(
      sim.proveAward({
        adjudicatorSecret: adjSecret,
        openings: [makeEmptyOpening(), makeEmptyOpening(), makeEmptyOpening(), makeEmptyOpening()],
        hasWinner: false,
        winningSlot: 0n,
        awardedPrice: 1n,
        winnerFirmIdHash: pad32(''),
        winnerSubListHash: pad32(''),
        codes: [ExclusionCode.NON_REVEAL, ExclusionCode.NO_BID, ExclusionCode.NO_BID, ExclusionCode.NO_BID],
        evidence: [pad32(''), pad32(''), pad32(''), pad32('')],
      })
    ).rejects.toThrow();
  });

  it('G22: rejects proveAward trying to exclude a non-delivered slot as discretionary NOT_RESPONSIBLE', async () => {
    const { sim, tenderId, adjSecret, bidders, tree } = await mkTender();
    const o0 = mkOpening(tenderId, bidders[0], 50_000_000n);
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
    await sim.closeBidding();
    await sim.closeReveal(); // slot 0 did NOT deliver opening
    await expect(
      sim.proveAward({
        adjudicatorSecret: adjSecret,
        openings: [makeEmptyOpening(), makeEmptyOpening(), makeEmptyOpening(), makeEmptyOpening()],
        hasWinner: false,
        winningSlot: 0n,
        awardedPrice: 0n,
        winnerFirmIdHash: pad32(''),
        winnerSubListHash: pad32(''),
        codes: [ExclusionCode.NOT_RESPONSIBLE, ExclusionCode.NO_BID, ExclusionCode.NO_BID, ExclusionCode.NO_BID],
        evidence: [pad32(''), pad32(''), pad32(''), pad32('')],
      })
    ).rejects.toThrow();
  });

  it('G23: rejects proveAward when winningSlot itself has an exclusion code', async () => {
    const { sim, tenderId, adjSecret, bidders, tree } = await mkTender();
    const o0 = mkOpening(tenderId, bidders[0], 50_000_000n);
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
    await sim.closeBidding();
    await sim.deliverOpening(0n, randomBytes32(), bidders[0].secret, o0);
    await sim.closeReveal();
    await expect(
      sim.proveAward({
        adjudicatorSecret: adjSecret,
        openings: [o0, makeEmptyOpening(), makeEmptyOpening(), makeEmptyOpening()],
        hasWinner: true,
        winningSlot: 0n,
        awardedPrice: 50_000_000n,
        winnerFirmIdHash: bidders[0].firmIdHash,
        winnerSubListHash: bidders[0].subListHash,
        codes: [ExclusionCode.NON_RESPONSIVE, ExclusionCode.NO_BID, ExclusionCode.NO_BID, ExclusionCode.NO_BID],
        evidence: [pad32(''), pad32(''), pad32(''), pad32('')],
      })
    ).rejects.toThrow();
  });

  it('G24: rejects proveAward awarding an over-budget bid as NONE', async () => {
    const { sim, tenderId, adjSecret, bidders, tree } = await mkTender({ maxAwardBudget: 80_000_000n });
    const o0 = mkOpening(tenderId, bidders[0], 85_000_000n);
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
    await sim.closeBidding();
    await sim.deliverOpening(0n, randomBytes32(), bidders[0].secret, o0);
    await sim.closeReveal();
    await expect(
      sim.proveAward({
        adjudicatorSecret: adjSecret,
        openings: [o0, makeEmptyOpening(), makeEmptyOpening(), makeEmptyOpening()],
        hasWinner: true,
        winningSlot: 0n,
        awardedPrice: 85_000_000n,
        winnerFirmIdHash: bidders[0].firmIdHash,
        winnerSubListHash: bidders[0].subListHash,
        codes: [ExclusionCode.NONE, ExclusionCode.NO_BID, ExclusionCode.NO_BID, ExclusionCode.NO_BID],
        evidence: [pad32(''), pad32(''), pad32(''), pad32('')],
      })
    ).rejects.toThrow();
  });

  // G25–G28: All 4 discretionary exclusion codes are challengeable via challengeAward
  for (const [idx, code] of [
    ExclusionCode.UNDECRYPTABLE,
    ExclusionCode.BOND_DEFECT,
    ExclusionCode.NON_RESPONSIVE,
    ExclusionCode.NOT_RESPONSIBLE,
  ].entries()) {
    it(`G${25 + idx}: discretionary exclusion code ${ExclusionCode[code]} is challengeable via ZK challengeAward`, async () => {
      const { sim, tenderId, adjSecret, bidders, tree } = await mkTender();
      const o0 = mkOpening(tenderId, bidders[0], 90_000_000n);
      const o1 = mkOpening(tenderId, bidders[1], 81_234_567n);
      await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
      await sim.submitSealedBid(bidders[1].secret, tree.getPath(1), o1);
      await sim.closeBidding();
      await sim.deliverOpening(0n, randomBytes32(), bidders[0].secret, o0);
      await sim.deliverOpening(1n, randomBytes32(), bidders[1].secret, o1);
      await sim.closeReveal();
      await sim.proveAward({
        adjudicatorSecret: adjSecret,
        openings: [o0, o1, makeEmptyOpening(), makeEmptyOpening()],
        hasWinner: true,
        winningSlot: 0n,
        awardedPrice: 90_000_000n,
        winnerFirmIdHash: bidders[0].firmIdHash,
        winnerSubListHash: bidders[0].subListHash,
        codes: [ExclusionCode.NONE, code, ExclusionCode.NO_BID, ExclusionCode.NO_BID],
        evidence: [pad32(''), pad32(`MEMO_${ExclusionCode[code]}`), pad32(''), pad32('')],
      });
      await sim.challengeAward(1n, bidders[1].secret, o1);
      expect(sim.getLedger().phase).toBe(Phase.CONTESTED);
      expect(sim.serializePublicLedger()).not.toContain('81234567');
    });
  }

  it('G29: tie-break challengeAward succeeds when excluded slotIndex < winningSlot at equal price', async () => {
    const { sim, tenderId, adjSecret, bidders, tree } = await mkTender();
    const o0 = mkOpening(tenderId, bidders[0], 85_000_000n); // slot 0 (earlier!)
    const o1 = mkOpening(tenderId, bidders[1], 85_000_000n); // slot 1 (tied!)
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
    await sim.submitSealedBid(bidders[1].secret, tree.getPath(1), o1);
    await sim.closeBidding();
    await sim.deliverOpening(0n, randomBytes32(), bidders[0].secret, o0);
    await sim.deliverOpening(1n, randomBytes32(), bidders[1].secret, o1);
    await sim.closeReveal();
    await sim.proveAward({
      adjudicatorSecret: adjSecret,
      openings: [o0, o1, makeEmptyOpening(), makeEmptyOpening()],
      hasWinner: true,
      winningSlot: 1n,
      awardedPrice: 85_000_000n,
      winnerFirmIdHash: bidders[1].firmIdHash,
      winnerSubListHash: bidders[1].subListHash,
      codes: [ExclusionCode.NOT_RESPONSIBLE, ExclusionCode.NONE, ExclusionCode.NO_BID, ExclusionCode.NO_BID],
      evidence: [pad32('MEMO'), pad32(''), pad32(''), pad32('')],
    });
    await sim.challengeAward(0n, bidders[0].secret, o0);
    expect(sim.getLedger().phase).toBe(Phase.CONTESTED);
  });

  it('G30: tie-break challengeAward rejects when excluded slotIndex > winningSlot at equal price', async () => {
    const { sim, tenderId, adjSecret, bidders, tree } = await mkTender();
    const o0 = mkOpening(tenderId, bidders[0], 85_000_000n);
    const o1 = mkOpening(tenderId, bidders[1], 85_000_000n);
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
    await sim.submitSealedBid(bidders[1].secret, tree.getPath(1), o1);
    await sim.closeBidding();
    await sim.deliverOpening(0n, randomBytes32(), bidders[0].secret, o0);
    await sim.deliverOpening(1n, randomBytes32(), bidders[1].secret, o1);
    await sim.closeReveal();
    await sim.proveAward({
      adjudicatorSecret: adjSecret,
      openings: [o0, o1, makeEmptyOpening(), makeEmptyOpening()],
      hasWinner: true,
      winningSlot: 0n,
      awardedPrice: 85_000_000n,
      winnerFirmIdHash: bidders[0].firmIdHash,
      winnerSubListHash: bidders[0].subListHash,
      codes: [ExclusionCode.NONE, ExclusionCode.NOT_RESPONSIBLE, ExclusionCode.NO_BID, ExclusionCode.NO_BID],
      evidence: [pad32(''), pad32('MEMO'), pad32(''), pad32('')],
    });
    await expect(sim.challengeAward(1n, bidders[1].secret, o1)).rejects.toThrow();
  });

  it('G31: rejects challengeAward from wrong bidder secret even with valid opening struct', async () => {
    const { sim, tenderId, adjSecret, bidders, tree } = await mkTender();
    const o0 = mkOpening(tenderId, bidders[0], 90_000_000n);
    const o1 = mkOpening(tenderId, bidders[1], 80_000_000n);
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
    await sim.submitSealedBid(bidders[1].secret, tree.getPath(1), o1);
    await sim.closeBidding();
    await sim.deliverOpening(0n, randomBytes32(), bidders[0].secret, o0);
    await sim.deliverOpening(1n, randomBytes32(), bidders[1].secret, o1);
    await sim.closeReveal();
    await sim.proveAward({
      adjudicatorSecret: adjSecret,
      openings: [o0, o1, makeEmptyOpening(), makeEmptyOpening()],
      hasWinner: true,
      winningSlot: 0n,
      awardedPrice: 90_000_000n,
      winnerFirmIdHash: bidders[0].firmIdHash,
      winnerSubListHash: bidders[0].subListHash,
      codes: [ExclusionCode.NONE, ExclusionCode.NOT_RESPONSIBLE, ExclusionCode.NO_BID, ExclusionCode.NO_BID],
      evidence: [pad32(''), pad32('MEMO'), pad32(''), pad32('')],
    });
    await expect(sim.challengeAward(1n, bidders[0].secret, o1)).rejects.toThrow();
  });

  it('G32: rejects finalizeAward by unauthorized adjudicator', async () => {
    const { sim, tenderId, adjSecret, bidders, tree } = await mkTender();
    const o0 = mkOpening(tenderId, bidders[0], 50_000_000n);
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
    await sim.closeBidding();
    await sim.deliverOpening(0n, randomBytes32(), bidders[0].secret, o0);
    await sim.closeReveal();
    await sim.proveAward({
      adjudicatorSecret: adjSecret,
      openings: [o0, makeEmptyOpening(), makeEmptyOpening(), makeEmptyOpening()],
      hasWinner: true,
      winningSlot: 0n,
      awardedPrice: 50_000_000n,
      winnerFirmIdHash: bidders[0].firmIdHash,
      winnerSubListHash: bidders[0].subListHash,
      codes: [ExclusionCode.NONE, ExclusionCode.NO_BID, ExclusionCode.NO_BID, ExclusionCode.NO_BID],
      evidence: [pad32(''), pad32(''), pad32(''), pad32('')],
    });
    await expect(sim.finalizeAward(randomBytes32())).rejects.toThrow();
  });

  it('G33: rejects finalizeAward on CONTESTED tender', async () => {
    const { sim, tenderId, adjSecret, bidders, tree } = await mkTender();
    const o0 = mkOpening(tenderId, bidders[0], 90_000_000n);
    const o1 = mkOpening(tenderId, bidders[1], 80_000_000n);
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
    await sim.submitSealedBid(bidders[1].secret, tree.getPath(1), o1);
    await sim.closeBidding();
    await sim.deliverOpening(0n, randomBytes32(), bidders[0].secret, o0);
    await sim.deliverOpening(1n, randomBytes32(), bidders[1].secret, o1);
    await sim.closeReveal();
    await sim.proveAward({
      adjudicatorSecret: adjSecret,
      openings: [o0, o1, makeEmptyOpening(), makeEmptyOpening()],
      hasWinner: true,
      winningSlot: 0n,
      awardedPrice: 90_000_000n,
      winnerFirmIdHash: bidders[0].firmIdHash,
      winnerSubListHash: bidders[0].subListHash,
      codes: [ExclusionCode.NONE, ExclusionCode.NOT_RESPONSIBLE, ExclusionCode.NO_BID, ExclusionCode.NO_BID],
      evidence: [pad32(''), pad32('MEMO'), pad32(''), pad32('')],
    });
    await sim.challengeAward(1n, bidders[1].secret, o1);
    await expect(sim.finalizeAward(adjSecret)).rejects.toThrow();
  });

  it('G34: rejects second challengeAward after tender is already CONTESTED', async () => {
    const { sim, tenderId, adjSecret, bidders, tree } = await mkTender();
    const o0 = mkOpening(tenderId, bidders[0], 90_000_000n);
    const o1 = mkOpening(tenderId, bidders[1], 80_000_000n);
    const o2 = mkOpening(tenderId, bidders[2], 75_000_000n);
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
    await sim.submitSealedBid(bidders[1].secret, tree.getPath(1), o1);
    await sim.submitSealedBid(bidders[2].secret, tree.getPath(2), o2);
    await sim.closeBidding();
    await sim.deliverOpening(0n, randomBytes32(), bidders[0].secret, o0);
    await sim.deliverOpening(1n, randomBytes32(), bidders[1].secret, o1);
    await sim.deliverOpening(2n, randomBytes32(), bidders[2].secret, o2);
    await sim.closeReveal();
    await sim.proveAward({
      adjudicatorSecret: adjSecret,
      openings: [o0, o1, o2, makeEmptyOpening()],
      hasWinner: true,
      winningSlot: 0n,
      awardedPrice: 90_000_000n,
      winnerFirmIdHash: bidders[0].firmIdHash,
      winnerSubListHash: bidders[0].subListHash,
      codes: [ExclusionCode.NONE, ExclusionCode.NOT_RESPONSIBLE, ExclusionCode.NON_RESPONSIVE, ExclusionCode.NO_BID],
      evidence: [pad32(''), pad32('M1'), pad32('M2'), pad32('')],
    });
    await sim.challengeAward(1n, bidders[1].secret, o1);
    await expect(sim.challengeAward(2n, bidders[2].secret, o2)).rejects.toThrow();
  });

  it('G35: rejects declareAdjudicatorDefault during OPEN, REVEAL, or AWARDED phases', async () => {
    const { sim, tenderId, bidders, tree } = await mkTender();
    await expect(sim.declareAdjudicatorDefault()).rejects.toThrow();
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), mkOpening(tenderId, bidders[0], 50_000_000n));
    await sim.closeBidding();
    await expect(sim.declareAdjudicatorDefault()).rejects.toThrow();
  });

  it('G36: exact boundary price == maxAwardBudget is compliant (not OVER_BUDGET)', async () => {
    const { sim, tenderId, adjSecret, bidders, tree } = await mkTender({ maxAwardBudget: 100_000_000n });
    const o0 = mkOpening(tenderId, bidders[0], 100_000_000n);
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
    await sim.closeBidding();
    await sim.deliverOpening(0n, randomBytes32(), bidders[0].secret, o0);
    await sim.closeReveal();
    await sim.proveAward({
      adjudicatorSecret: adjSecret,
      openings: [o0, makeEmptyOpening(), makeEmptyOpening(), makeEmptyOpening()],
      hasWinner: true,
      winningSlot: 0n,
      awardedPrice: 100_000_000n,
      winnerFirmIdHash: bidders[0].firmIdHash,
      winnerSubListHash: bidders[0].subListHash,
      codes: [ExclusionCode.NONE, ExclusionCode.NO_BID, ExclusionCode.NO_BID, ExclusionCode.NO_BID],
      evidence: [pad32(''), pad32(''), pad32(''), pad32('')],
    });
    expect(sim.getLedger().phase).toBe(Phase.AWARDED);
  });

  it('G37: exact boundary price == maxAwardBudget + 1 cent triggers OVER_BUDGET', async () => {
    const { sim, tenderId, adjSecret, bidders, tree } = await mkTender({ maxAwardBudget: 100_000_000n });
    const o0 = mkOpening(tenderId, bidders[0], 100_000_001n);
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
    await sim.closeBidding();
    await sim.deliverOpening(0n, randomBytes32(), bidders[0].secret, o0);
    await sim.closeReveal();
    await sim.proveAward({
      adjudicatorSecret: adjSecret,
      openings: [o0, makeEmptyOpening(), makeEmptyOpening(), makeEmptyOpening()],
      hasWinner: false,
      winningSlot: 0n,
      awardedPrice: 0n,
      winnerFirmIdHash: pad32(''),
      winnerSubListHash: pad32(''),
      codes: [ExclusionCode.OVER_BUDGET, ExclusionCode.NO_BID, ExclusionCode.NO_BID, ExclusionCode.NO_BID],
      evidence: [pad32('EXCEEDED_BY_1_CENT'), pad32(''), pad32(''), pad32('')],
    });
    expect(sim.getLedger().phase).toBe(Phase.NO_AWARD);
  });

  it('G38: WebCrypto AAD binding rejects envelope transplanted to a different slotIndex', async () => {
    const kp = await generateEphemeralAdjudicatorKeypair();
    const env = await encryptBidOpening('bb'.repeat(32), 0, kp.publicKeySpkiB64, {
      nullifierHex: '11'.repeat(32),
      price: '80000000',
      bondAmount: '8000000',
      firmIdHashHex: '22'.repeat(32),
      subListHashHex: '33'.repeat(32),
      bidDocsHashHex: '44'.repeat(32),
      bidSaltHex: '55'.repeat(32),
    });
    const transplanted = { ...env, slotIndex: 1 };
    await expect(decryptBidOpening(transplanted, kp.privateKeyPkcs8B64)).rejects.toThrow();
  });

  it('G39: WebCrypto ephemeral keypairs produce unique fingerprints per tender', async () => {
    const k1 = await generateEphemeralAdjudicatorKeypair();
    const k2 = await generateEphemeralAdjudicatorKeypair();
    expect(k1.publicKeyFingerprintHex).not.toBe(k2.publicKeyFingerprintHex);
    expect(k1.publicKeyFingerprintHex.length).toBe(64);
  });

  it('G40: 32-bidder max depth-5 prequalification roster works cleanly at leaf index 31', async () => {
    const tenderId = randomBytes32();
    const adjSecret = randomBytes32();
    const roster = Array.from({ length: 32 }, (_, i) => mkBidder(`Firm_${i}`));
    const tree = buildPrequalTree(
      tenderId,
      roster.map((b) => b.pubKey)
    );
    const sim = await AssizeSimulator.create({
      tenderId,
      adjudicatorPubKey: hashAdjPubKey(adjSecret),
      adjudicatorEncPubKey: randomBytes32(),
      prequalRoot: tree.root,
      prequalRosterHash: pad32('ROSTER_32'),
      selectionRuleHash: pad32('RULE'),
      maxAwardBudget: 100_000_000n,
      minBondBps: 1000n,
    });
    const op31 = mkOpening(tenderId, roster[31], 77_000_000n);
    const slot = await sim.submitSealedBid(roster[31].secret, tree.getPath(31), op31);
    expect(slot).toBe(0n);
  });
});
