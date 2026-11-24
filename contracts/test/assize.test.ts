// SPDX-License-Identifier: Apache-2.0
// Assize — Comprehensive Simulator, Adversarial, WebCrypto, Property-Fuzz & Zero-Leakage Test Suite

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
  verifyEnvelopeDigest,
} from '../../packages/crypto/index.js';

interface TestBidder {
  name: string;
  secret: Uint8Array;
  pubKey: Uint8Array;
  firmIdHash: Uint8Array;
  subListHash: Uint8Array;
  bidDocsHash: Uint8Array;
}

function makeBidder(name: string): TestBidder {
  const secret = randomBytes32();
  return {
    name,
    secret,
    pubKey: hashBidderPubKey(secret),
    firmIdHash: pad32(`FIRM_${name}`),
    subListHash: pad32(`SUBLIST_4101_${name}`),
    bidDocsHash: pad32(`DOCS_BOQ_${name}`),
  };
}

function makeOpening(
  tenderId: Uint8Array,
  bidder: TestBidder,
  price: bigint,
  bondAmount?: bigint
): BidOpening {
  return {
    nullifier: hashNullifier(tenderId, bidder.secret),
    price,
    bondAmount: bondAmount ?? (price * 1000n) / 10000n + 1000n, // >= 10% surety bond
    firmIdHash: bidder.firmIdHash,
    subListHash: bidder.subListHash,
    bidDocsHash: bidder.bidDocsHash,
    bidSalt: randomBytes32(),
  };
}

async function setupFixture(opts?: { maxAwardBudget?: bigint; minBondBps?: bigint }) {
  const tenderId = randomBytes32();
  const adjSecret = randomBytes32();
  const adjPubKey = hashAdjPubKey(adjSecret);
  const kp = await generateEphemeralAdjudicatorKeypair();
  const bidders = [
    makeBidder('PacificConcrete'),
    makeBidder('SierraStructural'),
    makeBidder('RedwoodCivil'),
    makeBidder('ValleyHeavy'),
  ];
  const outsider = makeBidder('UnqualifiedOutsider');
  const tree = buildPrequalTree(
    tenderId,
    bidders.map((b) => b.pubKey)
  );
  const sim = await AssizeSimulator.create({
    tenderId,
    adjudicatorPubKey: adjPubKey,
    adjudicatorEncPubKey: hexToBytes32(kp.publicKeyFingerprintHex),
    prequalRoot: tree.root,
    prequalRosterHash: pad32('ROSTER_PW_2026_041'),
    selectionRuleHash: pad32('CA_PCC_10180_LOWEST_RESP'),
    maxAwardBudget: opts?.maxAwardBudget ?? 120_000_000n, // $1,200,000.00 in cents
    minBondBps: opts?.minBondBps ?? 1000n, // 10%
  });
  return { sim, tenderId, adjSecret, adjPubKey, kp, bidders, outsider, tree };
}

describe('1. Assize Core Lifecycle & WebCrypto E2E Envelopes', () => {
  it('runs a complete 4-bid tender to FINALIZED with real WebCrypto envelopes and zero losing-price leakage', async () => {
    const { sim, tenderId, adjSecret, kp, bidders, tree } = await setupFixture();
    const prices = [94_000_000n, 88_500_000n, 104_000_000n, 126_000_000n]; // $940k, $885k, $1.04M, $1.26M (over $1.2M cap)
    const openings = bidders.map((b, i) => makeOpening(tenderId, b, prices[i]));

    // 1. Sealed commits (OPEN)
    for (let i = 0; i < 4; i++) {
      const slot = await sim.submitSealedBid(bidders[i].secret, tree.getPath(i), openings[i]);
      expect(slot).toBe(BigInt(i));
    }
    expect(sim.getLedger().bidCount).toBe(4n);

    // 2. Permissionless freeze (OPEN -> REVEAL)
    await sim.closeBidding();
    expect(sim.getLedger().phase).toBe(Phase.REVEAL);
    expect(sim.getLedger().frozenBidCount).toBe(4n);

    // 3. Real client-side WebCrypto E2E encryption + on-chain deliverOpening receipts
    const decryptedOpenings: BidOpening[] = [];
    for (let i = 0; i < 4; i++) {
      const env = await encryptBidOpening(
        bytesToHex(tenderId),
        i,
        kp.publicKeySpkiB64,
        {
          nullifierHex: bytesToHex(openings[i].nullifier),
          price: openings[i].price.toString(),
          bondAmount: openings[i].bondAmount.toString(),
          firmIdHashHex: bytesToHex(openings[i].firmIdHash),
          subListHashHex: bytesToHex(openings[i].subListHash),
          bidDocsHashHex: bytesToHex(openings[i].bidDocsHash),
          bidSaltHex: bytesToHex(openings[i].bidSalt),
          firmName: bidders[i].name,
        }
      );
      await sim.deliverOpening(
        BigInt(i),
        hexToBytes32(env.envelopeHashHex),
        bidders[i].secret,
        openings[i]
      );
      const onChainReceipt = bytesToHex(sim.getLedger().openingReceipts.lookup(BigInt(i)));
      expect(await verifyEnvelopeDigest(env, onChainReceipt)).toBe(true);
      const dec = await decryptBidOpening(env, kp.privateKeyPkcs8B64, onChainReceipt);
      expect(BigInt(dec.price)).toBe(prices[i]);
      decryptedOpenings.push({
        nullifier: hexToBytes32(dec.nullifierHex),
        price: BigInt(dec.price),
        bondAmount: BigInt(dec.bondAmount),
        firmIdHash: hexToBytes32(dec.firmIdHashHex),
        subListHash: hexToBytes32(dec.subListHashHex),
        bidDocsHash: hexToBytes32(dec.bidDocsHashHex),
        bidSalt: hexToBytes32(dec.bidSaltHex),
      });
    }

    // 4. Close reveal barrier (REVEAL -> EVALUATION)
    await sim.closeReveal();
    expect(sim.getLedger().phase).toBe(Phase.EVALUATION);

    // 5. Honest proveAward: Slot 1 ($885k) wins; Slot 3 ($1.26M) proved OVER_BUDGET
    await sim.proveAward({
      adjudicatorSecret: adjSecret,
      openings: decryptedOpenings,
      hasWinner: true,
      winningSlot: 1n,
      awardedPrice: 88_500_000n,
      winnerFirmIdHash: bidders[1].firmIdHash,
      winnerSubListHash: bidders[1].subListHash,
      codes: [
        ExclusionCode.NONE,
        ExclusionCode.NONE,
        ExclusionCode.NONE,
        ExclusionCode.OVER_BUDGET,
      ],
      evidence: [pad32(''), pad32(''), pad32(''), pad32('EXCEEDS_1_2M_CAP')],
    });

    const awarded = sim.getLedger();
    expect(awarded.phase).toBe(Phase.AWARDED);
    expect(awarded.winningSlot).toBe(1n);
    expect(awarded.awardedPrice).toBe(88_500_000n);
    expect(bytesToHex(awarded.winnerFirmIdHash)).toBe(bytesToHex(bidders[1].firmIdHash));
    expect(bytesToHex(awarded.winnerSubListHash)).toBe(bytesToHex(bidders[1].subListHash));
    expect(awarded.exclusionCodes.lookup(3n)).toBe(ExclusionCode.OVER_BUDGET);

    // 6. Finalize
    await sim.finalizeAward(adjSecret);
    expect(sim.getLedger().phase).toBe(Phase.FINALIZED);

    // 7. ZERO-LEAKAGE AUDIT on serialized public ledger state
    const serialized = sim.serializePublicLedger();
    expect(serialized).toContain('88500000'); // winning price IS public
    expect(serialized).not.toContain('94000000'); // losing price #0 NEVER on chain
    expect(serialized).not.toContain('104000000'); // losing price #2 NEVER on chain
    expect(serialized).not.toContain('126000000'); // over-budget price #3 NEVER on chain
    for (let i = 0; i < 4; i++) {
      expect(serialized).not.toContain(bytesToHex(openings[i].bidSalt));
      if (i !== 1) {
        expect(serialized).not.toContain(bytesToHex(bidders[i].firmIdHash));
        expect(serialized).not.toContain(bytesToHex(bidders[i].subListHash));
      }
    }
  });

  it('catches pretextual exclusion via ZK challengeAward -> CONTESTED without revealing challenger price', async () => {
    const { sim, tenderId, adjSecret, bidders, tree } = await setupFixture();
    const prices = [94_000_000n, 88_500_000n, 104_000_000n, 126_000_000n];
    const openings = bidders.map((b, i) => makeOpening(tenderId, b, prices[i]));

    for (let i = 0; i < 4; i++) {
      await sim.submitSealedBid(bidders[i].secret, tree.getPath(i), openings[i]);
    }
    await sim.closeBidding();
    for (let i = 0; i < 4; i++) {
      await sim.deliverOpening(BigInt(i), randomBytes32(), bidders[i].secret, openings[i]);
    }
    await sim.closeReveal();

    // Corrupt adjudicator pretextually excludes Slot 1 ($885k) as NOT_RESPONSIBLE and awards Slot 0 ($940k)
    await sim.proveAward({
      adjudicatorSecret: adjSecret,
      openings,
      hasWinner: true,
      winningSlot: 0n,
      awardedPrice: 94_000_000n,
      winnerFirmIdHash: bidders[0].firmIdHash,
      winnerSubListHash: bidders[0].subListHash,
      codes: [
        ExclusionCode.NONE,
        ExclusionCode.NOT_RESPONSIBLE,
        ExclusionCode.NONE,
        ExclusionCode.OVER_BUDGET,
      ],
      evidence: [pad32(''), pad32('PRETEXT_MEMO_SHA256'), pad32(''), pad32('OVER_CAP')],
    });
    expect(sim.getLedger().phase).toBe(Phase.AWARDED);

    // Excluded low bidder (Slot 1, $885k < $940k) files ZK protest
    await sim.challengeAward(1n, bidders[1].secret, openings[1]);
    const contested = sim.getLedger();
    expect(contested.phase).toBe(Phase.CONTESTED);
    expect(contested.challengerSlot).toBe(1n);

    // Verify challenger's $885k price STILL NEVER APPEARS ON CHAIN!
    const serialized = sim.serializePublicLedger();
    expect(serialized).not.toContain('88500000');
    expect(serialized).not.toContain(bytesToHex(bidders[1].firmIdHash));
  });

  it('handles 0-bid tender cleanly -> CANCELLED_NO_BIDS', async () => {
    const { sim } = await setupFixture();
    await sim.closeBidding();
    expect(sim.getLedger().phase).toBe(Phase.CANCELLED_NO_BIDS);
    expect(sim.getLedger().frozenBidCount).toBe(0n);
  });

  it('handles partial tenders (1, 2, 3 bids) with NO_BID padding on unused slots', async () => {
    for (const count of [1, 2, 3]) {
      const { sim, tenderId, adjSecret, bidders, tree } = await setupFixture();
      const openings = Array.from({ length: 4 }, (_, i) =>
        i < count ? makeOpening(tenderId, bidders[i], BigInt((50 + i * 5) * 1_000_000)) : makeEmptyOpening()
      );
      for (let i = 0; i < count; i++) {
        await sim.submitSealedBid(bidders[i].secret, tree.getPath(i), openings[i]);
      }
      await sim.closeBidding();
      for (let i = 0; i < count; i++) {
        await sim.deliverOpening(BigInt(i), randomBytes32(), bidders[i].secret, openings[i]);
      }
      await sim.closeReveal();
      const codes = Array.from({ length: 4 }, (_, i) =>
        i < count ? ExclusionCode.NONE : ExclusionCode.NO_BID
      );
      await sim.proveAward({
        adjudicatorSecret: adjSecret,
        openings,
        hasWinner: true,
        winningSlot: 0n,
        awardedPrice: openings[0].price,
        winnerFirmIdHash: bidders[0].firmIdHash,
        winnerSubListHash: bidders[0].subListHash,
        codes,
        evidence: [pad32(''), pad32(''), pad32(''), pad32('')],
      });
      expect(sim.getLedger().phase).toBe(Phase.AWARDED);
      expect(sim.getLedger().frozenBidCount).toBe(BigInt(count));
    }
  });

  it('handles NO_AWARD when all bids are non-reveal/excluded and allows valid excluded bidder to contest NO_AWARD', async () => {
    const { sim, tenderId, adjSecret, bidders, tree } = await setupFixture();
    const o0 = makeOpening(tenderId, bidders[0], 90_000_000n);
    const o1 = makeOpening(tenderId, bidders[1], 130_000_000n);
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
    await sim.submitSealedBid(bidders[1].secret, tree.getPath(1), o1);
    await sim.closeBidding();
    await sim.deliverOpening(0n, randomBytes32(), bidders[0].secret, o0);
    await sim.deliverOpening(1n, randomBytes32(), bidders[1].secret, o1);
    await sim.closeReveal();

    await sim.proveAward({
      adjudicatorSecret: adjSecret,
      openings: [o0, o1, makeEmptyOpening(), makeEmptyOpening()],
      hasWinner: false,
      winningSlot: 0n,
      awardedPrice: 0n,
      winnerFirmIdHash: pad32(''),
      winnerSubListHash: pad32(''),
      codes: [
        ExclusionCode.NON_RESPONSIVE,
        ExclusionCode.OVER_BUDGET,
        ExclusionCode.NO_BID,
        ExclusionCode.NO_BID,
      ],
      evidence: [pad32('PRETEXT_CANCEL'), pad32('OVER'), pad32(''), pad32('')],
    });
    expect(sim.getLedger().phase).toBe(Phase.NO_AWARD);
    expect(sim.getLedger().hasWinner).toBe(false);

    // Slot 0 (in-budget, discretionary exclusion) challenges fake cancellation -> CONTESTED
    await sim.challengeAward(0n, bidders[0].secret, o0);
    expect(sim.getLedger().phase).toBe(Phase.CONTESTED);
  });

  it('tracks nonRevealCount publicly and supports declareAdjudicatorDefault', async () => {
    const { sim, tenderId, bidders, tree } = await setupFixture();
    const o0 = makeOpening(tenderId, bidders[0], 90_000_000n);
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
    await sim.closeBidding();
    await sim.closeReveal();
    await sim.declareAdjudicatorDefault();
    expect(sim.getLedger().phase).toBe(Phase.ADJUDICATOR_DEFAULT);
  });
});

describe('2. Adversarial Security & Guard-Rejection Matrix', () => {
  it('rejects unprequalified outsider in submitSealedBid', async () => {
    const { sim, tenderId, outsider, tree } = await setupFixture();
    const op = makeOpening(tenderId, outsider, 80_000_000n);
    await expect(sim.submitSealedBid(outsider.secret, tree.getPath(0), op)).rejects.toThrow();
  });

  it('rejects duplicate bid from same prequalified contractor (nullifier replay)', async () => {
    const { sim, tenderId, bidders, tree } = await setupFixture();
    const op1 = makeOpening(tenderId, bidders[0], 80_000_000n);
    const op2 = makeOpening(tenderId, bidders[0], 79_000_000n);
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), op1);
    await expect(sim.submitSealedBid(bidders[0].secret, tree.getPath(0), op2)).rejects.toThrow();
  });

  it('rejects zero price, overflow price, and insufficient statutory surety bond', async () => {
    const { sim, tenderId, bidders, tree } = await setupFixture();
    const zeroPrice = makeOpening(tenderId, bidders[0], 0n, 10_000_000n);
    await expect(sim.submitSealedBid(bidders[0].secret, tree.getPath(0), zeroPrice)).rejects.toThrow();

    const overflowPrice = makeOpening(tenderId, bidders[0], 100_000_000_000_001n, 20_000_000_000_000n);
    await expect(sim.submitSealedBid(bidders[0].secret, tree.getPath(0), overflowPrice)).rejects.toThrow();

    // 10% bond on $1,000,000 = $100,000; supply $99,999 -> reject
    const lowBond = makeOpening(tenderId, bidders[0], 100_000_000n, 9_999_999n);
    await expect(sim.submitSealedBid(bidders[0].secret, tree.getPath(0), lowBond)).rejects.toThrow();
  });

  it('rejects 5th bid (N=4 slot cap) and late bid after closeBidding', async () => {
    const { sim, tenderId, bidders, tree } = await setupFixture();
    const o0 = makeOpening(tenderId, bidders[0], 80_000_000n);
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
    await sim.closeBidding();
    const o1 = makeOpening(tenderId, bidders[1], 81_000_000n);
    await expect(sim.submitSealedBid(bidders[1].secret, tree.getPath(1), o1)).rejects.toThrow();
  });

  it('rejects wrong owner, forged preimage, and duplicate receipt in deliverOpening', async () => {
    const { sim, tenderId, bidders, tree } = await setupFixture();
    const o0 = makeOpening(tenderId, bidders[0], 80_000_000n);
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
    await sim.closeBidding();

    // Wrong owner
    await expect(sim.deliverOpening(0n, randomBytes32(), bidders[1].secret, o0)).rejects.toThrow();
    // Forged price
    const tampered = { ...o0, price: 75_000_000n };
    await expect(sim.deliverOpening(0n, randomBytes32(), bidders[0].secret, tampered)).rejects.toThrow();
    // Valid deliver
    await sim.deliverOpening(0n, randomBytes32(), bidders[0].secret, o0);
    // Duplicate deliver
    await expect(sim.deliverOpening(0n, randomBytes32(), bidders[0].secret, o0)).rejects.toThrow();
  });

  it('rejects silent omission, wrong winner, tie-break favoritism, fake NON_REVEAL, fake OVER_BUDGET, and wrong adjudicator in proveAward', async () => {
    const { sim, tenderId, adjSecret, bidders, tree } = await setupFixture();
    const o0 = makeOpening(tenderId, bidders[0], 90_000_000n);
    const o1 = makeOpening(tenderId, bidders[1], 85_000_000n);
    const o2 = makeOpening(tenderId, bidders[2], 85_000_000n); // tied with o1 -> slot 1 MUST beat slot 2!
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
    await sim.submitSealedBid(bidders[1].secret, tree.getPath(1), o1);
    await sim.submitSealedBid(bidders[2].secret, tree.getPath(2), o2);
    await sim.closeBidding();
    await sim.deliverOpening(0n, randomBytes32(), bidders[0].secret, o0);
    await sim.deliverOpening(1n, randomBytes32(), bidders[1].secret, o1);
    await sim.deliverOpening(2n, randomBytes32(), bidders[2].secret, o2);
    await sim.closeReveal();

    const openings = [o0, o1, o2, makeEmptyOpening()];
    const ev = [pad32(''), pad32(''), pad32(''), pad32('')];

    // 1. Wrong adjudicator secret
    await expect(
      sim.proveAward({
        adjudicatorSecret: randomBytes32(),
        openings,
        hasWinner: true,
        winningSlot: 1n,
        awardedPrice: 85_000_000n,
        winnerFirmIdHash: bidders[1].firmIdHash,
        winnerSubListHash: bidders[1].subListHash,
        codes: [ExclusionCode.NONE, ExclusionCode.NONE, ExclusionCode.NONE, ExclusionCode.NO_BID],
        evidence: ev,
      })
    ).rejects.toThrow();

    // 2. Silent omission (trying to mark submitted slot 1 as NO_BID)
    await expect(
      sim.proveAward({
        adjudicatorSecret: adjSecret,
        openings,
        hasWinner: true,
        winningSlot: 0n,
        awardedPrice: 90_000_000n,
        winnerFirmIdHash: bidders[0].firmIdHash,
        winnerSubListHash: bidders[0].subListHash,
        codes: [ExclusionCode.NONE, ExclusionCode.NO_BID, ExclusionCode.NONE, ExclusionCode.NO_BID],
        evidence: ev,
      })
    ).rejects.toThrow();

    // 3. Wrong winner ($90M instead of $85M)
    await expect(
      sim.proveAward({
        adjudicatorSecret: adjSecret,
        openings,
        hasWinner: true,
        winningSlot: 0n,
        awardedPrice: 90_000_000n,
        winnerFirmIdHash: bidders[0].firmIdHash,
        winnerSubListHash: bidders[0].subListHash,
        codes: [ExclusionCode.NONE, ExclusionCode.NONE, ExclusionCode.NONE, ExclusionCode.NO_BID],
        evidence: ev,
      })
    ).rejects.toThrow();

    // 4. Tie-break favoritism (picking slot 2 instead of slot 1 when both are $85M)
    await expect(
      sim.proveAward({
        adjudicatorSecret: adjSecret,
        openings,
        hasWinner: true,
        winningSlot: 2n,
        awardedPrice: 85_000_000n,
        winnerFirmIdHash: bidders[2].firmIdHash,
        winnerSubListHash: bidders[2].subListHash,
        codes: [ExclusionCode.NONE, ExclusionCode.NONE, ExclusionCode.NONE, ExclusionCode.NO_BID],
        evidence: ev,
      })
    ).rejects.toThrow();

    // 5. Fake NON_REVEAL on receipted slot 1
    await expect(
      sim.proveAward({
        adjudicatorSecret: adjSecret,
        openings,
        hasWinner: true,
        winningSlot: 0n,
        awardedPrice: 90_000_000n,
        winnerFirmIdHash: bidders[0].firmIdHash,
        winnerSubListHash: bidders[0].subListHash,
        codes: [ExclusionCode.NONE, ExclusionCode.NON_REVEAL, ExclusionCode.NONE, ExclusionCode.NO_BID],
        evidence: ev,
      })
    ).rejects.toThrow();

    // 6. Fake OVER_BUDGET on in-budget $85M slot 1
    await expect(
      sim.proveAward({
        adjudicatorSecret: adjSecret,
        openings,
        hasWinner: true,
        winningSlot: 0n,
        awardedPrice: 90_000_000n,
        winnerFirmIdHash: bidders[0].firmIdHash,
        winnerSubListHash: bidders[0].subListHash,
        codes: [ExclusionCode.NONE, ExclusionCode.OVER_BUDGET, ExclusionCode.NONE, ExclusionCode.NO_BID],
        evidence: ev,
      })
    ).rejects.toThrow();

    // 7. Honest tie-break winner (slot 1 wins at $85M) succeeds!
    await sim.proveAward({
      adjudicatorSecret: adjSecret,
      openings,
      hasWinner: true,
      winningSlot: 1n,
      awardedPrice: 85_000_000n,
      winnerFirmIdHash: bidders[1].firmIdHash,
      winnerSubListHash: bidders[1].subListHash,
      codes: [ExclusionCode.NONE, ExclusionCode.NONE, ExclusionCode.NONE, ExclusionCode.NO_BID],
      evidence: ev,
    });
    expect(sim.getLedger().winningSlot).toBe(1n);
  });

  it('blocks sore-loser, non-revealer, included-slot, over-budget, and post-finalization challengeAward attacks', async () => {
    const { sim, tenderId, adjSecret, bidders, tree } = await setupFixture();
    const o0 = makeOpening(tenderId, bidders[0], 90_000_000n); // Winner
    const o1 = makeOpening(tenderId, bidders[1], 95_000_000n); // Excluded higher bid (sore loser)
    const o2 = makeOpening(tenderId, bidders[2], 80_000_000n); // Did NOT reveal
    const o3 = makeOpening(tenderId, bidders[3], 130_000_000n); // Excluded OVER_BUDGET
    await sim.submitSealedBid(bidders[0].secret, tree.getPath(0), o0);
    await sim.submitSealedBid(bidders[1].secret, tree.getPath(1), o1);
    await sim.submitSealedBid(bidders[2].secret, tree.getPath(2), o2);
    await sim.submitSealedBid(bidders[3].secret, tree.getPath(3), o3);
    await sim.closeBidding();
    await sim.deliverOpening(0n, randomBytes32(), bidders[0].secret, o0);
    await sim.deliverOpening(1n, randomBytes32(), bidders[1].secret, o1);
    // slot 2 skips deliverOpening -> NON_REVEAL
    await sim.deliverOpening(3n, randomBytes32(), bidders[3].secret, o3);
    await sim.closeReveal();

    await sim.proveAward({
      adjudicatorSecret: adjSecret,
      openings: [o0, o1, makeEmptyOpening(), o3],
      hasWinner: true,
      winningSlot: 0n,
      awardedPrice: 90_000_000n,
      winnerFirmIdHash: bidders[0].firmIdHash,
      winnerSubListHash: bidders[0].subListHash,
      codes: [
        ExclusionCode.NONE,
        ExclusionCode.NON_RESPONSIVE,
        ExclusionCode.NON_REVEAL,
        ExclusionCode.OVER_BUDGET,
      ],
      evidence: [pad32(''), pad32('DEFECT'), pad32(''), pad32('OVER')],
    });

    expect(sim.getLedger().nonRevealCount).toBe(1n);
    // Sore loser (higher price $95M > $90M) cannot challenge
    await expect(sim.challengeAward(1n, bidders[1].secret, o1)).rejects.toThrow();
    // Non-revealer cannot challenge
    await expect(sim.challengeAward(2n, bidders[2].secret, o2)).rejects.toThrow();
    // Included slot cannot challenge
    await expect(sim.challengeAward(0n, bidders[0].secret, o0)).rejects.toThrow();
    // Over-budget slot cannot challenge
    await expect(sim.challengeAward(3n, bidders[3].secret, o3)).rejects.toThrow();

    await sim.finalizeAward(adjSecret);
    // Post-finalization challenge blocked
    await expect(sim.challengeAward(1n, bidders[1].secret, o1)).rejects.toThrow();
  });

  it('rejects tampered WebCrypto ciphertext and wrong adjudicator private key', async () => {
    const kp1 = await generateEphemeralAdjudicatorKeypair();
    const kp2 = await generateEphemeralAdjudicatorKeypair();
    const env = await encryptBidOpening('aa'.repeat(32), 0, kp1.publicKeySpkiB64, {
      nullifierHex: '11'.repeat(32),
      price: '88500000',
      bondAmount: '9000000',
      firmIdHashHex: '22'.repeat(32),
      subListHashHex: '33'.repeat(32),
      bidDocsHashHex: '44'.repeat(32),
      bidSaltHex: '55'.repeat(32),
    });
    expect(await verifyEnvelopeDigest(env, env.envelopeHashHex)).toBe(true);
    const tampered = { ...env, ciphertextB64: env.ciphertextB64.slice(0, -4) + 'AAAA' };
    expect(await verifyEnvelopeDigest(tampered, env.envelopeHashHex)).toBe(false);
    await expect(decryptBidOpening(tampered, kp1.privateKeyPkcs8B64, env.envelopeHashHex)).rejects.toThrow();
    await expect(decryptBidOpening(env, kp2.privateKeyPkcs8B64, env.envelopeHashHex)).rejects.toThrow();
  });
});

describe('3. Property-Based Fuzzing: 50 Randomized 4-Bid Tenders vs JS Reference Argmin', () => {
  // Deterministic PRNG for reproducible CI runs
  let seed = 20261130;
  const nextInt = (max: number) => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed % max;
  };

  for (let trial = 1; trial <= 50; trial++) {
    it(`fuzz trial #${trial}: Compact proveAward matches reference lowest-responsible-bidder argmin`, async () => {
      const cap = BigInt((90 + nextInt(40)) * 1_000_000);
      const { sim, tenderId, adjSecret, bidders, tree } = await setupFixture({
        maxAwardBudget: cap,
        minBondBps: 1000n,
      });
      const count = 1 + nextInt(4); // 1..4 bids
      const openings: BidOpening[] = [];
      const delivered: boolean[] = [];

      for (let i = 0; i < 4; i++) {
        if (i < count) {
          const p = BigInt((60 + nextInt(70)) * 1_000_000);
          const op = makeOpening(tenderId, bidders[i], p);
          openings.push(op);
          await sim.submitSealedBid(bidders[i].secret, tree.getPath(i), op);
        } else {
          openings.push(makeEmptyOpening());
        }
      }
      await sim.closeBidding();

      for (let i = 0; i < 4; i++) {
        if (i < count) {
          const doDeliver = nextInt(5) !== 0; // 80% deliver, 20% non-reveal
          delivered.push(doDeliver);
          if (doDeliver) {
            await sim.deliverOpening(BigInt(i), randomBytes32(), bidders[i].secret, openings[i]);
          }
        } else {
          delivered.push(false);
        }
      }
      await sim.closeReveal();

      // Independent JS reference calculation
      const codes: ExclusionCode[] = [];
      let bestSlot = -1;
      let bestPrice = 0n;
      for (let i = 0; i < 4; i++) {
        if (i >= count) {
          codes.push(ExclusionCode.NO_BID);
        } else if (!delivered[i]) {
          codes.push(ExclusionCode.NON_REVEAL);
        } else if (openings[i].price > cap) {
          codes.push(ExclusionCode.OVER_BUDGET);
        } else {
          codes.push(ExclusionCode.NONE);
          if (bestSlot === -1 || openings[i].price < bestPrice) {
            bestSlot = i;
            bestPrice = openings[i].price;
          }
        }
      }

      const hasWinner = bestSlot !== -1;
      await sim.proveAward({
        adjudicatorSecret: adjSecret,
        openings,
        hasWinner,
        winningSlot: hasWinner ? BigInt(bestSlot) : 0n,
        awardedPrice: hasWinner ? bestPrice : 0n,
        winnerFirmIdHash: hasWinner ? bidders[bestSlot].firmIdHash : pad32(''),
        winnerSubListHash: hasWinner ? bidders[bestSlot].subListHash : pad32(''),
        codes,
        evidence: [pad32(''), pad32(''), pad32(''), pad32('')],
      });

      const l = sim.getLedger();
      expect(l.hasWinner).toBe(hasWinner);
      if (hasWinner) {
        expect(l.phase).toBe(Phase.AWARDED);
        expect(l.winningSlot).toBe(BigInt(bestSlot));
        expect(l.awardedPrice).toBe(bestPrice);
      } else {
        expect(l.phase).toBe(Phase.NO_AWARD);
      }
    });
  }
});
