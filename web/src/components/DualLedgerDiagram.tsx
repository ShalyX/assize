// SPDX-License-Identifier: Apache-2.0
// Assize — Bespoke Midnight Dual-Ledger Architecture & Privacy Boundary Diagram

import { EyeOff, Lock, ShieldCheck } from 'lucide-react';

export function DualLedgerDiagram() {
  return (
    <section className="sheet" aria-labelledby="dual-ledger-heading" style={{ marginBottom: 24 }}>
      <div className="sheet-header">
        <div>
          <div className="kicker" style={{ marginBottom: 2 }}>
            Cryptographic Architecture · Removal Test Proof
          </div>
          <h2 id="dual-ledger-heading" className="sheet-title" style={{ fontSize: 15 }}>
            Midnight Dual-Ledger Privacy Boundary (Private Witness &amp; WebCrypto vs. Public Compact 0.36.1 Ledger)
          </h2>
        </div>
        <span className="tag tag-navy">8 Compact Circuits · zkir-3.2.1</span>
      </div>

      <div className="arch-diagram">
        {/* LEFT COLUMN: PRIVATE WITNESS & WEBCRYPTO LAYER */}
        <div className="arch-pane arch-pane-private">
          <div className="arch-pane-head">
            <span className="tag tag-private">
              <EyeOff size={11} />
              Layer 1 · Private Witness &amp; WebCrypto
            </span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--status-private)', fontWeight: 600 }}>
              NEVER ON CHAIN
            </span>
          </div>

          <div className="arch-block">
            <div className="arch-block-title">
              <Lock size={13} color="#3730A3" />
              Bidder Local Witness (Proved in Browser / Local Proof Server)
            </div>
            <ul className="arch-list">
              <li>
                <span className="mono">price</span> &amp; <span className="mono">bondAmount</span>{' '}
                <span className="text-muted">($885k, $940k, $1.04M, $1.26M)</span>
              </li>
              <li>
                <span className="mono">bidSalt</span> (256-bit) &amp; <span className="mono">bidderSecret</span>
              </li>
              <li>
                Losing <span className="mono">firmIdHash</span> &amp; CA § 4101{' '}
                <span className="mono">subListHash</span>
              </li>
              <li>
                Depth-5 <span className="mono">MerkleTreePath</span> proving prequalification anonymously
              </li>
            </ul>
          </div>

          <div className="arch-block" style={{ marginBottom: 0 }}>
            <div className="arch-block-title">
              <Lock size={13} color="#3730A3" />
              Post-Deadline Off-Chain Envelope (Adjudicator Only)
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-secondary)', lineHeight: 1.48 }}>
              Hybrid <code className="mono">RSA-OAEP-256 + AES-256-GCM</code> ciphertext bound via AAD to{' '}
              <code className="mono">tenderId || slotIndex</code>. Zero ciphertext bytes are ever posted on-chain.
            </div>
          </div>
        </div>

        {/* CENTER BRIDGE: COMPACT 0.36.1 ZK PROOF BOUNDARY */}
        <div className="arch-bridge" aria-hidden="true">
          <div className="arch-bridge-card">
            <div className="kicker" style={{ textAlign: 'center', color: 'var(--accent-navy)' }}>
              ZK Proof Barrier
            </div>
            <svg
              viewBox="0 0 180 148"
              width="100%"
              height="148"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ display: 'block', margin: '6px auto' }}
            >
              {/* Vertical cryptographic boundary rule */}
              <line x1="90" y1="6" x2="90" y2="142" stroke="#1B3B6F" strokeWidth="1.5" strokeDasharray="4 3" />

              {/* Gate 1: submitSealedBid */}
              <line x1="8" y1="26" x2="166" y2="26" stroke="#1B3B6F" strokeWidth="1.5" />
              <polygon points="172,26 164,22 164,30" fill="#1B3B6F" />
              <rect x="26" y="15" width="128" height="22" rx="3" fill="#FFFFFF" stroke="#1B3B6F" strokeWidth="1.2" />
              <text x="90" y="29" textAnchor="middle" fill="#1B3B6F" fontFamily="JetBrains Mono, monospace" fontSize="9.5" fontWeight="600">
                submitSealedBid
              </text>

              {/* Gate 2: deliverOpening */}
              <line x1="8" y1="62" x2="166" y2="62" stroke="#1B3B6F" strokeWidth="1.5" />
              <polygon points="172,62 164,58 164,66" fill="#1B3B6F" />
              <rect x="28" y="51" width="124" height="22" rx="3" fill="#FFFFFF" stroke="#1B3B6F" strokeWidth="1.2" />
              <text x="90" y="65" textAnchor="middle" fill="#1B3B6F" fontFamily="JetBrains Mono, monospace" fontSize="9.5" fontWeight="600">
                deliverOpening
              </text>

              {/* Gate 3: proveAward */}
              <line x1="8" y1="98" x2="166" y2="98" stroke="#166534" strokeWidth="1.5" />
              <polygon points="172,98 164,94 164,102" fill="#166534" />
              <rect x="34" y="87" width="112" height="22" rx="3" fill="#ECFDF5" stroke="#166534" strokeWidth="1.2" />
              <text x="90" y="101" textAnchor="middle" fill="#166534" fontFamily="JetBrains Mono, monospace" fontSize="9.5" fontWeight="600">
                proveAward
              </text>

              {/* Gate 4: challengeAward */}
              <line x1="8" y1="132" x2="166" y2="132" stroke="#991B1B" strokeWidth="1.5" />
              <polygon points="172,132 164,128 164,136" fill="#991B1B" />
              <rect x="26" y="121" width="128" height="22" rx="3" fill="#FEF2F2" stroke="#991B1B" strokeWidth="1.2" />
              <text x="90" y="135" textAnchor="middle" fill="#991B1B" fontFamily="JetBrains Mono, monospace" fontSize="9.5" fontWeight="600">
                challengeAward
              </text>
            </svg>
            <div className="mono" style={{ fontSize: 10.5, textAlign: 'center', color: 'var(--ink-secondary)' }}>
              Explicit <code className="mono">disclose()</code> only · 0 taint warnings
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: MIDNIGHT PUBLIC COMPACT LEDGER */}
        <div className="arch-pane arch-pane-public">
          <div className="arch-pane-head">
            <span className="tag tag-verified">
              <ShieldCheck size={11} />
              Layer 2 · Midnight Public Ledger 9
            </span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--status-verified)', fontWeight: 600 }}>
              PUBLICLY VERIFIABLE
            </span>
          </div>

          <div className="arch-block">
            <div className="arch-block-title">
              <ShieldCheck size={13} color="#166534" />
              Immutable Commitments &amp; Anti-Rigging Locks
            </div>
            <ul className="arch-list">
              <li>
                <span className="mono">prequalRoot</span> + unlinkable{' '}
                <span className="mono">usedNullifiers</span> +{' '}
                <span className="mono">bidCommitments[0..3]</span>
              </li>
              <li>
                <span className="mono">frozenBidCount</span> &amp;{' '}
                <span className="mono">frozenCommitRoot</span> (blocks silent omission)
              </li>
              <li>
                <span className="mono">openingReceipts[0..3]</span> (<code className="mono">sha256</code>{' '}
                digest blocks fake <code className="mono">NON_REVEAL</code>)
              </li>
            </ul>
          </div>

          <div className="arch-block" style={{ marginBottom: 0 }}>
            <div className="arch-block-title">
              <ShieldCheck size={13} color="#166534" />
              Selective Award Accountability &amp; ZK Protest
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-secondary)', lineHeight: 1.48 }}>
              Publishes <strong>winning price &amp; CA § 4101 subListHash only</strong>, typed{' '}
              <code className="mono">exclusionCodes</code> + <code className="mono">evidenceHash</code>, and{' '}
              <span className="tag tag-contested" style={{ fontSize: 10, padding: '1px 6px' }}>CONTESTED</span>{' '}
              protest standing—with <strong>0 losing prices on-chain</strong>.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
