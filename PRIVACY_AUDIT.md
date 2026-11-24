# PRIVACY AUDIT — `Assize` Dual-Ledger & `disclose()` Analysis

- **Contract:** `contracts/src/assize.compact` (`N=4`, `compact 0.36.1`, `language-version: 0.28.0`, `runtime-version: 0.21.0`, Apache-2.0)
- **Compiler Taint Audit:** Zero implicit witness-disclosure warnings or errors under `compact compile`.
- **Automated Zero-Leakage Suite:** Verified in `contracts/test/assize.test.ts` and `contracts/test/assize.guards.test.ts` (104/104 tests passing, asserting serialized public ledger contains zero losing prices, zero 256-bit bid salts, zero losing `firmIdHash`/`subListHash`, and zero encrypted opening ciphertexts).

---

## 1. Honest Privacy Boundary (Zero Overclaiming)

| Party / Observer | Before Bidding Close (`OPEN`) | After Close / Reveal (`REVEAL` / `EVALUATION`) | After Award / Protest (`AWARDED` / `CONTESTED` / `FINALIZED`) |
|---|---|---|---|
| **Competing Bidders** | Sealed commitments & bid count only | On-chain `sha256` opening receipt digests only | Winner price, winner identity/`subListHash`, reason-coded exclusions, contest flag — **never any losing price or losing identity** |
| **Public & Blockchain Observers** | Sealed commitments, nullifiers, immutable tender config | Frozen commitment root/count & receipt digests | Winner price, winner identity/`subListHash`, reason-coded exclusions, contest flag — **never any losing price, salt, or ciphertext** |
| **Authorized Procurement Adjudicator** | **Sealed — cannot peek** (zero openings exist pre-close) | Receives off-chain WebCrypto (`RSA-OAEP-256 + AES-256-GCM`) openings post-deadline; evaluates complete frozen set | Retains decrypted openings off-chain for lawful statutory/audit disclosure outside the chain |

### Explicit Residual Threat Disclosures
1. **Authorized Adjudicator Post-Deadline Access:** By design, the authorized agency officer decrypts submitted openings after the deadline to evaluate responsiveness/responsibility and execute `proveAward`. Assize prevents pre-close bid shopping, silent omission, wrong-winner selection, and covert price-rigging; it does not claim MPC secrecy from the adjudicator.
2. **Ephemeral Key Hygiene (No Forward Secrecy Claimed):** Each tender generates a fresh per-tender ephemeral `RSA-OAEP-256` adjudicator keypair. Because **zero decryptable ciphertext is ever written to the Midnight blockchain** (only `sha256` receipt digests), an on-chain observer cannot harvest ciphertexts; however, if both an off-chain envelope archive and the ephemeral private key leaked together, no forward secrecy is claimed.
3. **Selective Non-Reveal Residual Risk -> Timelock Encryption Roadmap:** In a standard post-deadline commit-reveal protocol, a colluding bidder could inspect other openings and choose not to reveal. Assize makes every non-reveal loud and auditable via `ExclusionCode.NON_REVEAL` + `nonRevealCount` (paired off-chain with bid-bond forfeiture). **Timelock encryption** is explicitly scoped for Phase 2 to eliminate the bidder non-reveal dependency.
4. **Walletless Demo Honesty:** The browser Tender Room executes the **real compiled Compact `0.36.1` contract locally (unproven)** with demo role keys held locally in the browser session (explicitly badged in the UI). Production bidders prove locally via Lace + local proof server so private witnesses never leave the bidder's device.

---

## 2. Complete `disclose()` Inventory (`assize.compact`)

Every explicit `disclose(...)` in `contracts/src/assize.compact` is enumerated and justified below:

| Line / Circuit | Disclosed Value | Bits / Scope | Justification |
|---|---|---|---|
| `constructor` | `initTenderId`, `initAdjPubKey`, `initAdjEncPubKey`, `initPrequalRoot`, `initPrequalRosterHash`, `initSelectionRuleHash`, `initMaxAwardBudget`, `initMinBondBps` | Public tender rules | Public notice parameters required for all prequalified contractors & taxpayers to verify tender rules |
| `submitSealedBid` | `hashBidCommit(tenderId, op)` | 256-bit hiding commitment | Salted with fresh 256-bit `bidSalt`; hides `price`, `bondAmount`, `firmIdHash`, `subListHash`, `bidDocsHash` |
| `submitSealedBid` | `hashNullifier(tenderId, secret)` | 256-bit unlinkable nullifier | Domain-separated per `tenderId`; enforces 1 bid per prequalified firm without linking across tenders |
| `deliverOpening` | `slotIndex`, `envelopeHash` | Slot index + 256-bit `sha256(ciphertext)` | Anchors anti-ghosting opening receipt; zero ciphertext written on-chain |
| `proveAward` | `hasWinnerIn`, `winningSlotIn`, `awardedPriceIn`, `winnerFirmIn`, `winnerSubListIn`, `codesIn`, `evidenceIn` | Public award + typed reason codes + evidence hashes | Public spending accountability (winner price & CA PCC §4101 `subListHash`), explicit challengeable exclusions, and `OVER_BUDGET` (intentional 1-bit `price > maxAwardBudget` disclosure) |
| `challengeAward` | `slotIndex` (only) | Slot index + 1-bit protest standing | **Consented 1-bit disclosure** by the excluded challenger proving `myPrice < awardedPrice` (or `<= cap` on `NO_AWARD`). **`opening.price` is NEVER disclosed!** |

---

## 3. Ledger-Read Hoisting Against Short-Circuit Side Channels

In `evalAwardSlot` and `challengeAward`, public ledger cells (`maxAwardBudget`, `awardedPrice`, `winningSlot`, `phase`) are hoisted into local `const` bindings before any boolean `||` / `&&` expressions involving private witness fields (`op.price`). This eliminates witness-dependent ledger-read branching and passes `compact 0.36.1`'s static witness-taint analyzer cleanly.

---

## 5. Known Wave 3 Liveness & Timing Boundaries (Honest Disclosure)

1. **Permissionless Phase Transitions (`closeBidding`, `closeReveal`, `declareAdjudicatorDefault`):** Because Compact `0.36.1` does not yet expose a native `block.timestamp` primitive, phase transitions are permissionless in Wave 3 to guarantee zero-deadlock liveness if an adjudicator stalls. In production deployment (Phase 2), deadline enforcement requires an attested timestamp oracle or agency-cosigned time window to prevent premature third-party phase closures.
2. **Off-Chain Encryption Verification (`UNDECRYPTABLE`):** Because `deliverOpening` anchors an off-chain `sha256` receipt rather than an in-circuit verifiable encryption proof to `adjudicatorEncPubKey`, an adversarial bidder could anchor an undecryptable payload and later challenge an `UNDECRYPTABLE` exclusion. Phase 2 **Timelock Encryption** (or in-circuit verifiable encryption) eliminates this vector completely.
