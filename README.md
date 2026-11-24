<!-- SPDX-License-Identifier: Apache-2.0 -->

# Assize

**Verifiable sealed-bid public procurement on Midnight.**

*Prove a public-works contract went to the lowest compliant sealed bid—and let any wrongly excluded lower bidder trigger an on-chain protest—without ever putting a losing price or losing bidder's identity on the blockchain.*

---

## Live Deployments & Verified On-Chain Proof (Midnight Ledger 9)

- **Live Web App (Walletless Tender Room + Live On-Chain Verifier):** https://assize-midnight.vercel.app
- **Public Repository:** https://github.com/ShalyX/assize (`Apache-2.0` · Topic: `midnightntwrk`)
- **Live Midnight Preview Contracts (`Compact 0.36.1` · `Midnight.js 5.0.1` · `proof-server:9.0.2` · 26 Real ZK Transactions):**

| Reference Tender | Verified On-Chain Phase | Awarded Price (Public) | Losing Prices On-Chain | Live Contract Address (`Midnight Preview`) | Final Tx Hash & Block |
|---|---|---:|---|---|---|
| **Tender A** (`PW-2026-041-A`) — Clean Fair Award | **`FINALIZED`** | `$885,000` (Slot #1) | **0 (Verified)** | `a1e23cade2bf29e29d919a7d51d7db027f63f32276096568eb6b267a8a58a1a9` | [`a8149e18…c4a4f8a`](https://preview.midnightexplorer.com/tx/a8149e1897db26d439f3340684a1e383e5345fec72d76ab93a88b8068c4a4f8a) (`#247446`) |
| **Tender B** (`PW-2026-041-B`) — Pretextual Exclusion Caught | **`CONTESTED`** | `$940,000` (Slot #0) | **0 (`$885k` sealed!)** | `3baf3aa1d01016d3700b97fd551ff30657e900e0f06f14068ec47cf5a01050f3` | [`73775dcd…0d03aa8`](https://preview.midnightexplorer.com/tx/73775dcd6a6dcbaaa65f0b748b11514b0e087b33edf94a4cc0511ae4d0d03aa8) (`#247502`) |

> **Verify independently in 1 command (zero wallet, zero API key):**
> ```bash
> npm run verify:onchain
> ```
> Queries `https://indexer.preview.midnight.network/api/v4/graphql` directly for both contracts above and confirms **0 losing bid prices** appear anywhere in serialized on-chain state (full 26-transaction manifest in [deployments/preview.json](./deployments/preview.json)).

---

## The Problem: The Public-Procurement Privacy Paradox

Public procurement accounts for **12–13% of GDP** across OECD economies, and bid rigging inflates contract prices by **20% or more**. Sealed-bid public works face two opposing failures:

1. **Centralized e-procurement portals rely on unverifiable insider trust:** Insiders can peek before close (**bid shopping**, codified as a public harm by **CA PCC § 4101**) or quietly omit / pretextually disqualify the low bidder after close (violating lowest-responsible-bidder statutes **CA PCC §§ 10180, 20128, 20162** and due-process notice/hearing rules under ***City of Inglewood v. Superior Court*, 7 Cal.3d 861 (1972)**).
2. **Transparent blockchains break commercial confidentiality and aid cartels:** Publishing all losing bids on-chain leaks contractor margins permanently and—as OECD guidance warns—hands cartels the exact data needed to police cover-bidding, while clashing with **EU Directive 2014/24/EU Article 21**.

**Assize** resolves both failures on **Midnight (`compact 0.36.1` / Ledger 9)**: bids stay cryptographically sealed before close, the authorized agency proves complete-set lowest-compliant-bid selection over the frozen bid root, every disqualification is explicit, reason-coded, and challengeable in zero knowledge (`challengeAward` -> `CONTESTED`), and **zero losing prices, zero bid salts, and zero decryptable ciphertexts ever touch the blockchain**.

---

## What Stays Private, What Is Public, and Why

| Data Element | On the Midnight Ledger? | Private Witness / Off-Chain Only? | Why |
|---|---|---|---|
| **Losing bid prices & surety amounts** | **Never** | Private witness + off-chain WebCrypto envelope to adjudicator | Protects contractor unit margins and denies cartels cover-bid policing data |
| **Losing contractor identities & CA § 4101 sub lists** | **Never** | Private witness (`firmIdHash`, `subListHash`) | Prevents rival mapping and retaliation; only the winning bidder's hashes are disclosed at award |
| **256-bit bid salts & bidder secrets** | **Never** | Local bidder witness only | Prevents offline dictionary cracking of clustered bid amounts |
| **Encrypted opening ciphertexts** | **Never** (only `sha256` receipt digest on-chain) | Off-chain `RSA-OAEP-256 + AES-256-GCM` envelope | Zero harvest-now-decrypt-later ciphertext exposure on-chain; digest still hard-blocks false `NON_REVEAL` |
| **Prequalification Merkle root & roster hash** | **Public** (immutable in `constructor`) | Merkle path stays private in `submitSealedBid` | Stops shill-leaf planting while hiding which prequalified firm submitted which slot |
| **Frozen bid count & rolling commitment root** | **Public** (`closeBidding`) | — | Makes silent omission mathematically impossible inside `proveAward` |
| **Winner price, slot, `firmIdHash`, `subListHash`** | **Public** (`proveAward`) | — | Public spending accountability & CA PCC § 4101/§ 4104 listing verification |
| **Reason-coded exclusions & `evidenceHash`** | **Public** (`proveAward`) | Underlying disqualification memo off-chain | Enforces *City of Inglewood* due-process transparency & identifies challengeable slots |
| **ZK Protest Flag (`CONTESTED`, `challengerSlot`)** | **Public** (`challengeAward`) | Challenger's exact price stays **private** | Proves the excluded bidder beat the awarded price without leaking their price on-chain |

See [PRIVACY_AUDIT.md](./PRIVACY_AUDIT.md) for the complete `disclose()` audit and honest threat-model boundary, and [docs/LEGAL_POSITIONING.md](./docs/LEGAL_POSITIONING.md) for verified statutory sources.

---

## Architecture (`N=4` Baseline · 8 Compact `0.36.1` Circuits)

- **`contracts/src/assize.compact`** — 8 exported circuits (`submitSealedBid`, `closeBidding`, `deliverOpening`, `closeReveal`, `proveAward`, `challengeAward`, `finalizeAward`, `declareAdjudicatorDefault`) compiled on `compact 0.36.1` (`language-version: 0.28.0`, `runtime-version: 0.21.0`, `zkir-3.2.1`) with all 16 prover/verifier keys generated.
- **`packages/crypto/index.ts`** — Client-side WebCrypto hybrid encryption (`RSA-OAEP-256` + `AES-256-GCM` with slot/tender AAD binding) + canonical `sha256` opening receipt digests.
- **`contracts/src/simulator.ts` & `contracts/test/`** — Real compiled-contract runtime harness with **104 passing automated tests** (lifecycle happy paths, adversarial attacks, 40 guard-boundary invariants, 50 randomized property-fuzz trials vs. independent JS `argmin`, WebCrypto tamper tests, and serialized-ledger zero-leakage assertions).
- **`web/`** — Institutional **Civic Bid-Tabulation Ledger** React/Vite app with 4 routes:
  - `/` — Executive Overview & "Who Sees What, When" Matrix
  - `/tender` — Walletless Interactive Tender Room running the **real compiled Compact `0.36.1` runtime locally** (clearly labeled) + 45-second Adversarial Attack Bar + persistent **Midnight Public Ledger Diff Inspector** + JSON receipt download
  - `/verify` — Live Midnight Preprod GraphQL Indexer Verifier (Blockfrost `https://midnight-preprod.blockfrost.io/api/v0`, walletless)
  - `/verify/award` — Printable Municipal Award & Protest Certificate
- **`deck/assize-pitch-deck.pdf`** & **`demo/assize-demo.mp4`** — 10-slide institutional pitch deck (PDF) and 2.5-minute problem-first product film (`1920×1080p`, 30fps, BT.709).

---

## Quick Start & Tested Commands

```bash
# 1. Run all 104 automated contract, WebCrypto, fuzz & zero-leakage tests
npm run test:contracts

# 2. Run the 26-mutant source guard-mutation harness (requires Compact 0.36.1)
npm run test:mutations

# 3. Build & preview the institutional web app locally (walletless)
npm run build:web
npm run preview:web

# 4. Independently verify deployed Preprod contracts via Blockfrost GraphQL
BLOCKFROST_PROJECT_ID=preprod... npm run verify:onchain
```

See [docs/JUDGE_GUIDE.md](./docs/JUDGE_GUIDE.md) for the 5-minute judge walkthrough and Compact `0.36.1` recompilation steps, and `.github/workflows/deploy-preprod.yml` for reproducible Preprod deployment with `midnightntwrk/proof-server`.

---

## Honest Limitations & Phase 2 Roadmap

- **Authorized Adjudicator Post-Deadline Boundary:** Confidentiality is enforced against competing bidders, public observers, and blockchain observers; the authorized procurement officer receives decrypted openings after the deadline.
- **No Forward Secrecy on Off-Chain Archives:** Per-tender ephemeral keys limit blast radius and zero ciphertext is written on-chain, but no forward secrecy is claimed if off-chain envelopes and the ephemeral private key leak together.
- **Phase 2 Roadmap:** **Timelock encryption** to eliminate the bidder post-deadline non-reveal dependency; independent Inspector-General oversight authority for post-`CONTESTED` resolution; `N=6` expansion (strictly gated after `N=4` Preprod proving benchmarks); e-procurement portal API integrations (OpenGov, PlanetBids, Bonfire).

---

## License

Licensed under the **Apache License, Version 2.0** ([LICENSE](./LICENSE)).
