// SPDX-License-Identifier: Apache-2.0
// Assize — Route 1: Executive Overview & Judge Entry (/)

import {
  ArrowRight,
  CheckCircle2,
  EyeOff,
  FileCheck2,
  Lock,
  Scale,
  ShieldCheck,
} from 'lucide-react';

export type AppRoute = 'overview' | 'tender' | 'verify' | 'certificate';

export function OverviewPage({ onNavigate }: { onNavigate: (r: AppRoute) => void }) {
  return (
    <div>
      {/* Asymmetric Split Masthead */}
      <div className="split-overview" style={{ marginBottom: 28 }}>
        <div>
          <div
            className="mono"
            style={{
              fontSize: 11,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: 'var(--accent-navy)',
              fontWeight: 600,
              marginBottom: 10,
            }}
          >
            Public-Works Sealed-Bid Adjudication · Midnight Compact 0.36.1
          </div>
          <h1
            className="serif"
            style={{
              fontSize: 40,
              lineHeight: 1.12,
              letterSpacing: '-0.02em',
              margin: '0 0 14px 0',
              fontWeight: 600,
            }}
          >
            Prove the lowest compliant bid won—without putting a single losing price on-chain.
          </h1>
          <p
            style={{
              fontSize: 15,
              color: 'var(--ink-secondary)',
              margin: '0 0 22px 0',
              maxWidth: 620,
              lineHeight: 1.6,
            }}
          >
            Assize is a verifiable sealed-bid procurement layer on Midnight. Prequalified
            contractors seal bids before deadline; the authorized agency evaluates openings
            after close over the complete frozen bid set; every disqualification is explicit,
            reason-coded, and challengeable in zero knowledge—while losing prices and losing
            identities stay strictly off the public ledger.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button className="btn btn-primary" onClick={() => onNavigate('tender')}>
              <Scale size={15} />
              Launch Interactive Tender Room
              <ArrowRight size={14} />
            </button>
            <button className="btn" onClick={() => onNavigate('verify')}>
              <ShieldCheck size={15} />
              Verify Live on Midnight Preprod
            </button>
            <button className="btn" onClick={() => onNavigate('certificate')}>
              <FileCheck2 size={15} />
              Inspect Award Certificate
            </button>
          </div>
        </div>

        {/* Right: "Who Sees What, When" Privacy Boundary Matrix */}
        <div className="sheet">
          <div className="sheet-header">
            <h2 className="sheet-title">
              <EyeOff size={15} color="#1B3B6F" />
              Who Sees What, When (Honest Privacy Boundary)
            </h2>
            <span className="tag tag-private">Midnight Dual-Ledger</span>
          </div>
          <table className="ledger-table">
            <thead>
              <tr>
                <th scope="col">Observer</th>
                <th scope="col">Before Close</th>
                <th scope="col">After Close</th>
                <th scope="col">After Award</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>Rival Bidders</td>
                <td>Commitments only</td>
                <td>Receipt hashes only</td>
                <td>Winner price &amp; reason codes only</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Public &amp; Chain</td>
                <td>Commitments + count</td>
                <td>Frozen root + receipts</td>
                <td>Winner + exclusions + contest flag</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Authorized Adjudicator</td>
                <td>
                  <span className="tag tag-verified">Sealed (No Peek)</span>
                </td>
                <td>Decrypts WebCrypto openings off-chain</td>
                <td>Runs complete-set proveAward</td>
              </tr>
            </tbody>
          </table>
          <div
            style={{
              padding: '10px 14px',
              background: 'var(--bg-recessed)',
              borderTop: '1px solid var(--border-hairline)',
              fontSize: 12,
              color: 'var(--ink-secondary)',
            }}
          >
            <strong>Honest boundary:</strong> Assize enforces confidentiality against rival
            bidders, public observers, and chain observers. Authorized agency officers receive
            openings post-deadline and retain lawful statutory disclosure outside the chain.
            Timelock encryption to eliminate bidder non-reveal is scoped for Phase 2.
          </div>
        </div>
      </div>

      {/* Verification & Contract Capabilities Strip */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="sheet">
          <div className="sheet-header">
            <h3 className="sheet-title">
              <Lock size={15} color="#166534" />
              Verified Compact 0.36.1 Engineering (N=4 Baseline)
            </h3>
            <span className="tag tag-verified">104 / 104 Tests Passing</span>
          </div>
          <div className="sheet-body" style={{ paddingTop: 12, paddingBottom: 12 }}>
            <dl className="summary-list">
              <div className="summary-row">
                <dt>Compiled Circuits</dt>
                <dd className="mono" style={{ fontSize: 12 }}>
                  8 circuits · 16 prover/verifier keys · zkir-3.2.1 · runtime 0.21.0
                </dd>
              </div>
              <div className="summary-row">
                <dt>Complete-Set Lock</dt>
                <dd>
                  Frozen commitment root &amp; bid count consumed atomically in{' '}
                  <code className="mono">proveAward</code>
                </dd>
              </div>
              <div className="summary-row">
                <dt>Anti-Ghosting Receipts</dt>
                <dd>
                  Client-side RSA-OAEP-256 + AES-256-GCM envelopes; only{' '}
                  <code className="mono">sha256</code> digest on-chain
                </dd>
              </div>
              <div className="summary-row">
                <dt>ZK Protest Standing</dt>
                <dd>
                  <code className="mono">challengeAward</code> proves{' '}
                  <code className="mono">myPrice &lt; awardedPrice</code> without disclosing price
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="sheet">
          <div className="sheet-header">
            <h3 className="sheet-title">
              <CheckCircle2 size={15} color="#1B3B6F" />
              45-Second Judge Payoff Path
            </h3>
            <span className="tag tag-navy">Zero Wallet Required</span>
          </div>
          <div className="sheet-body">
            <ol
              style={{
                margin: 0,
                paddingLeft: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                color: 'var(--ink-secondary)',
              }}
            >
              <li>
                Open the <strong style={{ color: 'var(--ink-primary)' }}>Tender Room</strong>{' '}
                and seal 4 prequalified public-works bids on the real compiled Compact runtime.
              </li>
              <li>
                Click <strong style={{ color: 'var(--ink-primary)' }}>Attempt Silent Omission</strong>,{' '}
                <strong style={{ color: 'var(--ink-primary)' }}>Wrong Winner</strong>, or{' '}
                <strong style={{ color: 'var(--ink-primary)' }}>Fake NON_REVEAL</strong>—watch
                the Compact circuit reject every attack live.
              </li>
              <li>
                Trigger a <strong style={{ color: 'var(--ink-primary)' }}>Pretextual Exclusion</strong>{' '}
                (<code className="mono">NOT_RESPONSIBLE</code> on the $885k low bidder) to award $940k,
                then click <strong style={{ color: 'var(--status-contested)' }}>File ZK Protest</strong>{' '}
                to flip the tender to <span className="tag tag-contested">CONTESTED</span> while
                $885,000 never touches the public ledger.
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* Statutory & Commercial Grounding Band */}
      <div className="sheet">
        <div className="sheet-header">
          <h3 className="sheet-title">
            <Scale size={15} color="#1B3B6F" />
            Verified Public-Procurement Legal &amp; Economic Grounding
          </h3>
          <span className="tag tag-neutral">Primary Sources Verified</span>
        </div>
        <div className="sheet-body">
          <div className="grid-4">
            <div style={{ borderRight: '1px solid var(--border-hairline)', paddingRight: 12 }}>
              <div className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-navy)' }}>
                CA PCC §§ 10180 · 20128 · 20162
              </div>
              <div style={{ fontWeight: 600, margin: '4px 0' }}>Lowest Responsible Bidder</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-secondary)' }}>
                Mandates awarding state, county, and municipal public works to the lowest
                responsible and responsive sealed bidder.
              </div>
            </div>

            <div style={{ borderRight: '1px solid var(--border-hairline)', paddingRight: 12 }}>
              <div className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-navy)' }}>
                CA PCC § 4101 &amp; § 4104
              </div>
              <div style={{ fontWeight: 600, margin: '4px 0' }}>Bid-Shopping Precedent</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-secondary)' }}>
                Codifies bid shopping as a public-works harm. Honored via committed{' '}
                <code className="mono">subListHash</code> disclosed for the winner only.
              </div>
            </div>

            <div style={{ borderRight: '1px solid var(--border-hairline)', paddingRight: 12 }}>
              <div className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-navy)' }}>
                City of Inglewood (7 Cal.3d 861)
              </div>
              <div style={{ fontWeight: 600, margin: '4px 0' }}>Due-Process Exclusions</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-secondary)' }}>
                Public agencies cannot reject a low bidder as non-responsible without notice and
                hearing—mapped 1:1 to challengeable on-chain reason codes.
              </div>
            </div>

            <div>
              <div className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-navy)' }}>
                OECD &amp; EU Dir. 2014/24 Art. 21
              </div>
              <div style={{ fontWeight: 600, margin: '4px 0' }}>Anti-Cartel Secrecy</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-secondary)' }}>
                Public procurement is 12–13% of OECD GDP; rigging inflates costs 20%+. Keeping
                losing bids off-chain denies cartels cover-bid policing data.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
