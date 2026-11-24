// SPDX-License-Identifier: Apache-2.0
// Assize — Route 2: Interactive Tender Room (/tender)
// Runs the REAL compiled Compact 0.36.1 contract + real WebCrypto envelopes locally.

import { useEffect, useState } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  Download,
  EyeOff,
  FileCheck2,
  Lock,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  AssizeBrowserSession,
  ExclusionCode,
  Phase,
  formatUsdFromCents,
  shortHex,
  type LedgerSnapshot,
} from '../lib/assizeEngine';
import type { AppRoute } from './OverviewPage';

function phaseTagClass(phase: Phase): string {
  if (phase === Phase.FINALIZED || phase === Phase.AWARDED) return 'tag tag-verified';
  if (phase === Phase.CONTESTED) return 'tag tag-contested';
  if (phase === Phase.NO_AWARD || phase === Phase.ADJUDICATOR_DEFAULT) return 'tag tag-warning';
  return 'tag tag-navy';
}

export function TenderRoomPage({
  session,
  onSessionUpdate,
  onReset,
  onNavigate,
}: {
  session: AssizeBrowserSession | null;
  onSessionUpdate: () => void;
  onReset: () => Promise<void>;
  onNavigate: (r: AppRoute) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [lastAlert, setLastAlert] = useState<{
    kind: 'ok' | 'rejected' | 'contested';
    title: string;
    detail: string;
  } | null>(null);
  const [snap, setSnap] = useState<LedgerSnapshot | null>(null);

  useEffect(() => {
    if (session) setSnap(session.getSnapshot());
  }, [session, session?.logs.length]);

  if (!session || !snap) {
    return (
      <div className="sheet">
        <div className="sheet-body" style={{ padding: 36, textAlign: 'center', color: 'var(--ink-secondary)' }}>
          Initializing compiled Compact 0.36.1 runtime &amp; ephemeral WebCrypto adjudicator keypair…
        </div>
      </div>
    );
  }

  const run = async (
    action: () => Promise<{ ok: boolean; error?: string } | void>,
    okTitle: string,
    okDetail: string,
    kind: 'ok' | 'contested' = 'ok'
  ) => {
    setBusy(true);
    try {
      const res = await action();
      setSnap(session.getSnapshot());
      onSessionUpdate();
      if (res && !res.ok) {
        setLastAlert({
          kind: 'rejected',
          title: 'Compact 0.36.1 Circuit Rejected Transaction',
          detail: res.error ?? 'Assertion failed',
        });
      } else {
        setLastAlert({ kind, title: okTitle, detail: okDetail });
      }
    } finally {
      setBusy(false);
    }
  };

  const downloadReceipt = (slotIndex: number) => {
    const data = session.buildDownloadableReceipt(slotIndex);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assize-receipt-${session.tenderCode}-slot-${slotIndex}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const changed = new Set(session.lastChangedFields);
  const flash = (field: string) => (changed.has(field) ? 'diff-changed' : '');

  const stepState = (stepIdx: number) => {
    if (snap.phase === Phase.CONTESTED && stepIdx === 4) return 'phase-step contested';
    if (snap.phase === Phase.FINALIZED && stepIdx === 4) return 'phase-step done';
    const currentStep =
      snap.phase === Phase.OPEN
        ? 0
        : snap.phase === Phase.REVEAL
          ? 1
          : snap.phase === Phase.EVALUATION
            ? 2
            : snap.phase === Phase.AWARDED || snap.phase === Phase.NO_AWARD
              ? 3
              : 4;
    if (stepIdx < currentStep) return 'phase-step done';
    if (stepIdx === currentStep) return 'phase-step active';
    return 'phase-step';
  };

  return (
    <div>
      {/* Honest Execution Mode Strip */}
      <div className="honesty-strip">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lock size={14} color="#1B3B6F" />
          <span>
            <strong>Compiled Compact 0.36.1 Circuit Runtime</strong> · Local Execution (Unproven;
            Demo Role Keys Local). Zero JS mocks—every assertion executes the actual compiled
            contract.
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" onClick={() => onNavigate('verify')}>
            Live Preprod /verify
          </button>
          <button
            className="btn btn-sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setLastAlert(null);
              await onReset();
              setBusy(false);
            }}
          >
            <RotateCcw size={13} />
            Reset Fixture
          </button>
        </div>
      </div>

      {/* Tender Masthead */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-secondary)' }}>
            TENDER {session.tenderCode} · {session.agencyName.toUpperCase()} · {session.statutoryBasis}
          </div>
          <h1 className="serif" style={{ margin: '4px 0 0 0', fontSize: 28, fontWeight: 600 }}>
            {session.tenderTitle}
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="tag tag-neutral">N=4 Slots · Cap $1,200,000 · 10% Bond</span>
          <span className={phaseTagClass(snap.phase)} role="status" aria-live="polite">
            PHASE: {Phase[snap.phase]}
          </span>
        </div>
      </div>

      {/* 5-Step Phase Rail */}
      <div className="phase-rail">
        <div className={stepState(0)}>
          <div className="mono" style={{ fontSize: 10, color: 'var(--ink-muted)' }}>STEP 1</div>
          <div style={{ fontWeight: 600 }}>OPEN (Sealed Bids)</div>
        </div>
        <div className={stepState(1)}>
          <div className="mono" style={{ fontSize: 10, color: 'var(--ink-muted)' }}>STEP 2</div>
          <div style={{ fontWeight: 600 }}>REVEAL (WebCrypto Receipts)</div>
        </div>
        <div className={stepState(2)}>
          <div className="mono" style={{ fontSize: 10, color: 'var(--ink-muted)' }}>STEP 3</div>
          <div style={{ fontWeight: 600 }}>EVALUATION (proveAward)</div>
        </div>
        <div className={stepState(3)}>
          <div className="mono" style={{ fontSize: 10, color: 'var(--ink-muted)' }}>STEP 4</div>
          <div style={{ fontWeight: 600 }}>AWARDED / Protest Window</div>
        </div>
        <div className={stepState(4)}>
          <div className="mono" style={{ fontSize: 10, color: 'var(--ink-muted)' }}>STEP 5</div>
          <div style={{ fontWeight: 600 }}>
            {snap.phase === Phase.CONTESTED ? 'CONTESTED (ZK Protest)' : 'FINALIZED'}
          </div>
        </div>
      </div>

      {/* Live Circuit Feedback Banner */}
      {lastAlert && (
        <div
          className={`alert-box ${
            lastAlert.kind === 'rejected' || lastAlert.kind === 'contested'
              ? 'alert-contested'
              : 'alert-verified'
          }`}
          style={{ marginBottom: 16 }}
          role="status"
          aria-live="polite"
        >
          {lastAlert.kind === 'rejected' || lastAlert.kind === 'contested' ? (
            <AlertOctagon size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          ) : (
            <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          )}
          <div>
            <div style={{ fontWeight: 600 }}>{lastAlert.title}</div>
            <div className="mono" style={{ fontSize: 12, marginTop: 2 }}>
              {lastAlert.detail}
            </div>
          </div>
        </div>
      )}

      {/* 8 / 4 Split: Left Workbench, Right Persistent Public Ledger Diff Inspector */}
      <div className="split-tender">
        {/* LEFT WORKBENCH */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Action Control Panel */}
          <div className="sheet">
            <div className="sheet-header">
              <h2 className="sheet-title">
                <Play size={15} color="#1B3B6F" />
                Lifecycle Controls &amp; 45-Second Anti-Rigging Payoff
              </h2>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-secondary)' }}>
                Active Phase: {Phase[snap.phase]}
              </span>
            </div>
            <div className="sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Phase 1: OPEN */}
              {snap.phase === Phase.OPEN && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                  <button
                    className="btn btn-primary"
                    disabled={busy || snap.bidCount === 4}
                    onClick={() =>
                      run(
                        () => session.submitAllFourSealedBids(),
                        'All 4 Sealed Bids Committed',
                        'Merkle membership, fresh nullifiers, and 10% surety bond ratios verified in ZK. Zero prices written on-chain.'
                      )
                    }
                  >
                    <Lock size={14} />
                    1. Seal All 4 Contractor Bids (submitSealedBid)
                  </button>
                  <button
                    className="btn"
                    disabled={busy || snap.bidCount === 0}
                    onClick={() =>
                      run(
                        () => session.closeBidding(),
                        'Bidding Frozen (OPEN -> REVEAL)',
                        'frozenBidCount=4 & frozenCommitRoot locked permissionlessly.'
                      )
                    }
                  >
                    2. Freeze Bidding Window (closeBidding)
                  </button>
                </div>
              )}

              {/* Phase 2: REVEAL */}
              {snap.phase === Phase.REVEAL && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                  <button
                    className="btn btn-primary"
                    disabled={busy || snap.deliveredFlags.every(Boolean)}
                    onClick={() =>
                      run(
                        () => session.deliverAllFourEncryptedOpenings(),
                        'All 4 WebCrypto Openings Encrypted & Receipted',
                        'RSA-OAEP-256 + AES-256-GCM envelopes decrypted off-chain by adjudicator; only sha256 digests anchored on-chain.'
                      )
                    }
                  >
                    <ShieldCheck size={14} />
                    3. Encrypt &amp; Deliver 4 Opening Receipts (deliverOpening)
                  </button>
                  <button
                    className="btn"
                    disabled={busy || !snap.deliveredFlags.every(Boolean)}
                    onClick={() =>
                      run(
                        () => session.closeReveal(),
                        'Reveal Window Locked (REVEAL -> EVALUATION)',
                        'closeReveal barrier closed — adjudicator can now run complete-set proveAward.'
                      )
                    }
                  >
                    4. Lock Reveal Barrier (closeReveal)
                  </button>
                </div>
              )}

              {/* Phase 3: EVALUATION — THE ADVERSARIAL ATTACK BAR */}
              {snap.phase === Phase.EVALUATION && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--status-contested)',
                        marginBottom: 8,
                        textTransform: 'uppercase',
                      }}
                    >
                      Test Corrupt Adjudicator Attacks (Blocked by Compact 0.36.1)
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <button
                        className="btn btn-danger-outline btn-sm"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () => session.attemptSilentOmission(),
                            'Unexpected Pass',
                            ''
                          )
                        }
                      >
                        <ShieldAlert size={13} />
                        Attack 1: Silently Omit $885k Low Bid
                      </button>
                      <button
                        className="btn btn-danger-outline btn-sm"
                        disabled={busy}
                        onClick={() =>
                          run(() => session.attemptWrongWinner(), 'Unexpected Pass', '')
                        }
                      >
                        <ShieldAlert size={13} />
                        Attack 2: Award $940k Over $885k
                      </button>
                      <button
                        className="btn btn-danger-outline btn-sm"
                        disabled={busy}
                        onClick={() =>
                          run(() => session.attemptFakeNonReveal(), 'Unexpected Pass', '')
                        }
                      >
                        <ShieldAlert size={13} />
                        Attack 3: Fake NON_REVEAL on Receipted Slot 1
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      borderTop: '1px solid var(--border-hairline)',
                      paddingTop: 12,
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <button
                      className="btn btn-danger"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => session.executePretextualExclusion(),
                          'Pretextual Exclusion Recorded -> Awarded $940,000 (Slot 0)',
                          'Slot 1 excluded as NOT_RESPONSIBLE with public evidenceHash. Zero losing prices on-chain. Now click File ZK Protest as Slot 1!'
                        )
                      }
                    >
                      <AlertOctagon size={14} />
                      Demo Payoff: Pretextually Exclude Slot 1 &amp; Award $940k
                    </button>
                    <button
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => session.executeHonestAward(),
                          'Honest Award Proven -> Sierra Structural LLC ($885,000)',
                          'Complete-set frozenCommitRoot verified; Slot 3 proved OVER_BUDGET; losing prices remain off-chain.'
                        )
                      }
                    >
                      <CheckCircle2 size={14} />
                      Execute Honest Award ($885,000)
                    </button>
                  </div>
                </div>
              )}

              {/* Phase 4: AWARDED — ZK PROTEST OR FINALIZE */}
              {snap.phase === Phase.AWARDED && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                  {snap.exclusionCodes[1] === ExclusionCode.NOT_RESPONSIBLE && (
                    <button
                      className="btn btn-danger"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => session.fileZkProtestSlot1(),
                          'TENDER CONTESTED — ZK Protest Verified Without Disclosing $885,000',
                          'Slot 1 proved pre-deadline commit + opening receipt + myPrice < $940,000 in zero knowledge. Inspect the Public Ledger Inspector on the right: $885,000 is NOT on-chain!',
                          'contested'
                        )
                      }
                    >
                      <AlertOctagon size={14} />
                      File ZK Protest as Excluded Low Bidder (Slot 1 · challengeAward)
                    </button>
                  )}
                  <button
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => session.finalizeAward(),
                        'Award Finalized Permanently',
                        'Uncontested public-works award closed on ledger. Inspect printable Award Certificate.'
                      )
                    }
                  >
                    <CheckCircle2 size={14} />
                    Finalize Uncontested Award (finalizeAward)
                  </button>
                </div>
              )}

              {/* Phase 5: CONTESTED or FINALIZED */}
              {(snap.phase === Phase.CONTESTED || snap.phase === Phase.FINALIZED) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <button className="btn btn-primary" onClick={() => onNavigate('certificate')}>
                    <FileCheck2 size={14} />
                    Open Printable Municipal Award Certificate
                  </button>
                  <button className="btn" onClick={() => downloadReceipt(1)}>
                    <Download size={14} />
                    Download Slot 1 Audit Receipt (JSON)
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 4-Slot Civic Bid-Tabulation Table */}
          <div className="sheet">
            <div className="sheet-header">
              <h2 className="sheet-title">4-Slot Sealed Bid Tabulation Sheet</h2>
              <span className="tag tag-private">Private Witness Values Shown Locally Only</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th scope="col">Slot</th>
                    <th scope="col">Contractor (Local)</th>
                    <th scope="col">Private Bid Price</th>
                    <th scope="col">On-Chain Commitment</th>
                    <th scope="col">Opening Receipt</th>
                    <th scope="col">Public Disposition</th>
                    <th scope="col">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {session.contractors.map((c) => {
                    const isWinner = snap.hasWinner && snap.winningSlot === c.slot;
                    const isChallenger =
                      snap.phase === Phase.CONTESTED && snap.challengerSlot === c.slot;
                    const code = snap.exclusionCodes[c.slot];
                    return (
                      <tr key={c.slot}>
                        <td className="mono" style={{ fontWeight: 600 }}>#{c.slot}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{c.name}</div>
                          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
                            {c.licenseNo} · {c.roleLabel}
                          </div>
                        </td>
                        <td className="mono">
                          <div style={{ fontWeight: 600 }}>{formatUsdFromCents(c.priceCents)}</div>
                          <span
                            className={`tag ${isWinner ? 'tag-verified' : 'tag-private'}`}
                            style={{ marginTop: 3, fontSize: 10 }}
                          >
                            {isWinner ? 'PUBLIC WINNER' : 'NEVER ON CHAIN'}
                          </span>
                        </td>
                        <td className="mono" style={{ fontSize: 11.5 }}>
                          {shortHex(snap.bidCommitments[c.slot], 6)}
                        </td>
                        <td className="mono" style={{ fontSize: 11.5 }}>
                          {snap.deliveredFlags[c.slot] ? (
                            <span style={{ color: 'var(--status-verified)' }}>
                              {shortHex(snap.openingReceipts[c.slot], 6)}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--ink-muted)' }}>Pending</span>
                          )}
                        </td>
                        <td>
                          {isChallenger ? (
                            <span className="tag tag-contested">CONTESTED PROTEST</span>
                          ) : isWinner ? (
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
                            <span className="tag tag-neutral">EVALUATED (SEALED)</span>
                          ) : (
                            <span className="tag tag-neutral">SEALED</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn btn-sm"
                            disabled={!c.committed}
                            onClick={() => downloadReceipt(c.slot)}
                            title="Download JSON audit receipt"
                          >
                            <Download size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Real Circuit Execution Log */}
          <div className="sheet">
            <div className="sheet-header">
              <h3 className="sheet-title">Compiled Compact Circuit Execution Log</h3>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
                {session.logs.length} calls
              </span>
            </div>
            <div className="sheet-body" style={{ maxHeight: 220, overflowY: 'auto', padding: '10px 16px' }}>
              {session.logs.length === 0 ? (
                <div style={{ color: 'var(--ink-muted)', fontSize: 12.5 }}>
                  No circuit calls yet. Click <strong>1. Seal All 4 Contractor Bids</strong> above to begin.
                </div>
              ) : (
                session.logs.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      padding: '8px 0',
                      borderBottom: '1px solid var(--border-hairline)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <span
                        className={`tag ${entry.status === 'OK' ? 'tag-verified' : 'tag-contested'}`}
                        style={{ marginRight: 8, fontSize: 10 }}
                      >
                        {entry.status}
                      </span>
                      <strong className="mono">{entry.circuit}</strong> — {entry.detail}
                    </div>
                    <div className="mono" style={{ color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>
                      {entry.elapsedMs}ms
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT SIDE INSPECTOR: PERSISTENT PUBLIC LEDGER DIFF */}
        <aside className="sheet" style={{ position: 'sticky', top: 72 }}>
          <div className="sheet-header">
            <h2 className="sheet-title">
              <EyeOff size={15} color="#1B3B6F" />
              Midnight Public Ledger Inspector
            </h2>
            <span className="tag tag-navy">On-Chain View</span>
          </div>
          <div className="sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-secondary)' }}>
              Exact fields visible to any public observer or competing contractor on Midnight.
              Mutated fields flash on every circuit execution.
            </div>

            <dl className="summary-list" style={{ fontSize: 12 }}>
              <div className={`summary-row ${flash('phase')}`} style={{ gridTemplateColumns: '125px 1fr' }}>
                <dt>phase</dt>
                <dd className="mono" style={{ fontWeight: 600 }}>{Phase[snap.phase]}</dd>
              </div>
              <div className={`summary-row ${flash('bidCount')}`} style={{ gridTemplateColumns: '125px 1fr' }}>
                <dt>bidCount / frozen</dt>
                <dd className="mono">
                  {snap.bidCount} / {snap.frozenBidCount}
                </dd>
              </div>
              <div className={`summary-row ${flash('frozenCommitRoot')}`} style={{ gridTemplateColumns: '125px 1fr' }}>
                <dt>frozenCommitRoot</dt>
                <dd className="mono">{shortHex(snap.frozenCommitRoot, 8)}</dd>
              </div>
              <div className={`summary-row ${flash('usedNullifiers')}`} style={{ gridTemplateColumns: '125px 1fr' }}>
                <dt>usedNullifiers</dt>
                <dd className="mono">{snap.usedNullifiers.length} unique</dd>
              </div>
              <div className={`summary-row ${flash('awardedPrice')}`} style={{ gridTemplateColumns: '125px 1fr' }}>
                <dt>awardedPrice</dt>
                <dd className="mono" style={{ fontWeight: 600 }}>
                  {snap.hasWinner ? formatUsdFromCents(snap.awardedPrice) : '—'}
                </dd>
              </div>
              <div className={`summary-row ${flash('winnerSubListHash')}`} style={{ gridTemplateColumns: '125px 1fr' }}>
                <dt>winnerSubListHash</dt>
                <dd className="mono">{shortHex(snap.winnerSubListHash, 8)}</dd>
              </div>
              <div className={`summary-row ${flash('exclusionCodes')}`} style={{ gridTemplateColumns: '125px 1fr' }}>
                <dt>exclusionCodes</dt>
                <dd className="mono" style={{ fontSize: 11 }}>
                  [{snap.exclusionCodes.map((c) => ExclusionCode[c]).join(', ')}]
                </dd>
              </div>
              <div className={`summary-row ${flash('challengerSlot')}`} style={{ gridTemplateColumns: '125px 1fr' }}>
                <dt>challengerSlot</dt>
                <dd className="mono" style={{ color: snap.phase === Phase.CONTESTED ? 'var(--status-contested)' : undefined, fontWeight: 600 }}>
                  {snap.phase === Phase.CONTESTED ? `Slot #${snap.challengerSlot} (CONTESTED)` : '—'}
                </dd>
              </div>
            </dl>

            {/* Private Witness Seal Verification Box */}
            <div
              style={{
                background: 'var(--status-private-bg)',
                border: '1px solid var(--status-private-border)',
                borderRadius: 'var(--radius-sm)',
                padding: 12,
                fontSize: 12,
              }}
            >
              <div
                className="mono"
                style={{
                  fontWeight: 600,
                  color: 'var(--status-private)',
                  marginBottom: 6,
                  fontSize: 11,
                }}
              >
                ZERO-LEAKAGE CHECK (ABSENT FROM PUBLIC STATE)
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, color: '#312e81', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <li>
                  {snap.hasWinner
                    ? `Losing bid prices (${session.contractors
                        .filter((c) => c.slot !== snap.winningSlot)
                        .map((c) => formatUsdFromCents(c.priceCents))
                        .join(' / ')}): `
                    : 'All bid prices ($885k / $940k / $1.04M / $1.26M): '}
                  <strong>SEALED</strong>
                </li>
                <li>256-bit bid salts &amp; bidder secrets: <strong>SEALED</strong></li>
                <li>Losing firm IDs &amp; CA §4101 sub lists: <strong>SEALED</strong></li>
                <li>WebCrypto opening ciphertexts: <strong>OFF-CHAIN ONLY</strong></li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
