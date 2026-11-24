// SPDX-License-Identifier: Apache-2.0
// Assize — Route 3: Live Midnight Preprod GraphQL Indexer Verifier (/verify)

import { useState } from 'react';
import { AlertOctagon, CheckCircle2, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import {
  PREPROD_INDEXER_DEFAULT,
  PREPROD_MANIFEST,
  queryMidnightIndexerContract,
  type IndexerQueryResult,
} from '../lib/preprodVerifier';

export function VerifyPage() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [indexerUrl, setIndexerUrl] = useState(PREPROD_INDEXER_DEFAULT);
  const [projectId, setProjectId] = useState('');
  const [customAddress, setCustomAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IndexerQueryResult | null>(null);

  const selected = PREPROD_MANIFEST[selectedIdx];
  const targetAddr = customAddress.trim() || selected.contractAddress || '';

  const runQuery = async () => {
    setLoading(true);
    const res = await queryMidnightIndexerContract(targetAddr, indexerUrl, projectId);
    setResult(res);
    setLoading(false);
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div className="mono" style={{ fontSize: 11, color: 'var(--accent-navy)', fontWeight: 600 }}>
          INDEPENDENT WALLET-LESS VERIFICATION · MIDNIGHT PREPROD GRAPHQL INDEXER
        </div>
        <h1 className="serif" style={{ margin: '4px 0 6px 0', fontSize: 30, fontWeight: 600 }}>
          Verify Live On-Chain Contract State
        </h1>
        <p style={{ margin: 0, color: 'var(--ink-secondary)', maxWidth: 720 }}>
          Query any deployed Assize contract directly from Midnight&apos;s public Preprod GraphQL
          Indexer—no wallet, no DUST, and no trust in the Assize frontend required.
        </p>
      </div>

      {/* Manifest Selector Cards */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        {PREPROD_MANIFEST.map((entry, idx) => (
          <div
            key={entry.tenderCode}
            className="sheet"
            style={{
              borderColor: selectedIdx === idx ? 'var(--accent-navy)' : undefined,
              cursor: 'pointer',
            }}
            onClick={() => {
              setSelectedIdx(idx);
              setCustomAddress(entry.contractAddress ?? '');
            }}
          >
            <div className="sheet-header">
              <span className="sheet-title">{entry.label}</span>
              <span
                className={`tag ${
                  entry.expectedOutcome === 'FINALIZED' ? 'tag-verified' : 'tag-contested'
                }`}
              >
                {entry.expectedOutcome}
              </span>
            </div>
            <div className="sheet-body" style={{ fontSize: 12.5 }}>
              <div className="mono" style={{ color: 'var(--ink-secondary)', marginBottom: 4 }}>
                Contract:{' '}
                {entry.contractAddress ? (
                  <strong style={{ color: 'var(--ink-primary)' }}>{entry.contractAddress}</strong>
                ) : (
                  <span className="tag tag-warning">Awaiting Funded Preprod Deployment</span>
                )}
              </div>
              <div style={{ color: 'var(--ink-muted)' }}>
                Recorded transactions: {entry.transactions.length} · Network: {entry.network}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Live GraphQL Query Bar */}
      <div className="sheet" style={{ marginBottom: 20 }}>
        <div className="sheet-header">
          <h2 className="sheet-title">
            <Search size={15} color="#1B3B6F" />
            Query Midnight Preprod Indexer
          </h2>
          <span className="tag tag-navy">Live GraphQL POST</span>
        </div>
        <div className="sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="grid-2">
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 600 }}>
              Contract Address (Hex)
              <input
                type="text"
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
                placeholder="Paste deployed Midnight Preprod contract address…"
                className="mono"
                style={{
                  padding: '8px 10px',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12.5,
                }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 600 }}>
              GraphQL Indexer Endpoint (Blockfrost Preprod)
              <input
                type="text"
                value={indexerUrl}
                onChange={(e) => setIndexerUrl(e.target.value)}
                className="mono"
                style={{
                  padding: '8px 10px',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12.5,
                }}
              />
            </label>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 600 }}>
            Blockfrost Preprod Project ID (sent via <code className="mono">project_id</code> header; never persisted)
            <input
              type="password"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="preprod…"
              className="mono"
              style={{
                padding: '8px 10px',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12.5,
              }}
            />
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" disabled={loading} onClick={runQuery}>
              <RefreshCw size={14} />
              {loading ? 'Querying Live Indexer…' : 'Query Live Preprod State'}
            </button>
          </div>

          {result && (
            <div
              className={`alert-box ${result.ok ? 'alert-verified' : 'alert-warning'}`}
              style={{ marginTop: 6 }}
            >
              {result.ok ? (
                <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              ) : (
                <AlertOctagon size={18} style={{ flexShrink: 0 }} />
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600 }}>
                  {result.ok
                    ? `Indexed State Verified (Block #${result.blockHeight ?? 'live'})`
                    : 'Indexer Query Did Not Return Contract State'}
                </div>
                <div className="mono" style={{ fontSize: 12, marginTop: 3, wordBreak: 'break-all' }}>
                  {result.ok
                    ? `Raw state bytes (${result.rawStateHex?.length ?? 0} hex chars): ${result.rawStateHex?.slice(0, 96)}…`
                    : result.error}
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 4 }}>
                  Endpoint: {result.indexerUrl} · Checked: {result.checkedAt}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Zero-Leakage Guarantee Reference */}
      <div className="sheet">
        <div className="sheet-header">
          <h3 className="sheet-title">
            <ShieldCheck size={15} color="#166534" />
            Independent CLI Verification (<code className="mono">npm run verify:onchain</code>)
          </h3>
        </div>
        <div className="sheet-body" style={{ fontSize: 13, color: 'var(--ink-secondary)' }}>
          Every deployment manifest written to <code className="mono">deployments/preprod.json</code>{' '}
          is independently auditable from a clean terminal without trusting this web interface.
          Assize never fabricates transaction hashes or simulates on-chain deployment states.
        </div>
      </div>
    </div>
  );
}
