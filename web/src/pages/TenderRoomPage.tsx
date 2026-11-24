// SPDX-License-Identifier: Apache-2.0
// Assize — Route 2: Interactive Tender Room (/#tender)
// Executes the REAL compiled Compact 0.36.1 contract + real WebCrypto E2E envelopes locally.

import { useEffect, useState } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  EyeOff,
  FileCheck2,
  Gavel,
  Lock,
  RotateCcw,
  Scale,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { CopyableHash } from '../components/CopyButton';
import {
  AssizeBrowserSession,
  ExclusionCode,
  Phase,
  formatUsdFromCents,
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
  onNavigate: (r: AppRoute, tenderIdx?: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [logExpanded, setLogExpanded] = useState(true);
  const [lastAlert, setLastAlert] = useState<{
    kind: 'ok' | 'rejected' | 'contested';
    title: string;
    circuit?: string;
    detail: string;
    elapsedMs?: number;
  } | null>(null);
  const [snap, setSnap] = useState<LedgerSnapshot | null>(null);

  useEffect(() => {
    if (session) setSnap(session.getSnapshot());
  }, [session, session?.logs.length]);

  if (!session || !snap) {
    return (
      <div className="sheet">
        <div className="sheet-body" style={{ padding: 36 }}>
          <div className="kicker" style={{ marginBottom: 10 }}>
            Initializing Compact 0.36.1 WASM Circuit Runtime
          </div>
          <div className="skeleton-line" style={{ width: '58%', marginBottom: 10 }} />
          <div className="skeleton-line" style={{ width: '42%' }} />
        </div>
      </div>
    );
  }

  const run = async (
    action: () => Promise<{ ok: boolean; error?: string } | void>,
    okTitle: string,
    okDetail: string,
    kind: 'ok' | 'contested' = 'ok',
    circuitLabel?: string
  ) => {
    setBusy(true);
    try {
      const res = await action();
      setSnap(session.getSnapshot());
      onSessionUpdate();
      const latestLog = session.logs[0];
      if (res && !res.ok) {
        setLastAlert({
          kind: 'rejected',
          title: 'Compact 0.36.1 Circuit Assertion Rejected Transaction',
          circuit: circuitLabel ?? latestLog?.circuit,
          detail: res.error ?? 'Circuit invariant failed',
          elapsedMs: latestLog?.elapsedMs,
        });
      } else {
        setLastAlert({
          kind,
          title: okTitle,
          circuit: circuitLabel ?? latestLog?.circuit,
          detail: okDetail,
          elapsedMs: latestLog?.elapsedMs,
        });
        if (kind === 'contested') {
          const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          document
            .getElementById('tender-decree-anchor')
            ?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
        }
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

  const currentStepIdx =
    snap.phase === Phase.OPEN
      ? 0
      : snap.phase === Phase.REVEAL
        ? 1
        : snap.phase === Phase.EVALUATION
          ? 2
          : snap.phase === Phase.AWARDED || snap.phase === Phase.NO_AWARD
            ? 3
            : 4;

  const stepClass = (idx: number) => {
    if (snap.phase === Phase.CONTESTED && idx === 4) return 'phase-step contested';
    if (snap.phase === Phase.FINALIZED && idx === 4) return 'phase-step done';
    if (idx < currentStepIdx) return 'phase-step done';
    if (idx === currentStepIdx) return 'phase-step active';
    return 'phase-step';
  };

  const stepBadgeLabel = (idx: number) => {
    if (snap.phase === Phase.CONTESTED && idx === 4) return 'CONTESTED';
    if (snap.phase === Phase.FINALIZED && idx === 4) return 'FINALIZED';
    if (idx < currentStepIdx) return 'VERIFIED';
    if (idx === currentStepIdx) return 'ACTIVE';
    return 'PENDING';
  };

  const isOpenOrReveal = snap.phase === Phase.OPEN || snap.phase === Phase.REVEAL;
  const isEval = snap.phase === Phase.EVALUATION;
  const isAwarded = snap.phase === Phase.AWARDED;
  const isTerminal = snap.phase === Phase.CONTESTED || snap.phase === Phase.FINALIZED;

  return (
    <div>
      {/* Mandatory Execution Honesty Banner */}
      <div className="honesty-strip">
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: '1 1 420px' }}>
          <Lock size={15} color="#1B3B6F" />
          <span>
            <strong>Compiled Compact 0.36.1 Circuit Runtime · Local Execution</strong> (Unproven;
            Demo Role Keys Local). Every button below runs the real compiled WASM contract and real
            WebCrypto envelopes—while{' '}
            <button
              type="button"
              onClick={() => onNavigate('verify', 0)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--accent-navy)',
                fontWeight: 600,
                textDecoration: 'underline',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 'inherit',
              }}
            >
              /verify
            </button>{' '}
            queries the live Midnight Preview blockchain.
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => onNavigate('verify', 0)}
          >
            <ShieldCheck size={13} />
            Live Midnight /verify
          </button>
          <button
            type="button"
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

      {/* Tender Registry Header */}
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
          <div className="kicker">
            Docket {session.tenderCode} · {session.agencyName} · {session.statutoryBasis}
          </div>
          <h1
            className="serif"
            style={{
              margin: '4px 0 0 0',
              fontSize: 30,
              lineHeight: 1.15,
              letterSpacing: '-0.016em',
              fontWeight: 600,
            }}
          >
            {session.tenderTitle}
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="tag tag-neutral">N=4 Prequalified · Cap $1,200,000 · 10% Bond</span>
          <span className={phaseTagClass(snap.phase)} role="status" aria-live="polite">
            PHASE: {Phase[snap.phase]}
          </span>
        </div>
      </div>

      {/* 5-Stage Statutory Phase Stepper Rail */}
      <div id="tender-decree-anchor" className="phase-rail" role="list" aria-label="Statutory procurement lifecycle">
        {[
          { num: '01', name: 'OPEN', desc: 'Seal 4 Contractor Bids' },
          { num: '02', name: 'REVEAL', desc: 'WebCrypto Opening Receipts' },
          { num: '03', name: 'EVALUATION', desc: 'Complete-Set proveAward' },
          { num: '04', name: 'AWARDED', desc: 'ZK Protest Standing Window' },
          {
            num: '05',
            name: snap.phase === Phase.CONTESTED ? 'CONTESTED' : 'FINALIZED',
            desc:
              snap.phase === Phase.CONTESTED
                ? 'Judicial ZK Protest Recorded'
                : 'Permanent Ledger Settlement',
          },
        ].map((st, idx) => (
          <div key={st.num} className={stepClass(idx)} role="listitem">
            <div className="phase-step-top">
              <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-secondary)' }}>
                STAGE {st.num}
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  color:
                    snap.phase === Phase.CONTESTED && idx === 4
                      ? 'var(--status-contested)'
                      : idx <= currentStepIdx
                        ? 'var(--accent-navy)'
                        : 'var(--ink-muted)',
                }}
              >
                {stepBadgeLabel(idx)}
              </span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{st.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-secondary)', marginTop: 1 }}>
              {st.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Unmistakable Judicial CONTESTED Decree Banner */}
      {snap.phase === Phase.CONTESTED && (
        <section className="contested-decree" role="status" aria-live="polite">
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, maxWidth: 820 }}>
              <AlertOctagon size={22} color="#991B1B" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    color: 'var(--status-contested)',
                    textTransform: 'uppercase',
                  }}
                >
                  Judicial Procurement Decree · Phase: CONTESTED (challengeAward Verified)
                </div>
                <div className="serif" style={{ fontSize: 21, fontWeight: 700, color: '#7f1d1d', marginTop: 2 }}>
                  Zero-Knowledge Bid Protest Verified — Award Stayed Pending Due-Process Review
                </div>
                <div style={{ fontSize: 13, color: '#7f1d1d', marginTop: 4 }}>
                  Excluded contractor at <strong>Slot #{snap.challengerSlot} (Sierra Structural LLC)</strong>{' '}
                  proved pre-deadline commitment, on-chain WebCrypto receipt delivery, and{' '}
                  <code className="mono">myPrice &lt; $940,000</code> in zero knowledge—without
                  putting <strong>$885,000</strong> on the Midnight public ledger.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => onNavigate('certificate')}
              >
                <FileCheck2 size={14} />
                Open Official Award Certificate
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => downloadReceipt(1)}
              >
                <Download size={14} />
                Download Slot #1 Protest Receipt (JSON)
              </button>
            </div>
          </div>

          <div className="contested-decree-grid">
            <div>
              <div className="mono" style={{ fontSize: 10.5, color: '#7f1d1d', fontWeight: 600 }}>
                CHALLENGED PUBLIC AWARD
              </div>
              <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-primary)' }}>
                {formatUsdFromCents(snap.awardedPrice)} (Slot #{snap.winningSlot})
              </div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 10.5, color: '#7f1d1d', fontWeight: 600 }}>
                EXCLUDED CHALLENGER STANDING
              </div>
              <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--status-contested)' }}>
                Slot #{snap.challengerSlot} · NOT_RESPONSIBLE Challenged
              </div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 10.5, color: '#7f1d1d', fontWeight: 600 }}>
                CHALLENGER BID ON PUBLIC CHAIN
              </div>
              <div>
                <span className="tag tag-private" style={{ marginTop: 2 }}>
                  [SEALED — NOT ON CHAIN] ($885,000 Protected)
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Unmistakable Judicial FINALIZED Decree Banner */}
      {snap.phase === Phase.FINALIZED && (
        <section className="finalized-decree" role="status" aria-live="polite">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
              <CheckCircle2 size={22} color="#166534" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--status-verified)' }}>
                  UNCONTESTED PUBLIC-WORKS AWARD FINALIZED
                </div>
                <div className="serif" style={{ fontSize: 20, fontWeight: 700, color: '#14532d', marginTop: 2 }}>
                  Awarded {formatUsdFromCents(snap.awardedPrice)} to Slot #{snap.winningSlot} — Zero Losing Bids Disclosed
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onNavigate('certificate')}
              >
                <FileCheck2 size={14} />
                Open Official Award Certificate
              </button>
              <button type="button" className="btn" onClick={() => downloadReceipt(snap.winningSlot)}>
                <Download size={14} />
                Download Audit Receipt (JSON)
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Live Circuit Assertion / Execution Feedback Callout */}
      {lastAlert && snap.phase !== Phase.CONTESTED && (
        <div
          className={`alert-box ${
            lastAlert.kind === 'rejected' ? 'alert-contested' : 'alert-verified'
          }`}
          style={{ marginBottom: 18 }}
          role="status"
          aria-live="polite"
        >
          {lastAlert.kind === 'rejected' ? (
            <AlertOctagon size={18} style={{ marginTop: 2 }} />
          ) : (
            <CheckCircle2 size={18} style={{ marginTop: 2 }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <strong>{lastAlert.title}</strong>
              <span className="mono" style={{ fontSize: 11 }}>
                {lastAlert.circuit ? `${lastAlert.circuit}` : ''}
                {typeof lastAlert.elapsedMs === 'number' ? ` · ${lastAlert.elapsedMs}ms` : ''}
                {lastAlert.kind === 'rejected' ? ' · 0 ledger fields mutated' : ''}
              </span>
            </div>
            <div className="mono" style={{ fontSize: 12, marginTop: 3 }}>
              {lastAlert.detail}
            </div>
          </div>
        </div>
      )}

      {/* 8 / 4 Split: Left Role-Grouped Protocol Workbench, Right Persistent Public Ledger Inspector */}
      <div className="split-tender">
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
          {/* Role-Grouped Interactive Protocol Workbench */}
          <section className="sheet" aria-labelledby="workbench-heading">
            <div className="sheet-header">
              <div>
                <div className="kicker" style={{ marginBottom: 2 }}>
                  Multi-Actor State Machine · 45-Second Anti-Rigging Walkthrough
                </div>
                <h2 id="workbench-heading" className="sheet-title">
                  <Scale size={15} color="#1B3B6F" />
                  Role-Grouped Interactive Protocol Workbench
                </h2>
              </div>
              <span className={phaseTagClass(snap.phase)}>Active: {Phase[snap.phase]}</span>
            </div>

            <div className="sheet-body">
              <div className="workbench-lanes">
                {/* LANE A: Contractors & Permissionless Deadlines (OPEN & REVEAL) */}
                <div
                  className={`workbench-lane ${
                    isOpenOrReveal ? 'lane-active' : 'lane-done'
                  }`}
                >
                  <div className="lane-header">
                    <div className="lane-title">
                      <Lock size={14} color="#1B3B6F" />
                      <span>(A) Prequalified Contractors &amp; Permissionless Deadlines</span>
                    </div>
                    <span className={`tag ${isOpenOrReveal ? 'tag-navy' : 'tag-verified'}`}>
                      {isOpenOrReveal ? `Phase: ${Phase[snap.phase]}` : 'Committed & Receipted'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-secondary)', marginBottom: 10 }}>
                    Contractors anchor hiding commitments (<code className="mono">submitSealedBid</code>)
                    before close, freeze the commitment root (<code className="mono">closeBidding</code>),
                    and deliver off-chain WebCrypto envelopes with on-chain{' '}
                    <code className="mono">sha256</code> digests (<code className="mono">deliverOpening</code>).
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${snap.phase === Phase.OPEN && snap.bidCount < 4 ? 'btn-primary' : ''}`}
                      disabled={busy || snap.phase !== Phase.OPEN || snap.bidCount === 4}
                      onClick={() =>
                        void run(
                          () => session.submitAllFourSealedBids(),
                          'All 4 Sealed Bids Committed (submitSealedBid ×4)',
                          'Merkle membership, fresh nullifiers, and 10% surety bond ratios verified. Zero prices written on-chain.',
                          'ok',
                          'submitSealedBid'
                        )
                      }
                    >
                      <Lock size={13} />
                      1. Seal 4 Contractor Bids ({snap.bidCount}/4)
                    </button>

                    <button
                      type="button"
                      className={`btn btn-sm ${snap.phase === Phase.OPEN && snap.bidCount === 4 ? 'btn-primary' : ''}`}
                      disabled={busy || snap.phase !== Phase.OPEN || snap.bidCount === 0}
                      onClick={() =>
                        void run(
                          () => session.closeBidding(),
                          'Bidding Window Frozen (OPEN -> REVEAL)',
                          'frozenBidCount=4 & frozenCommitRoot locked permissionlessly on-chain.',
                          'ok',
                          'closeBidding'
                        )
                      }
                    >
                      2. Freeze Bidding Root (closeBidding)
                    </button>

                    <button
                      type="button"
                      className={`btn btn-sm ${
                        snap.phase === Phase.REVEAL && !snap.deliveredFlags.every(Boolean)
                          ? 'btn-primary'
                          : ''
                      }`}
                      disabled={
                        busy || snap.phase !== Phase.REVEAL || snap.deliveredFlags.every(Boolean)
                      }
                      onClick={() =>
                        void run(
                          () => session.deliverAllFourEncryptedOpenings(),
                          'All 4 WebCrypto Openings Encrypted & Receipted',
                          'RSA-OAEP-256 + AES-256-GCM envelopes decrypted off-chain by adjudicator; only sha256 digests anchored on-chain.',
                          'ok',
                          'deliverOpening'
                        )
                      }
                    >
                      <ShieldCheck size={13} />
                      3. Deliver 4 WebCrypto Receipts ({snap.deliveredFlags.filter(Boolean).length}/4)
                    </button>

                    <button
                      type="button"
                      className={`btn btn-sm ${
                        snap.phase === Phase.REVEAL && snap.deliveredFlags.every(Boolean)
                          ? 'btn-primary'
                          : ''
                      }`}
                      disabled={
                        busy || snap.phase !== Phase.REVEAL || !snap.deliveredFlags.every(Boolean)
                      }
                      onClick={() =>
                        void run(
                          () => session.closeReveal(),
                          'Reveal Barrier Locked (REVEAL -> EVALUATION)',
                          'closeReveal completed — adjudicator must now prove complete-set selection over all 4 frozen slots.',
                          'ok',
                          'closeReveal'
                        )
                      }
                    >
                      4. Lock Reveal Barrier (closeReveal)
                    </button>
                  </div>
                </div>

                {/* LANE B: Corrupt Adjudicator Rigging Battery (EVALUATION) */}
                <div
                  className={`workbench-lane ${
                    isEval ? 'lane-active-danger' : currentStepIdx > 2 ? 'lane-done' : 'lane-locked'
                  }`}
                >
                  <div className="lane-header">
                    <div className="lane-title">
                      <ShieldAlert size={14} color="#991B1B" />
                      <span>(B) Corrupt Adjudicator Rigging Attempts (Blocked by Compact 0.36.1)</span>
                    </div>
                    <span className={`tag ${isEval ? 'tag-contested' : 'tag-neutral'}`}>
                      {isEval ? 'Ready to Test Attacks' : 'Requires EVALUATION Phase'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-secondary)', marginBottom: 10 }}>
                    Attempt to rig the award toward preferred incumbent Slot #0 ($940,000) over honest
                    low bidder Slot #1 ($885,000). Each button invokes the real compiled{' '}
                    <code className="mono">proveAward</code> circuit and triggers a hard assertion revert.
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-danger-outline btn-sm"
                      disabled={busy || !isEval}
                      onClick={() =>
                        void run(
                          () => session.attemptSilentOmission(),
                          'Unexpected Pass',
                          '',
                          'ok',
                          'proveAward [Silent Omission]'
                        )
                      }
                    >
                      <ShieldAlert size={13} />
                      Attack 1: Silently Omit $885k Low Bid
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger-outline btn-sm"
                      disabled={busy || !isEval}
                      onClick={() =>
                        void run(
                          () => session.attemptWrongWinner(),
                          'Unexpected Pass',
                          '',
                          'ok',
                          'proveAward [Wrong Winner]'
                        )
                      }
                    >
                      <ShieldAlert size={13} />
                      Attack 2: Award $940k Over $885k
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger-outline btn-sm"
                      disabled={busy || !isEval}
                      onClick={() =>
                        void run(
                          () => session.attemptFakeNonReveal(),
                          'Unexpected Pass',
                          '',
                          'ok',
                          'proveAward [Fake NON_REVEAL]'
                        )
                      }
                    >
                      <ShieldAlert size={13} />
                      Attack 3: Fake NON_REVEAL on Receipted Slot #1
                    </button>
                  </div>
                </div>

                {/* LANE C: Adjudicator Award Disposition (EVALUATION -> AWARDED) */}
                <div
                  className={`workbench-lane ${
                    isEval ? 'lane-active' : currentStepIdx > 2 ? 'lane-done' : 'lane-locked'
                  }`}
                >
                  <div className="lane-header">
                    <div className="lane-title">
                      <Gavel size={14} color="#1B3B6F" />
                      <span>(C) Adjudicator Complete-Set Award Disposition (proveAward)</span>
                    </div>
                    <span className={`tag ${isEval ? 'tag-navy' : currentStepIdx > 2 ? 'tag-verified' : 'tag-neutral'}`}>
                      {isEval ? 'Select Disposition' : currentStepIdx > 2 ? 'Award Proven' : 'Locked'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-secondary)', marginBottom: 10 }}>
                    The only way to bypass Slot #1 ($885k) is to go on the permanent public record
                    with a reason-coded disqualification (<code className="mono">NOT_RESPONSIBLE</code> +{' '}
                    <code className="mono">evidenceHash</code>)—which immediately empowers Slot #1 to
                    file a zero-knowledge protest in Lane D.
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={busy || !isEval}
                      onClick={() =>
                        void run(
                          () => session.executePretextualExclusion(),
                          'Pretextual Exclusion Recorded -> Awarded $940,000 (Slot #0)',
                          'Slot #1 marked NOT_RESPONSIBLE with public evidenceHash; zero losing prices written on-chain. Proceed to Lane D to file ZK Protest!',
                          'ok',
                          'proveAward [Pretextual Exclusion]'
                        )
                      }
                    >
                      <AlertOctagon size={13} />
                      Pretextually Exclude Slot #1 (NOT_RESPONSIBLE) &amp; Award $940k
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busy || !isEval}
                      onClick={() =>
                        void run(
                          () => session.executeHonestAward(),
                          'Honest Award Proven -> Sierra Structural LLC ($885,000)',
                          'Complete-set frozenCommitRoot verified; Slot #3 proved OVER_BUDGET; all losing prices remain sealed off-chain.',
                          'ok',
                          'proveAward [Honest Award]'
                        )
                      }
                    >
                      <CheckCircle2 size={13} />
                      Execute Honest Lowest-Compliant Award ($885,000)
                    </button>
                  </div>
                </div>

                {/* LANE D: Excluded Low Bidder Zero-Knowledge Protest / Finalization (AWARDED) */}
                <div
                  className={`workbench-lane ${
                    isAwarded
                      ? snap.exclusionCodes[1] === ExclusionCode.NOT_RESPONSIBLE
                        ? 'lane-active-danger'
                        : 'lane-active'
                      : isTerminal
                        ? 'lane-done'
                        : 'lane-locked'
                  }`}
                >
                  <div className="lane-header">
                    <div className="lane-title">
                      <AlertOctagon size={14} color="#991B1B" />
                      <span>(D) Excluded Low Bidder Zero-Knowledge Protest &amp; Settlement</span>
                    </div>
                    <span
                      className={`tag ${
                        snap.phase === Phase.CONTESTED
                          ? 'tag-contested'
                          : snap.phase === Phase.FINALIZED
                            ? 'tag-verified'
                            : isAwarded
                              ? 'tag-warning'
                              : 'tag-neutral'
                      }`}
                    >
                      {snap.phase === Phase.CONTESTED
                        ? 'CONTESTED'
                        : snap.phase === Phase.FINALIZED
                          ? 'FINALIZED'
                          : isAwarded
                            ? 'Protest Window Open'
                            : 'Awaiting Award'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-secondary)', marginBottom: 10 }}>
                    Under <em>City of Inglewood</em> due-process standing, any receipted bidder
                    excluded on discretionary grounds can run <code className="mono">challengeAward</code>{' '}
                    to prove <code className="mono">myPrice &lt; awardedPrice</code> in zero
                    knowledge—flipping the contract to <code className="mono">CONTESTED</code> while
                    keeping their exact bid price sealed.
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={
                        busy ||
                        !isAwarded ||
                        snap.exclusionCodes[1] !== ExclusionCode.NOT_RESPONSIBLE
                      }
                      onClick={() =>
                        void run(
                          () => session.fileZkProtestSlot1(),
                          'TENDER CONTESTED — ZK Protest Verified Without Disclosing $885,000',
                          'Slot #1 proved pre-deadline commit + opening receipt + myPrice < $940,000 in zero knowledge.',
                          'contested',
                          'challengeAward'
                        )
                      }
                    >
                      <AlertOctagon size={13} />
                      File ZK Protest as Excluded Low Bidder (Slot #1 · challengeAward)
                    </button>

                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busy || !isAwarded}
                      onClick={() =>
                        void run(
                          () => session.finalizeAward(),
                          'Award Finalized Permanently (AWARDED -> FINALIZED)',
                          'Uncontested public-works award permanently settled on ledger.',
                          'ok',
                          'finalizeAward'
                        )
                      }
                    >
                      <CheckCircle2 size={13} />
                      Finalize Uncontested Award (finalizeAward)
                    </button>

                    {isTerminal && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => onNavigate('certificate')}
                      >
                        <FileCheck2 size={13} />
                        Inspect Printable Award Certificate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 4-Slot Civic Bid-Tabulation Sheet */}
          <section className="sheet" aria-labelledby="tabulation-heading">
            <div className="sheet-header">
              <div>
                <div className="kicker" style={{ marginBottom: 2 }}>
                  Dual-Ledger Slot Comparison
                </div>
                <h2 id="tabulation-heading" className="sheet-title">
                  4-Slot Sealed Bid Tabulation Sheet
                </h2>
              </div>
              <span className="tag tag-private">Indigo Columns = Local Witness Only</span>
            </div>
            <div className="table-scroll">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th scope="col">Slot</th>
                    <th scope="col" className="col-private">Contractor (Local)</th>
                    <th scope="col" className="col-private">Private Bid Price</th>
                    <th scope="col">On-Chain Commitment</th>
                    <th scope="col">Opening Receipt</th>
                    <th scope="col">Public Disposition</th>
                    <th scope="col">Audit JSON</th>
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
                        <td className="mono" style={{ fontWeight: 700 }}>#{c.slot}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{c.name}</div>
                          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
                            {c.licenseNo} · {c.roleLabel}
                          </div>
                        </td>
                        <td className="mono">
                          <div style={{ fontWeight: 700 }}>{formatUsdFromCents(c.priceCents)}</div>
                          <span
                            className={`tag ${isWinner ? 'tag-verified' : 'tag-private'}`}
                            style={{ marginTop: 3, fontSize: 9.5, padding: '1px 6px' }}
                          >
                            {isWinner ? 'PUBLIC WINNER' : 'SEALED · NOT ON CHAIN'}
                          </span>
                        </td>
                        <td>
                          <CopyableHash
                            hex={snap.bidCommitments[c.slot]}
                            prefixChars={6}
                            suffixChars={5}
                            label={`Slot ${c.slot} commitment`}
                          />
                        </td>
                        <td>
                          {snap.deliveredFlags[c.slot] ? (
                            <CopyableHash
                              hex={snap.openingReceipts[c.slot]}
                              prefixChars={6}
                              suffixChars={5}
                              label={`Slot ${c.slot} opening receipt`}
                            />
                          ) : (
                            <span className="mono text-muted" style={{ fontSize: 11.5 }}>
                              Pending
                            </span>
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
                            type="button"
                            className="btn btn-sm"
                            disabled={!c.committed}
                            onClick={() => downloadReceipt(c.slot)}
                            aria-label={`Download Slot ${c.slot} JSON audit receipt`}
                            title="Download JSON audit receipt"
                          >
                            <Download size={12} />
                            JSON
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* RIGHT SIDE INSPECTOR: STICKY MIDNIGHT PUBLIC LEDGER INSPECTOR */}
        <aside className="sheet" style={{ position: 'sticky', top: 72 }} aria-label="Midnight Public Ledger Inspector">
          <div className="sheet-header">
            <h2 className="sheet-title">
              <EyeOff size={15} color="#1B3B6F" />
              Midnight Public Ledger Inspector
            </h2>
            {session.lastChangedFields.length > 0 ? (
              <span className="tag tag-navy">+{session.lastChangedFields.length} Mutated</span>
            ) : (
              <span className="tag tag-neutral">On-Chain State</span>
            )}
          </div>

          <div className="sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-secondary)', lineHeight: 1.45 }}>
              Exact serialized fields visible to competing bidders and public observers on Midnight.
              Mutated ledger cells highlight on each circuit call.
            </div>

            <dl className="summary-list" style={{ fontSize: 12 }}>
              <div className={`summary-row ${flash('phase')}`} style={{ gridTemplateColumns: '124px minmax(0, 1fr)' }}>
                <dt className="mono">phase</dt>
                <dd>
                  <span className={phaseTagClass(snap.phase)}>{Phase[snap.phase]}</span>
                </dd>
              </div>

              <div className={`summary-row ${flash('tenderId')}`} style={{ gridTemplateColumns: '124px minmax(0, 1fr)' }}>
                <dt className="mono">tenderId</dt>
                <dd>
                  <CopyableHash hex={snap.tenderId} prefixChars={6} suffixChars={5} label="tenderId" />
                </dd>
              </div>

              <div className={`summary-row ${flash('bidCount')} ${flash('frozenBidCount')}`} style={{ gridTemplateColumns: '124px minmax(0, 1fr)' }}>
                <dt className="mono">bidCount / frozen</dt>
                <dd className="mono" style={{ fontWeight: 600 }}>
                  {snap.bidCount} committed / {snap.frozenBidCount} frozen
                </dd>
              </div>

              <div className={`summary-row ${flash('frozenCommitRoot')}`} style={{ gridTemplateColumns: '124px minmax(0, 1fr)' }}>
                <dt className="mono">frozenCommitRoot</dt>
                <dd>
                  <CopyableHash
                    hex={snap.frozenCommitRoot}
                    prefixChars={6}
                    suffixChars={5}
                    label="frozenCommitRoot"
                  />
                </dd>
              </div>

              <div className={`summary-row ${flash('usedNullifiers')}`} style={{ gridTemplateColumns: '124px minmax(0, 1fr)' }}>
                <dt className="mono">usedNullifiers</dt>
                <dd className="mono">{snap.usedNullifiers.length} unlinkable set entries</dd>
              </div>

              <div className={`summary-row ${flash('awardedPrice')}`} style={{ gridTemplateColumns: '124px minmax(0, 1fr)' }}>
                <dt className="mono">awardedPrice</dt>
                <dd className="mono" style={{ fontWeight: 700 }}>
                  {snap.hasWinner
                    ? `${formatUsdFromCents(snap.awardedPrice)} (Slot #${snap.winningSlot})`
                    : '—'}
                </dd>
              </div>

              <div className={`summary-row ${flash('winnerSubListHash')}`} style={{ gridTemplateColumns: '124px minmax(0, 1fr)' }}>
                <dt className="mono">winnerSubListHash</dt>
                <dd>
                  <CopyableHash
                    hex={snap.winnerSubListHash}
                    prefixChars={6}
                    suffixChars={5}
                    label="winnerSubListHash"
                  />
                </dd>
              </div>

              <div className={`summary-row ${flash('exclusionCodes')}`} style={{ gridTemplateColumns: '124px minmax(0, 1fr)' }}>
                <dt className="mono">exclusionCodes</dt>
                <dd style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {snap.exclusionCodes.map((code, idx) => (
                    <span
                      key={idx}
                      className={`tag ${
                        code === ExclusionCode.NONE
                          ? 'tag-neutral'
                          : code === ExclusionCode.OVER_BUDGET
                            ? 'tag-warning'
                            : 'tag-contested'
                      }`}
                      style={{ fontSize: 9.5, padding: '1px 5px' }}
                    >
                      #{idx}:{ExclusionCode[code]}
                    </span>
                  ))}
                </dd>
              </div>

              <div className={`summary-row ${flash('challengerSlot')}`} style={{ gridTemplateColumns: '124px minmax(0, 1fr)' }}>
                <dt className="mono">challengerSlot</dt>
                <dd
                  className="mono"
                  style={{
                    color: snap.phase === Phase.CONTESTED ? 'var(--status-contested)' : undefined,
                    fontWeight: 700,
                  }}
                >
                  {snap.phase === Phase.CONTESTED ? `Slot #${snap.challengerSlot} (CONTESTED)` : '—'}
                </dd>
              </div>
            </dl>

            {/* Dynamic Zero-Leakage Audit Box */}
            <div
              style={{
                background: 'var(--status-private-bg)',
                border: '1px solid var(--status-private-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '11px 13px',
                fontSize: 12,
              }}
            >
              <div
                className="mono"
                style={{
                  fontWeight: 700,
                  color: 'var(--status-private)',
                  marginBottom: 7,
                  fontSize: 10.5,
                  letterSpacing: '0.04em',
                }}
              >
                DYNAMIC ZERO-LEAKAGE AUDIT (ABSENT ON-CHAIN)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, color: '#282469' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <CheckCircle2 size={13} color="#3730A3" style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>
                    {snap.hasWinner
                      ? `Losing prices (${session.contractors
                          .filter((c) => c.slot !== snap.winningSlot)
                          .map((c) => formatUsdFromCents(c.priceCents))
                          .join(' · ')}): `
                      : 'All 4 bid prices ($885k · $940k · $1.04M · $1.26M): '}
                    <strong>SEALED</strong>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <CheckCircle2 size={13} color="#3730A3" style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>256-bit bid salts &amp; bidder secrets: <strong>SEALED</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <CheckCircle2 size={13} color="#3730A3" style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>Losing firm IDs &amp; CA § 4101 sub lists: <strong>SEALED</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <CheckCircle2 size={13} color="#3730A3" style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>WebCrypto opening ciphertexts: <strong>OFF-CHAIN ONLY</strong></span>
                </div>
              </div>
            </div>

            {/* Expandable Circuit Execution Transcript Log inside Inspector */}
            <div
              style={{
                border: '1px solid var(--border-hairline)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-paper)',
              }}
            >
              <button
                type="button"
                onClick={() => setLogExpanded((v) => !v)}
                aria-expanded={logExpanded}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  background: 'var(--bg-recessed)',
                  border: 'none',
                  borderBottom: logExpanded ? '1px solid var(--border-hairline)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--ink-primary)',
                }}
              >
                <span>
                  Circuit Execution Transcript{' '}
                  <span className="mono" style={{ color: 'var(--ink-muted)', fontWeight: 500 }}>
                    ({session.logs.length})
                  </span>
                </span>
                {logExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {logExpanded && (
                <div style={{ maxHeight: 215, overflowY: 'auto', padding: '8px 11px' }}>
                  {session.logs.length === 0 ? (
                    <div style={{ color: 'var(--ink-muted)', fontSize: 11.5, padding: '4px 0' }}>
                      No circuit executions yet. Start in Lane A with{' '}
                      <strong>1. Seal 4 Contractor Bids</strong>.
                    </div>
                  ) : (
                    session.logs.map((entry) => (
                      <div
                        key={entry.id}
                        style={{
                          padding: '7px 0',
                          borderBottom: '1px solid var(--border-hairline)',
                          fontSize: 11.5,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 6,
                          }}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <span
                              className={`tag ${
                                entry.status === 'OK' ? 'tag-verified' : 'tag-contested'
                              }`}
                              style={{ fontSize: 9.5, padding: '1px 5px' }}
                            >
                              {entry.status}
                            </span>
                            <strong className="mono" style={{ fontSize: 11 }}>
                              {entry.circuit}
                            </strong>
                          </span>
                          <span className="mono text-muted" style={{ fontSize: 10.5 }}>
                            {entry.elapsedMs}ms
                          </span>
                        </div>
                        <div style={{ color: 'var(--ink-secondary)', marginTop: 3, lineHeight: 1.4 }}>
                          {entry.detail}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
