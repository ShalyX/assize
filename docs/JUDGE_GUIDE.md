# Judge Evaluation Guide — `Assize` (5-Minute Walkthrough)

Welcome to **Assize** (*Verifiable sealed-bid public procurement on Midnight*). Everything below can be verified locally or in the browser **without installing a crypto wallet or requesting testnet DUST**.

---

## 1. 45-Second Interactive Payoff (Zero Wallet Required)

1. Start the web app (`cd web && npm install && npm run dev`, or open the live deployment URL).
2. Click **Launch Interactive Tender Room** (`/tender`). Notice the honest execution strip: the Tender Room runs the **actual compiled Compact `0.36.1` contract locally (unproven; demo role keys local)**—zero JS mocks or simulated timers.
3. Click **1. Seal All 4 Contractor Bids** -> **2. Freeze Bidding Window** -> **3. Encrypt & Deliver 4 Opening Receipts** (real client-side WebCrypto `RSA-OAEP-256 + AES-256-GCM`) -> **4. Lock Reveal Barrier (`closeReveal`)**.
   - Watch the right-hand **Midnight Public Ledger Inspector**: only commitments, nullifiers, `frozenCommitRoot`, and `sha256` receipt digests appear on-chain—never any bid price or ciphertext.
4. Click each of the **3 Corrupt Adjudicator Attacks**:
   - **Attack 1 (Silently Omit `$885k`)** -> Rejected by Compact (`Submitted slot cannot be NO_BID` / complete-set lock).
   - **Attack 2 (Award `$940k` over `$885k`)** -> Rejected by Compact (`Awarded price is not the deterministic lowest compliant bid`).
   - **Attack 3 (Fake `NON_REVEAL` on Receipted Slot 1)** -> Rejected by Compact (`Cannot mark receipted opening as NON_REVEAL`).
5. Click **Demo Payoff: Pretextually Exclude Slot 1 & Award `$940k`**:
   - The contract records explicit `ExclusionCode.NOT_RESPONSIBLE` + `evidenceHash` on-chain and awards Slot 0 at `$940,000` (with zero losing prices on-chain).
6. Click **File ZK Protest as Excluded Low Bidder (Slot 1 · `challengeAward`)**:
   - Slot 1 proves in zero knowledge that their sealed, receipted bid beats `$940,000` **without disclosing `$885,000`**. The tender flips to **`CONTESTED`**.
7. Click **Open Printable Municipal Award Certificate** (`/verify/award`) or download the JSON audit receipt.

---

## 2. Independent Automated Verification (CLI)

### Prerequisites
- Node.js `>= 22` (tested on Node `v24.14.0`)
- Optional (to recompile `.compact` from source): `compact 0.36.1` on Linux/macOS/WSL2 (`compact update 0.36.1`)

### Tested Commands
```bash
# 1. Run all 104 automated simulator, adversarial, WebCrypto, zero-leakage & 50-trial fuzz tests
npm run test:contracts

# 2. Run the 26-mutant source guard-mutation suite (requires compact 0.36.1)
npm run test:mutations

# 3. Typecheck and build the production frontend
npm run build:web

# 4. Independently query Blockfrost Midnight Preprod GraphQL Indexer (walletless)
BLOCKFROST_PROJECT_ID=preprod... npm run verify:onchain
```

Expected output of `npm run test:contracts`: **`Test Files 2 passed (2) · Tests 104 passed (104)`** (zero failures).
Note: Live Preprod deployment (`deployments/preprod.json`) is explicitly marked `AWAITING_FUNDED_PREPROD_DEPLOYMENT` until executed with a funded Preprod wallet (`tNIGHT -> DUST`) and `BLOCKFROST_PROJECT_ID` via `midnightntwrk/proof-server` (`.github/workflows/deploy-preprod.yml`). Assize never fabricates transaction hashes.

### Recompiling the Compact `0.36.1` Contract (Linux / WSL2)
```bash
compact compile contracts/src/assize.compact contracts/managed/assize
```
Generates all 8 `.zkir` circuits, 8 `.prover` keys, 8 `.verifier` keys, and TypeScript bindings (`language-version: 0.28.0`, `runtime-version: 0.21.0`).

---

## 3. Honest Limitations & Roadmap
- **Authorized Adjudicator Post-Deadline Boundary:** Confidentiality is enforced against competing bidders, public observers, and blockchain observers; the authorized procurement officer decrypts openings after the deadline to evaluate responsiveness/responsibility.
- **No Forward Secrecy Claimed on Off-Chain Archive:** Each tender uses an ephemeral adjudicator keypair and writes zero decryptable ciphertext on-chain; if off-chain envelopes and the ephemeral private key leaked together, no forward secrecy is claimed.
- **Phase 2 Roadmap:** Timelock encryption to eliminate bidder post-deadline non-reveal dependency; independent Inspector-General oversight key for post-`CONTESTED` resolution; conditional `N=6` expansion after Preprod `N=4` proving benchmarks.
