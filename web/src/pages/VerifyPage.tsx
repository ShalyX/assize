// SPDX-License-Identifier: Apache-2.0
// Assize — Route 3: Live Midnight Ledger 9 GraphQL Indexer Verifier (/verify)

import { useEffect, useState } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
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
  const [customAddress, setCustomAddress] = useState(PREPROD_MANIFEST[0]?.contractAddress ?? '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IndexerQueryResult | null>(null);

  const selected = PREPROD_MANIFEST[selectedIdx];
  const targetAddr = customAddress.trim() || selected.contractAddress || '';

  const runQuery = async (addrOverride?: string, outcomeOverride?: 'FINALIZED' | 'CONTESTED') => {
    setLoading(true);
    const addr = (addrOverride ?? targetAddr).trim();
    const res = await queryMidnightIndexerContract(
      addr,
      indexerUrl,
      projectId,
      outcomeOverride ?? selected.expectedOutcome
    );
    setResult(res);
    setLoading(false);
  };

  // Auto-verify Tender A directly from Midnight Preview GraphQL on first mount!
  useEffect(() => {
    if (PREPROD_MANIFEST[0]?.contractAddress) {
      void runQuery(PREPROD_MANIFEST[0].contractAddress, PREPROD_MANIFEST[0].expectedOutcome);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div className="mono" style={{ fontSize: 11, color: 'var(--accent-navy)', fontWeight: 600 }}>
          INDEPENDENT WALLET-LESS VERIFICATION · MIDNIGHT PREVIEW (LEDGER 9) LIVE GRAPHQL INDEXER
        </div>
        <h1 className="serif" style={{ margin: '4px 0 6px 0', fontSize: 30, fontWeight: 600 }}>
          Verify Live On-Chain Contract State
        </h1>
        <p style={{ margin: 0, color: 'var(--ink-secondary)', maxWidth: 760 }}>
          Both reference tenders below are deployed and executed live on{' '}
          <strong>Midnight Preview (Ledger 9)</strong> with <strong>26 real ZK-proven transactions</strong>{' '}
          via <code className="mono">proof-server:9.0.2</code>. Query them directly from Midnight&apos;s
          open public GraphQL Indexer—no wallet, no API key, and no trust in the Assize frontend required.
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
              borderWidth: selectedIdx === idx ? 2 : 1,
              cursor: 'pointer',
            }}
            onClick={() => {
              setSelectedIdx(idx);
              setCustomAddress(entry.contractAddress ?? '');
              if (entry.contractAddress) {
                void runQuery(entry.contractAddress, entry.expectedOutcome);
              }
            }}
          >
            <div className="sheet-header">
              <span className="sheet-title">{entry.label}</span>
              <span
                className={`tag ${
                  entry.expectedOutcome === 'FINALIZED' ? 'tag-verified' : 'tag-contested'
                }`}
              >
                {entry.verifiedPhase ?? entry.expectedOutcome}
              </span>
            </div>
            <div className="sheet-body" style={{ fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="mono" style={{ color: 'var(--ink-secondary)', wordBreak: 'break-all' }}>
                Contract:{' '}
                <strong style={{ color: 'var(--ink-primary)' }}>{entry.contractAddress}</strong>
              </div>
              <div style={{ color: 'var(--ink-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span>
                  Awarded:{' '}
                  <strong className="mono" style={{ color: 'var(--ink-primary)' }}>
                    ${(Number(entry.verifiedAwardedPriceCents ?? 0) / 100).toLocaleString('en-US')}
                  </strong>
                </span>
                <span>ZK Transactions: <strong>{entry.transactions.length}</strong></span>
                <span>Network: <strong className="mono">preview (Ledger 9)</strong></span>
              </div>
              {entry.verifiedZeroLosingPricesOnChain && (
                <div className="mono" style={{ fontSize: 11, color: 'var(--status-verified)', fontWeight: 600 }}>
                  ZERO-LEAKAGE AUDIT: PASS (0 losing prices in serialized on-chain state)
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Live GraphQL Query Bar */}
      <div className="sheet" style={{ marginBottom: 20 }}>
        <div className="sheet-header">
          <h2 className="sheet-title">
            <Search size={15} color="#1B3B6F" />
            Query Live Midnight GraphQL Indexer
          </h2>
          <span className="tag tag-verified">Live Public GraphQL POST</span>
        </div>
        <div className="sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="grid-2">
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 600 }}>
              Contract Address (Hex)
              <input
                type="text"
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
                placeholder="Paste deployed Midnight contract address…"
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
              GraphQL Indexer Endpoint (Preview open; Preprod via Blockfrost)
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
          {indexerUrl.includes('blockfrost') && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 600 }}>
              Optional Blockfrost Project ID (only needed for Preprod/Mainnet Blockfrost URLs)
              <input
                type="password"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="nightpreprod…"
                className="mono"
                style={{
                  padding: '8px 10px',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12.5,
                }}
              />
            </label>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" disabled={loading} onClick={() => void runQuery()}>
              <RefreshCw size={14} />
              {loading ? 'Querying Live Midnight Indexer…' : 'Query Live On-Chain State'}
            </button>
            {selected.contractAddress && (
              <a
                href={`${selected.explorerBaseUrl}/contract/${selected.contractAddress}`}
                target="_blank"
                rel="noreferrer"
                className="btn"
                style={{ textDecoration: 'none' }}
              >
                <ExternalLink size={14} />
                Open on Midnight Preview Explorer
              </a>
            )}
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
                    ? `Live On-Chain State Verified — Block #${result.blockHeight ?? 'live'}`
                    : 'Indexer Query Did Not Return Contract State'}
                </div>
                {result.ok && result.latestTxHash && (
                  <div className="mono" style={{ fontSize: 12, marginTop: 3, wordBreak: 'break-all' }}>
                    Latest Tx Hash: {result.latestTxHash}
                  </div>
                )}
                <div className="mono" style={{ fontSize: 12, marginTop: 3, wordBreak: 'break-all' }}>
                  {result.ok
                    ? `Raw on-chain state (${(result.rawStateHex?.length ?? 0) / 2} bytes): ${result.rawStateHex?.slice(0, 96)}…`
                    : result.error}
                </div>
                {result.ok && (
                  <div className="mono" style={{ fontSize: 11.5, marginTop: 4, fontWeight: 600 }}>
                    Live Byte-Level Zero-Leakage Check:{' '}
                    {result.zeroLosingPricesConfirmed
                      ? 'PASS — 0 losing bid prices found in serialized on-chain state'
                      : 'WARNING — unexpected byte pattern'}
                  </div>
                )}
                <div className="mono" style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 4 }}>
                  Endpoint: {result.indexerUrl} · Checked: {result.checkedAt}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recorded On-Chain Transaction Ledger for Selected Tender */}
      <div className="sheet" style={{ marginBottom: 20 }}>
        <div className="sheet-header">
          <h3 className="sheet-title">
            Verified On-Chain Transaction Trail — {selected.tenderCode} ({selected.transactions.length} ZK Txs)
          </h3>
          <span className="tag tag-navy">Compact 0.36.1 · proof-server:9.0.2</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Step</th>
                <th>Circuit</th>
                <th>Block</th>
                <th>Transaction Hash</th>
                <th>Audit Note</th>
              </tr>
            </thead>
            <tbody>
              {selected.transactions.map((tx) => (
                <tr key={tx.txHash}>
                  <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{tx.step}</td>
                  <td>
                    <span className="tag tag-neutral">{tx.circuit}</span>
                  </td>
                  <td className="mono">#{tx.blockHeight}</td>
                  <td className="mono" style={{ fontSize: 11.5 }}>
                    <a
                      href={`${selected.explorerBaseUrl}/tx/${tx.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--accent-navy)', textDecoration: 'underline' }}
                    >
                      0x{tx.txHash.slice(0, 10)}…{tx.txHash.slice(-8)}
                    </a>
                  </td>
                  <td style={{ color: 'var(--ink-secondary)', fontSize: 12.5 }}>{tx.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Independent CLI Verification Reference */}
      <div className="sheet">
        <div className="sheet-header">
          <h3 className="sheet-title">
            <ShieldCheck size={15} color="#166534" />
            Independent CLI Verification (<code className="mono">npm run verify:onchain</code>)
          </h3>
        </div>
        <div className="sheet-body" style={{ fontSize: 13, color: 'var(--ink-secondary)' }}>
          Every contract address and transaction hash in <code className="mono">deployments/preview.json</code>{' '}
          can be independently verified from any terminal with <code className="mono">npm run verify:onchain</code>{' '}
          directly against <code className="mono">https://indexer.preview.midnight.network/api/v4/graphql</code>—no
          wallet, no API key, and no trust in this web interface required.
        </div>
      </div>
    </div>
  );
}
