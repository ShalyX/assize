// SPDX-License-Identifier: Apache-2.0
// Assize — Route 4: Official Archival Municipal Award & Protest Certificate (/#certificate)

import { AlertOctagon, ArrowRight, CheckCircle2, Printer, Scale, ShieldCheck } from 'lucide-react';
import { CopyButton } from '../components/CopyButton';
import { SplitSealCrest } from '../components/SplitSealLogo';
import {
  AssizeBrowserSession,
  ExclusionCode,
  Phase,
  formatUsdFromCents,
  shortHex,
} from '../lib/assizeEngine';
import type { AppRoute } from './OverviewPage';

export function AwardCertificatePage({
  session,
  onNavigate,
}: {
  session: AssizeBrowserSession | null;
  onNavigate: (r: AppRoute, tenderIdx?: number) => void;
}) {
  if (!session) {
    return (
      <div className="sheet" style={{ maxWidth: 960, margin: '0 auto' }}>
        <div className="sheet-body" style={{ padding: 32 }}>
          <div className="kicker" style={{ marginBottom: 10 }}>
            Preparing Official Municipal Adjudication Record
          </div>
          <div className="skeleton-line" style={{ width: '50%', marginBottom: 10 }} />
          <div className="skeleton-line" style={{ width: '35%' }} />
        </div>
      </div>
    );
  }

  const snap = session.getSnapshot();
  const isContested = snap.phase === Phase.CONTESTED;
  const isFinalized = snap.phase === Phase.FINALIZED || snap.phase === Phase.AWARDED;
  const isPreAward = snap.phase < Phase.AWARDED;

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      {/* Screen-Only Action & Status Bar */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <div className="kicker">Archival Municipal Tabulation &amp; Attestation Record</div>
          <div style={{ fontSize: 13, color: 'var(--ink-secondary)' }}>
            Formatted for A4 / US Letter public-works procurement dockets with{' '}
            <code className="mono">@media print</code> rules.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isPreAward && (
            <button
              type="button"
              className="btn"
              onClick={() => onNavigate('tender')}
            >
              Run Tender Room Walkthrough First
              <ArrowRight size={13} />
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            <Printer size={14} />
            Print / Save Official PDF
          </button>
        </div>
      </div>

      {/* Double-Rule Archival Municipal Document */}
      <article className="cert-frame" aria-label="Official Sealed-Bid Adjudication Certificate">
        <div className="cert-inner">
          {/* Engraved Masthead */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: 16,
              borderBottom: '2px solid var(--ink-primary)',
              paddingBottom: 18,
              marginBottom: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <SplitSealCrest size={58} contested={isContested} />
              <div>
                <div
                  className="mono"
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: '0.07em',
                    color: 'var(--accent-navy)',
                    textTransform: 'uppercase',
                  }}
                >
                  County Public-Works Procurement Registry · Midnight Compact 0.36.1
                </div>
                <h1
                  className="serif"
                  style={{
                    margin: '3px 0 3px 0',
                    fontSize: 28,
                    lineHeight: 1.15,
                    letterSpacing: '-0.015em',
                    fontWeight: 700,
                  }}
                >
                  Official Sealed-Bid Adjudication Certificate
                </h1>
                <div style={{ fontSize: 12.5, color: 'var(--ink-secondary)' }}>
                  Complete-Set Cryptographic Bid Tabulation &amp; Statutory Due-Process Record
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div className="mono" style={{ fontSize: 10, color: 'var(--ink-muted)', marginBottom: 4 }}>
                ADJUDICATION STATUS
              </div>
              <span
                className={`tag ${
                  isContested ? 'tag-contested' : isFinalized ? 'tag-verified' : 'tag-warning'
                }`}
                style={{ fontSize: 12, padding: '4px 11px' }}
              >
                {Phase[snap.phase]}
              </span>
            </div>
          </div>

          {/* Judicial Decree Callout */}
          {isContested && (
            <div className="alert-box alert-contested" style={{ marginBottom: 22 }}>
              <AlertOctagon size={19} style={{ marginTop: 2 }} />
              <div>
                <strong>FORMAL ZERO-KNOWLEDGE PROTEST RECORDED (CONTESTED):</strong> Excluded
                contractor at <strong>Slot #{snap.challengerSlot}</strong> cryptographically proved
                pre-deadline sealed commitment, on-chain opening receipt delivery, and compliant bid
                price strictly beating the awarded amount (
                <code className="mono">{formatUsdFromCents(snap.awardedPrice)}</code>)—while keeping
                their exact bid price permanently <code className="mono">[SEALED — NOT ON CHAIN]</code>.
              </div>
            </div>
          )}

          {snap.phase === Phase.FINALIZED && (
            <div className="alert-box alert-verified" style={{ marginBottom: 22 }}>
              <CheckCircle2 size={19} style={{ marginTop: 2 }} />
              <div>
                <strong>UNCONTESTED PUBLIC-WORKS AWARD FINALIZED:</strong> Proven over the complete
                frozen commitment root (<code className="mono">frozenBidCount = {snap.frozenBidCount}</code>)
                with zero losing bid prices or losing contractor identities disclosed on-chain.
              </div>
            </div>
          )}

          {isPreAward && (
            <div className="alert-box alert-warning" style={{ marginBottom: 22 }}>
              <Scale size={18} style={{ marginTop: 2 }} />
              <div>
                <strong>PRE-AWARD DOCKET SNAPSHOT ({Phase[snap.phase]}):</strong> Final award and
                protest fields populate once <code className="mono">proveAward</code> executes in
                the Interactive Tender Room.
              </div>
            </div>
          )}

          {/* Section 1: Formal 2-Column Municipal Docket Metadata Grid */}
          <h2 className="serif" style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px 0' }}>
            I. Procurement Docket &amp; Cryptographic Anchors
          </h2>
          <div className="cert-docket-grid">
            <div className="cert-docket-cell">
              <div className="cert-docket-label">Contracting Agency</div>
              <div className="cert-docket-value" style={{ fontWeight: 600 }}>
                {session.agencyName}
              </div>
            </div>

            <div className="cert-docket-cell">
              <div className="cert-docket-label">Project &amp; Docket Number</div>
              <div className="cert-docket-value">
                <strong>{session.tenderTitle}</strong>{' '}
                <span className="mono">({session.tenderCode})</span>
              </div>
            </div>

            <div className="cert-docket-cell">
              <div className="cert-docket-label">Statutory Authority</div>
              <div className="cert-docket-value">{session.statutoryBasis}</div>
            </div>

            <div className="cert-docket-cell">
              <div className="cert-docket-label">Public Budget Cap &amp; Surety Rule</div>
              <div className="cert-docket-value mono">
                {formatUsdFromCents(snap.maxAwardBudget)} Cap · {Number(snap.minBondBps) / 100}% Bid Bond
              </div>
            </div>

            <div className="cert-docket-cell">
              <div className="cert-docket-label">Awarded Price &amp; Winning Slot</div>
              <div className="cert-docket-value mono" style={{ fontWeight: 700, fontSize: 15 }}>
                {snap.hasWinner
                  ? `${formatUsdFromCents(snap.awardedPrice)} · Slot #${snap.winningSlot}`
                  : 'Pending Adjudication'}
              </div>
            </div>

            <div className="cert-docket-cell">
              <div className="cert-docket-label">Frozen Bid Set Count</div>
              <div className="cert-docket-value mono">
                {snap.frozenBidCount} Frozen / {snap.bidCount} Committed (N=4 Baseline)
              </div>
            </div>

            <div className="cert-docket-cell">
              <div
                className="cert-docket-label"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span>On-Chain Tender ID (256-Bit)</span>
                <CopyButton value={snap.tenderId} label="Copy" compact />
              </div>
              <div className="cert-docket-value mono hash-break" style={{ fontSize: 11.5 }}>
                {snap.tenderId}
              </div>
            </div>

            <div className="cert-docket-cell">
              <div
                className="cert-docket-label"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span>Frozen Commitment Root</span>
                <CopyButton value={snap.frozenCommitRoot} label="Copy" compact />
              </div>
              <div className="cert-docket-value mono hash-break" style={{ fontSize: 11.5 }}>
                {/^0+$/.test(snap.frozenCommitRoot) ? '— (Not yet frozen)' : snap.frozenCommitRoot}
              </div>
            </div>

            <div className="cert-docket-cell" style={{ gridColumn: '1 / -1', borderBottom: 'none' }}>
              <div
                className="cert-docket-label"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span>Winning Contractor CA PCC § 4101 Subcontractor List Hash</span>
                {snap.hasWinner && <CopyButton value={snap.winnerSubListHash} label="Copy" compact />}
              </div>
              <div className="cert-docket-value mono hash-break" style={{ fontSize: 11.5 }}>
                {snap.hasWinner ? snap.winnerSubListHash : '— (Disclosed for winning bidder only upon award)'}
              </div>
            </div>
          </div>

          {/* Section 2: Complete-Set Slot Disposition Table */}
          <h2 className="serif" style={{ fontSize: 18, fontWeight: 700, margin: '0 0 10px 0' }}>
            II. Complete-Set Slot Disposition (Zero Losing Prices Disclosed)
          </h2>
          <div className="table-scroll" style={{ marginBottom: 22 }}>
            <table className="ledger-table" style={{ border: '1px solid var(--border-strong)' }}>
              <thead>
                <tr>
                  <th scope="col">Slot</th>
                  <th scope="col">Sealed Commitment</th>
                  <th scope="col">Opening Receipt (SHA-256)</th>
                  <th scope="col">Public Disposition</th>
                  <th scope="col">Exclusion Evidence Hash</th>
                  <th scope="col">Public Ledger Price</th>
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2, 3].map((slot) => {
                  const isWin = snap.hasWinner && snap.winningSlot === slot;
                  const isCh = isContested && snap.challengerSlot === slot;
                  const code = snap.exclusionCodes[slot];
                  return (
                    <tr key={slot}>
                      <td className="mono" style={{ fontWeight: 700 }}>#{slot}</td>
                      <td className="mono" style={{ fontSize: 11.5 }}>
                        {shortHex(snap.bidCommitments[slot], 7)}
                      </td>
                      <td className="mono" style={{ fontSize: 11.5 }}>
                        {snap.deliveredFlags[slot]
                          ? shortHex(snap.openingReceipts[slot], 7)
                          : 'Not Delivered'}
                      </td>
                      <td>
                        {isCh ? (
                          <span className="tag tag-contested">CONTESTED CHALLENGER</span>
                        ) : isWin ? (
                          <span className="tag tag-verified">AWARDED WINNER</span>
                        ) : code !== ExclusionCode.NONE ? (
                          <span
                            className={`tag ${
                              code === ExclusionCode.OVER_BUDGET ? 'tag-warning' : 'tag-contested'
                            }`}
                          >
                            {ExclusionCode[code]}
                          </span>
                        ) : snap.phase >= Phase.AWARDED ? (
                          <span className="tag tag-neutral">EVALUATED · COMPLIANT</span>
                        ) : (
                          <span className="tag tag-neutral">SEALED</span>
                        )}
                      </td>
                      <td className="mono" style={{ fontSize: 11.5 }}>
                        {shortHex(snap.exclusionEvidence[slot], 7)}
                      </td>
                      <td className="mono" style={{ fontSize: 12, fontWeight: isWin ? 700 : 500 }}>
                        {isWin ? (
                          formatUsdFromCents(snap.awardedPrice)
                        ) : (
                          <span className="tag tag-private" style={{ fontSize: 10 }}>
                            [SEALED — NOT ON CHAIN]
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Section 3: Cryptographic Attestation Footer */}
          <div
            style={{
              borderTop: '1.5px solid var(--ink-primary)',
              paddingTop: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              fontSize: 12,
              color: 'var(--ink-secondary)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--ink-primary)' }}>
                <ShieldCheck size={14} color="#166534" />
                Cryptographic Zero-Leakage Attestation (Assize Schema V1 · Compact 0.36.1)
              </span>
              <span className="mono" style={{ fontSize: 11 }}>
                Live Reference Anchors: PW-2026-041-A (#247446) · PW-2026-041-B (#247502)
              </span>
            </div>
            <div>
              This record is derived directly from serialized Assize ledger cells. Losing bid
              amounts, 256-bit salts, losing bidder identities, losing § 4101 subcontractor lists,
              and off-chain WebCrypto envelopes are cryptographically absent from on-chain state.
              Statutory public-records retention remains governed by applicable agency law outside
              the blockchain.
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
