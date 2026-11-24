// SPDX-License-Identifier: Apache-2.0
// Assize — Route 4: Printable Municipal Award & Protest Certificate (/verify/award)

import { AlertOctagon, CheckCircle2, Printer, Scale } from 'lucide-react';
import {
  AssizeBrowserSession,
  ExclusionCode,
  Phase,
  formatUsdFromCents,
  shortHex,
} from '../lib/assizeEngine';
import { SplitSealLogo } from '../components/SplitSealLogo';

export function AwardCertificatePage({ session }: { session: AssizeBrowserSession | null }) {
  if (!session) {
    return (
      <div className="sheet">
        <div className="sheet-body">Loading certificate state…</div>
      </div>
    );
  }

  const snap = session.getSnapshot();
  const isContested = snap.phase === Phase.CONTESTED;
  const isFinalized = snap.phase === Phase.FINALIZED || snap.phase === Phase.AWARDED;

  return (
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 13, color: 'var(--ink-secondary)' }}>
          Archival print-ready municipal award &amp; protest tabulation certificate.
        </div>
        <button className="btn btn-primary" onClick={() => window.print()}>
          <Printer size={14} />
          Print / Save PDF Certificate
        </button>
      </div>

      <article className="sheet" style={{ padding: 32 }}>
        {/* Official Civic Masthead */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '2px solid var(--ink-primary)',
            paddingBottom: 18,
            marginBottom: 22,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <SplitSealLogo size={32} />
            <div>
              <div className="mono" style={{ fontSize: 11, letterSpacing: '0.06em', color: 'var(--ink-secondary)' }}>
                ASSIZE CRYPTOGRAPHIC PROCUREMENT RECORD · MIDNIGHT COMPACT 0.36.1
              </div>
              <h1 className="serif" style={{ margin: '2px 0 0 0', fontSize: 26, fontWeight: 700 }}>
                Official Sealed-Bid Adjudication Certificate
              </h1>
            </div>
          </div>
          <span
            className={`tag ${
              isContested ? 'tag-contested' : isFinalized ? 'tag-verified' : 'tag-warning'
            }`}
            style={{ fontSize: 12, padding: '4px 10px' }}
          >
            {Phase[snap.phase]}
          </span>
        </div>

        {/* Status Banner */}
        {isContested && (
          <div className="alert-box alert-contested" style={{ marginBottom: 20 }}>
            <AlertOctagon size={18} style={{ flexShrink: 0 }} />
            <div>
              <strong>FORMAL ZERO-KNOWLEDGE PROTEST RECORDED (CONTESTED):</strong> Excluded bidder
              at <strong>Slot #{snap.challengerSlot}</strong> cryptographically proved pre-deadline
              commitment, on-chain opening receipt, and bid price strictly beating the awarded
              price without disclosing their bid amount on-chain.
            </div>
          </div>
        )}
        {snap.phase === Phase.FINALIZED && (
          <div className="alert-box alert-verified" style={{ marginBottom: 20 }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <div>
              <strong>UNCONTESTED AWARD FINALIZED:</strong> Verified over the complete frozen bid
              set (<code className="mono">frozenBidCount = {snap.frozenBidCount}</code>) with zero
              losing bid prices disclosed on-chain.
            </div>
          </div>
        )}

        {/* Statutory Summary List */}
        <h2 className="serif" style={{ fontSize: 18, margin: '0 0 8px 0' }}>
          1. Tender &amp; Statutory Parameters
        </h2>
        <dl className="summary-list" style={{ marginBottom: 24 }}>
          <div className="summary-row">
            <dt>Contracting Agency</dt>
            <dd>{session.agencyName}</dd>
          </div>
          <div className="summary-row">
            <dt>Project &amp; Tender Code</dt>
            <dd>
              <strong>{session.tenderTitle}</strong> ({session.tenderCode})
            </dd>
          </div>
          <div className="summary-row">
            <dt>Statutory Authority</dt>
            <dd>{session.statutoryBasis}</dd>
          </div>
          <div className="summary-row">
            <dt>On-Chain Tender ID</dt>
            <dd className="mono">{snap.tenderId}</dd>
          </div>
          <div className="summary-row">
            <dt>Frozen Commitment Root</dt>
            <dd className="mono">{snap.frozenCommitRoot}</dd>
          </div>
          <div className="summary-row">
            <dt>Awarded Price (Public)</dt>
            <dd className="mono" style={{ fontWeight: 700, fontSize: 15 }}>
              {snap.hasWinner
                ? `${formatUsdFromCents(snap.awardedPrice)} (Slot #${snap.winningSlot})`
                : 'No Award Issued'}
            </dd>
          </div>
          <div className="summary-row">
            <dt>Winner CA §4101 SubList Hash</dt>
            <dd className="mono">{snap.hasWinner ? snap.winnerSubListHash : '—'}</dd>
          </div>
        </dl>

        {/* Slot-by-Slot Public Disposition */}
        <h2 className="serif" style={{ fontSize: 18, margin: '0 0 10px 0' }}>
          2. Complete-Set Slot Disposition (Zero Losing Prices Disclosed)
        </h2>
        <table className="ledger-table" style={{ border: '1px solid var(--border-hairline)', marginBottom: 22 }}>
          <thead>
            <tr>
              <th scope="col">Slot</th>
              <th scope="col">Sealed Commitment</th>
              <th scope="col">Opening Receipt</th>
              <th scope="col">Public Disposition</th>
              <th scope="col">Exclusion Evidence Hash</th>
              <th scope="col">Public Price</th>
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3].map((slot) => {
              const isWin = snap.hasWinner && snap.winningSlot === slot;
              const isCh = isContested && snap.challengerSlot === slot;
              const code = snap.exclusionCodes[slot];
              return (
                <tr key={slot}>
                  <td className="mono" style={{ fontWeight: 600 }}>#{slot}</td>
                  <td className="mono" style={{ fontSize: 11.5 }}>{shortHex(snap.bidCommitments[slot], 6)}</td>
                  <td className="mono" style={{ fontSize: 11.5 }}>
                    {snap.deliveredFlags[slot] ? shortHex(snap.openingReceipts[slot], 6) : 'Not Delivered'}
                  </td>
                  <td className="mono" style={{ fontSize: 11.5, fontWeight: 600 }}>
                    {isCh
                      ? 'CONTESTED CHALLENGER'
                      : isWin
                        ? 'AWARDED WINNER'
                        : ExclusionCode[code]}
                  </td>
                  <td className="mono" style={{ fontSize: 11.5 }}>{shortHex(snap.exclusionEvidence[slot], 6)}</td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {isWin ? formatUsdFromCents(snap.awardedPrice) : '[SEALED — NOT ON CHAIN]'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: 'var(--ink-secondary)',
            borderTop: '1px solid var(--border-hairline)',
            paddingTop: 14,
          }}
        >
          <Scale size={14} />
          <span>
            Generated from compiled Assize Compact 0.36.1 state. Losing bidder identities, losing
            prices, 256-bit salts, and WebCrypto opening ciphertexts are permanently excluded from
            public ledger state.
          </span>
        </div>
      </article>
    </div>
  );
}
