# Legal & Commercial Positioning — `Assize`

All statutory, case-law, and economic citations below were verified against primary public sources on `2026-11-23`–`2026-11-24`. Assize does **not** claim to override any jurisdiction's public-records or open-meetings statute; instead, it enforces cryptographic integrity and on-chain confidentiality while leaving statutory disclosure strictly under the contracting agency's lawful control outside the blockchain.

---

## 1. Verified Statutory & Case-Law Anchors

1. **Owner-Award "Lowest Responsible Bidder" Statutes (California Public Contract Code):**
   - **CA PCC § 10180 (State Contracts):** Mandates sealed competitive bidding and award to the **lowest responsible bidder** on state public works.
   - **CA PCC § 20128 (County Contracts):** Part of the Local Agency Public Construction Act; mandates county boards of supervisors award public works to the **lowest responsible bidder**.
   - **CA PCC § 20162 (City / Municipal Contracts):** Mandates municipal public projects above the statutory threshold be let to the **lowest responsible bidder** after notice.
   - *How Assize Maps:* `proveAward` locks the on-chain selection rule to **objective lowest compliant price + deterministic tie-break** over the complete frozen bid set—closing the subjective-scoring loophole.

2. **Bid-Shopping Statutory Precedent (CA PCC § 4101 & § 4104):**
   - **CA PCC § 4101** (*Subletting and Subcontracting Fair Practices Act*) explicitly finds that *bid shopping* and *bid peddling* on public improvements degrade workmanship, deprive the public of fair competition, and cause insolvencies and lost wages. **CA PCC § 4104** mandates listing major subcontractors at bid submission.
   - *How Assize Maps:* Pre-deadline cryptographic sealing eliminates pre-close bid shopping; every sealed `BidOpening` commits `subListHash` (the contractor's § 4104 subcontractor list hash), disclosed on-chain **for the winning bidder only** at award.

3. **Procedural Due Process for Disqualifications (*City of Inglewood*, 1972):**
   - ***City of Inglewood–Los Angeles County Civic Center Authority v. Superior Court*, 7 Cal.3d 861 (1972):** Landmark California Supreme Court ruling distinguishing *bid responsiveness* from *bidder responsibility* and holding that a public entity **cannot** reject a low bidder on grounds of *non-responsibility* without procedural due process (notice of evidence and opportunity to be heard).
   - *How Assize Maps:* Maps **1-to-1** onto explicit, reason-coded, on-chain exclusions (`NON_RESPONSIVE`, `NOT_RESPONSIBLE`, `BOND_DEFECT`, `UNDECRYPTABLE`) with per-exclusion `evidenceHash` and the zero-knowledge `challengeAward` protest circuit (`CONTESTED` state).

4. **Confidentiality vs. Effective Legal Remedy (EU Directive 2014/24/EU Art. 21 & OECD):**
   - **EU Directive 2014/24/EU, Article 21** (clarified by CJEU *Case C-54/21*) mandates that contracting authorities protect commercially sensitive tender information designated confidential by bidders, balanced against competing bidders' right to an effective legal remedy.
   - **OECD Public Procurement & Bid-Rigging Guidance:** Public procurement accounts for **12–13% of GDP** in OECD economies, and bid rigging inflates contract costs by **20% or more**. OECD competition guidance explicitly warns that publishing detailed losing-bid prices and bidder identities helps cartels police cover-bidding and bid rotation.
   - *How Assize Maps:* Midnight's dual-ledger architecture satisfies both duties simultaneously: **zero losing prices or losing bidder identities ever appear on-chain**, while any excluded lower bidder holds a cryptographic right to prove protest standing (`challengeAward`) without revealing their price.

---

## 2. Commercial Model & Go-To-Market (Wave 3 Viability)

- **Target Buyer:** Municipal, county, state, and district public procurement offices—and existing e-procurement SaaS portals (OpenGov, PlanetBids, Bonfire) embedding Assize as a **Verifiable Sealing & Award-Proof Integrity Layer**.
- **Pricing & ROI:** `$1,500–$3,500 / month` municipal agency SaaS subscription (unlimited tenders, bundled Midnight DUST fee sponsorship) or `$250` per certified archival Adjudication Certificate. Preventing a single **$50,000–$250,000 bid-protest legal dispute or project delay** pays for years of subscription.
- **Phase 2 Roadmap (Explicitly Scoped Post-Wave 3):** Timelock encryption to eliminate bidder post-deadline non-reveal dependency; independent Inspector-General oversight key for post-`CONTESTED` resolution; `N=6+` batch scaling; native ERP/e-bid portal connectors.
