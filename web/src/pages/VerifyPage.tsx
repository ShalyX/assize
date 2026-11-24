// SPDX-License-Identifier: Apache-2.0
// Assize — Route 3: Live Midnight Ledger 9 GraphQL Indexer Verifier (/#verify)

import { useEffect, useState } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { CopyButton, CopyableHash } from '../components/CopyButton';
import {
  PREPROD_INDEXER_DEFAULT,
  PREPROD_MANIFEST,
  queryMidnightIndexerContract,
  type IndexerQueryResult,
} from '../lib/preprodVerifier';

function circuitTagClass(circuit: string): string {
  if (circuit === 'challengeAward') return 'tag tag-contested';
  if (circuit === 'proveAward' || circuit === 'finalizeAward') return 'tag tag-verified';
  if (circuit === 'submitSealedBid') return 'tag tag-private';
  if (circuit === 'closeBidding' || circuit === 'closeReveal') return 'tag tag-navy';
  return 'tag tag-neutral';
}

export function VerifyPage({
  selectedIdx,
  onSelectTender,
}: {
  selectedIdx: number;
  onSelectTender: (idx: number) => void;
}) {
  const safeIdx = PREPROD_MANIFEST[selectedIdx] ? selectedIdx : 0;
  const selected = PREPROD_MANIFEST[safeIdx];

  const [indexerUrl, setIndexerUrl] = useState(PREPROD_INDEXER_DEFAULT);
  const [projectId, setProjectId] = useState('');
  const [customAddress, setCustomAddress] = useState(selected.contractAddress ?? '');
  const [loading, setLoading] = useState(false);
  const [rawExpanded, setRawExpanded] = useState(false);
  const [result, setResult] = useState<IndexerQueryResult | null>(null);

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

  // Sync address & auto-query whenever selectedIdx changes (including initial load & hash deep-links)
  useEffect(() => {
    const entry = PREPROD_MANIFEST[safeIdx];
    if (entry?.contractAddress) {
      setCustomAddress(entry.contractAddress);
      setRawExpanded(false);
      void runQuery(entry.contractAddress, entry.expectedOutcome);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeIdx]);

  const scannedLosingPricesLabel =
    selected.expectedOutcome === 'FINALIZED'
      ? '$940,000 · $1,040,000 · $1,260,000'
      : '$885,000 · $1,040,000 · $1,260,000';

  return (
    <div>
      {/* Editorial Header */}
      <div style={{ marginBottom: 20 }}>
        <div className="kicker" style={{ marginBottom: 4 }}>
          Independent Walletless Verification · Midnight Preview (Ledger 9) Public GraphQL Indexer
        </div>
        <h1
          className="serif"
          style={{
            margin: '0 0 6px 0',
            fontSize: 32,
            lineHeight: 1.15,
            letterSpacing: '-0.016em',
            fontWeight: 600,
          }}
        >
          Verify Live On-Chain Contract State &amp; 26 ZK Transactions
        </h1>
        <p style={{ margin: 0, color: 'var(--ink-secondary)', maxWidth: 800, lineHeight: 1.55 }}>
          Both reference public-works tenders below are deployed and settled live on{' '}
          <strong>Midnight Preview (Ledger 9)</strong> with{' '}
          <strong>26 real ZK-proven transactions</strong> generated via{' '}
          <code className="mono">proof-server:9.0.2</code>. Every query below dispatches a live{' '}
          <code className="mono">POST</code> to Midnight&apos;s public GraphQL Indexer and scans raw
          serialized contract bytes for zero losing-bid leakage.
        </p>
      </div>

      {/* Manifest Selector Cards */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        {PREPROD_MANIFEST.map((entry, idx) => {
          const isSelected = safeIdx === idx;
          const firstBlock = entry.transactions[0]?.blockHeight;
          const lastBlock = entry.transactions[entry.transactions.length - 1]?.blockHeight;
          return (
            <article
              key={entry.tenderCode}
              className={`proof-card ${isSelected ? 'proof-card-selected' : ''}`}
              onClick={() => onSelectTender(idx)}
              style={{ cursor: 'pointer' }}
            >
              <div className="sheet-header">
                <div>
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-muted)' }}>
                    {entry.tenderCode} · Blocks #{firstBlock}–#{lastBlock}
                  </div>
                  <div className="sheet-title" style={{ marginTop: 2 }}>{entry.label}</div>
                </div>
                <span
                  className={`tag ${
                    entry.expectedOutcome === 'FINALIZED' ? 'tag-verified' : 'tag-contested'
                  }`}
                >
                  {entry.verifiedPhase ?? entry.expectedOutcome}
                </span>
              </div>

              <div
                className="sheet-body"
                style={{ fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 8 }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <span className="text-muted">Contract Address:</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span className="mono" style={{ fontWeight: 600 }}>
                      {entry.contractAddress?.slice(0, 12)}…{entry.contractAddress?.slice(-10)}
                    </span>
                    {entry.contractAddress && (
                      <CopyButton
                        value={entry.contractAddress}
                        label="Copy"
                        ariaLabel={`Copy ${entry.tenderCode} contract address`}
                      />
                    )}
                  </span>
                </div>

                <div style={{ color: 'var(--ink-secondary)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  <span>
                    Public Award:{' '}
                    <strong className="mono" style={{ color: 'var(--ink-primary)' }}>
                      ${(Number(entry.verifiedAwardedPriceCents ?? 0) / 100).toLocaleString('en-US')}
                    </strong>
                  </span>
                  <span>
                    Proven ZK Txs: <strong className="mono">{entry.transactions.length}</strong>
                  </span>
                  <span>
                    Network: <strong className="mono">preview (Ledger 9)</strong>
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    flexWrap: 'wrap',
                    paddingTop: 4,
                  }}
                >
                  {entry.verifiedZeroLosingPricesOnChain && (
                    <div
                      className="mono"
                      style={{ fontSize: 11, color: 'var(--status-verified)', fontWeight: 600 }}
                    >
                      ZERO-LEAKAGE AUDIT: PASS
                    </div>
                  )}
                  <button
                    type="button"
                    className={`btn btn-sm ${isSelected ? 'btn-primary' : ''}`}
                    aria-pressed={isSelected}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTender(idx);
                    }}
                  >
                    {isSelected ? `Inspecting ${entry.tenderCode}` : `Inspect ${entry.tenderCode}`}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Live GraphQL Query & Audit Result Console */}
      <section className="sheet" aria-labelledby="graphql-console-heading" style={{ marginBottom: 20 }}>
        <div className="sheet-header">
          <h2 id="graphql-console-heading" className="sheet-title">
            <Search size={15} color="#1B3B6F" />
            Live Midnight GraphQL Indexer Audit Console
          </h2>
          <span className="tag tag-verified">Direct Public GraphQL POST</span>
        </div>

        <div className="sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="grid-2">
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 600 }}>
              <span>Midnight Contract Address (Hex)</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={customAddress}
                  onChange={(e) => setCustomAddress(e.target.value)}
                  placeholder="Paste deployed Midnight contract address…"
                  className="mono"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '8px 10px',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 12,
                    background: 'var(--bg-surface)',
                    color: 'var(--ink-primary)',
                  }}
                />
                <CopyButton value={customAddress} label="Copy" ariaLabel="Copy input contract address" />
              </div>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 600 }}>
              <span>GraphQL Indexer Endpoint (Preview open; Preprod via Blockfrost)</span>
              <input
                type="text"
                value={indexerUrl}
                onChange={(e) => setIndexerUrl(e.target.value)}
                className="mono"
                style={{
                  padding: '8px 10px',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12,
                  background: 'var(--bg-surface)',
                  color: 'var(--ink-primary)',
                }}
              />
            </label>
          </div>

          {indexerUrl.includes('blockfrost') && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 600 }}>
              Optional Blockfrost Project ID (only needed for Blockfrost endpoints)
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
                  fontSize: 12,
                }}
              />
            </label>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading}
              onClick={() => void runQuery()}
            >
              <RefreshCw size={14} />
              {loading ? 'Querying Live Midnight Indexer…' : 'Query Live On-Chain State'}
            </button>
            {selected.contractAddress && (
              <a
                href={`${selected.explorerBaseUrl}/contract/${selected.contractAddress}`}
                target="_blank"
                rel="noreferrer"
                className="btn"
              >
                <ExternalLink size={14} />
                Open Contract on Midnight Explorer
              </a>
            )}
          </div>

          {/* Geometry-Matched Loading Skeleton */}
          {loading && (
            <div
              className="alert-box"
              style={{ background: 'var(--bg-recessed)', flexDirection: 'column', gap: 9 }}
              role="status"
              aria-live="polite"
            >
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-secondary)' }}>
                Dispatching live GraphQL query AssizeContractState($address) to {indexerUrl}…
              </div>
              <div className="skeleton-line" style={{ width: '52%' }} />
              <div className="skeleton-line" style={{ width: '78%' }} />
              <div className="skeleton-line" style={{ width: '64%' }} />
            </div>
          )}

          {/* Verified On-Chain State Result */}
          {!loading && result && (
            <div
              className={`alert-box ${result.ok ? 'alert-verified' : 'alert-warning'}`}
              role="status"
              aria-live="polite"
            >
              {result.ok ? (
                <CheckCircle2 size={20} style={{ marginTop: 2 }} />
              ) : (
                <AlertOctagon size={20} style={{ marginTop: 2 }} />
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <strong style={{ fontSize: 14 }}>
                    {result.ok
                      ? `Live On-Chain State Verified — Block #${result.blockHeight ?? 'live'}`
                      : 'Indexer Query Did Not Return Contract State'}
                  </strong>
                  {result.ok && (
                    <span className="tag tag-verified">
                      {((result.rawStateHex?.length ?? 0) / 2).toLocaleString('en-US')} Bytes Verified
                    </span>
                  )}
                </div>

                {result.ok ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                    {result.latestTxHash && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          flexWrap: 'wrap',
                          fontSize: 12,
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>Latest Settlement Tx:</span>
                        <span className="mono hash-break">{result.latestTxHash}</span>
                        <CopyButton
                          value={result.latestTxHash}
                          label="Copy Tx"
                          ariaLabel="Copy latest transaction hash"
                        />
                      </div>
                    )}

                    <div className="mono" style={{ fontSize: 12, fontWeight: 600 }}>
                      Byte-Level Zero-Leakage Scan:{' '}
                      {result.zeroLosingPricesConfirmed
                        ? `PASS — 0 matches for losing bids (${scannedLosingPricesLabel}) in serialized on-chain state`
                        : 'WARNING — unexpected byte pattern detected'}
                    </div>

                    <div
                      className="mono"
                      style={{ fontSize: 11, color: 'var(--ink-secondary)', overflowWrap: 'anywhere' }}
                    >
                      Endpoint: {result.indexerUrl} · Checked: {result.checkedAt}
                    </div>

                    {result.rawStateHex && (
                      <div style={{ marginTop: 4 }}>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => setRawExpanded((v) => !v)}
                          aria-expanded={rawExpanded}
                        >
                          {rawExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          {rawExpanded
                            ? 'Hide Raw Ledger Hex'
                            : `Inspect Raw State (0x${result.rawStateHex.slice(0, 10)}…)`}
                        </button>
                        {rawExpanded && (
                          <div
                            className="mono hash-break"
                            style={{
                              marginTop: 8,
                              padding: 10,
                              maxHeight: 150,
                              overflowY: 'auto',
                              background: '#ffffff',
                              border: '1px solid var(--status-verified-border)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: 11,
                              color: 'var(--ink-primary)',
                            }}
                          >
                            {result.rawStateHex}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mono" style={{ fontSize: 12, marginTop: 4 }}>
                    {result.error}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Recorded 13-Tx On-Chain Transaction Ledger */}
      <section className="sheet" aria-labelledby="tx-trail-heading" style={{ marginBottom: 20 }}>
        <div className="sheet-header">
          <div>
            <div className="kicker" style={{ marginBottom: 2 }}>
              Immutable Settlement Trail
            </div>
            <h2 id="tx-trail-heading" className="sheet-title">
              Verified On-Chain Transaction Ledger — {selected.tenderCode} ({selected.transactions.length} ZK Txs)
            </h2>
          </div>
          <span className="tag tag-navy">Compact 0.36.1 · proof-server:9.0.2</span>
        </div>

        <div className="table-scroll">
          <table className="ledger-table">
            <thead>
              <tr>
                <th scope="col">Lifecycle Step</th>
                <th scope="col">Circuit</th>
                <th scope="col">Block</th>
                <th scope="col">Transaction Hash</th>
                <th scope="col">Explorer</th>
                <th scope="col">Cryptographic Audit Note</th>
              </tr>
            </thead>
            <tbody>
              {selected.transactions.map((tx) => (
                <tr key={tx.txHash}>
                  <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{tx.step}</td>
                  <td>
                    <span className={circuitTagClass(tx.circuit)}>{tx.circuit}</span>
                  </td>
                  <td className="mono" style={{ fontWeight: 600 }}>#{tx.blockHeight}</td>
                  <td>
                    <CopyableHash
                      hex={tx.txHash}
                      prefixChars={9}
                      suffixChars={7}
                      label={`${tx.step} transaction hash`}
                    />
                  </td>
                  <td>
                    <a
                      href={`${selected.explorerBaseUrl}/tx/${tx.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-sm"
                      aria-label={`Open ${tx.step} transaction on Midnight Preview Explorer`}
                    >
                      <ExternalLink size={12} />
                      View
                    </a>
                  </td>
                  <td style={{ color: 'var(--ink-secondary)', fontSize: 12.5 }}>{tx.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Independent CLI Verification Card */}
      <section className="sheet" aria-labelledby="cli-verify-heading">
        <div className="sheet-header">
          <h2 id="cli-verify-heading" className="sheet-title">
            <ShieldCheck size={15} color="#166534" />
            Zero-Trust Terminal Verification (<code className="mono">npm run verify:onchain</code>)
          </h2>
          <CopyButton value="npm run verify:onchain" label="Copy Command" />
        </div>
        <div className="sheet-body" style={{ fontSize: 13, color: 'var(--ink-secondary)' }}>
          Every contract address, block height, and ZK transaction hash in{' '}
          <code className="mono">deployments/preview.json</code> can be verified directly from any
          terminal via <code className="mono">npm run verify:onchain</code> against{' '}
          <code className="mono">https://indexer.preview.midnight.network/api/v4/graphql</code>—zero
          wallet, zero API key, and zero reliance on this browser interface.
        </div>
      </section>
    </div>
  );
}
