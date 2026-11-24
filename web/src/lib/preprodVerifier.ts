// SPDX-License-Identifier: Apache-2.0
// Assize — Live Midnight Preview / Preprod GraphQL Indexer Verifier Client
// Queries real Midnight GraphQL Indexer state directly with zero trust in the frontend.

import previewManifest from '../generated/preview-manifest.json';

export interface LiveTxRecord {
  step: string;
  circuit: string;
  txId?: string;
  txHash: string;
  blockHeight: number;
  note: string;
}

export interface LiveDeploymentEntry {
  label: string;
  tenderCode: string;
  expectedOutcome: 'FINALIZED' | 'CONTESTED';
  network: 'preview' | 'preprod';
  contractAddress: string | null;
  explorerBaseUrl: string;
  indexerUrl: string;
  deployedAt: string | null;
  verifiedPhase: string | null;
  verifiedAwardedPriceCents: string | null;
  verifiedZeroLosingPricesOnChain: boolean;
  transactions: LiveTxRecord[];
}

export const PREPROD_INDEXER_DEFAULT = previewManifest.endpoints.indexerGraphql;

export const PREPROD_MANIFEST: LiveDeploymentEntry[] = previewManifest.deployments.map((d) => ({
  label: d.label,
  tenderCode: d.tenderCode,
  expectedOutcome: d.expectedOutcome as 'FINALIZED' | 'CONTESTED',
  network: 'preview',
  contractAddress: d.contractAddress,
  explorerBaseUrl: previewManifest.explorerBaseUrl,
  indexerUrl: previewManifest.endpoints.indexerGraphql,
  deployedAt: d.deployedAt,
  verifiedPhase: d.verifiedPhase,
  verifiedAwardedPriceCents: d.verifiedAwardedPriceCents,
  verifiedZeroLosingPricesOnChain: d.verifiedZeroLosingPricesOnChain,
  transactions: d.transactions,
}));

export interface IndexerQueryResult {
  ok: boolean;
  indexerUrl: string;
  contractAddress: string;
  checkedAt: string;
  rawStateHex?: string;
  blockHeight?: number;
  latestTxHash?: string;
  zeroLosingPricesConfirmed?: boolean;
  error?: string;
}

function uint32LeHex(val: number): string {
  const bytes = [val & 0xff, (val >> 8) & 0xff, (val >> 16) & 0xff, (val >> 24) & 0xff];
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Queries Midnight's live GraphQL Indexer for contractAction(address).
 * Midnight Preview requires no API key; Blockfrost Preprod accepts optional project_id header.
 */
export async function queryMidnightIndexerContract(
  contractAddress: string,
  indexerUrl: string = PREPROD_INDEXER_DEFAULT,
  blockfrostProjectId?: string,
  expectedOutcome?: 'FINALIZED' | 'CONTESTED'
): Promise<IndexerQueryResult> {
  const checkedAt = new Date().toISOString();
  const cleanAddr = contractAddress.trim();
  if (!cleanAddr) {
    return {
      ok: false,
      indexerUrl,
      contractAddress: cleanAddr,
      checkedAt,
      error: 'Enter a valid Midnight contract address to query the live GraphQL indexer.',
    };
  }

  const query = `
    query AssizeContractState($address: HexEncoded!) {
      contractAction(address: $address) {
        __typename
        address
        state
        transaction {
          hash
          block {
            height
            timestamp
          }
        }
      }
    }
  `;

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const cleanKey = blockfrostProjectId?.trim();
    if (cleanKey) {
      headers['project_id'] = cleanKey;
    }
    const resp = await fetch(indexerUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables: { address: cleanAddr } }),
    });
    if (!resp.ok) {
      return {
        ok: false,
        indexerUrl,
        contractAddress: cleanAddr,
        checkedAt,
        error: `Indexer HTTP ${resp.status} ${resp.statusText}`,
      };
    }
    const json = (await resp.json()) as {
      data?: {
        contractAction?: {
          state?: string;
          transaction?: { hash?: string; block?: { height?: number } };
        } | null;
      };
      errors?: { message: string }[];
    };
    if (json.errors && json.errors.length > 0) {
      return {
        ok: false,
        indexerUrl,
        contractAddress: cleanAddr,
        checkedAt,
        error: json.errors.map((e) => e.message).join('; '),
      };
    }
    const action = json.data?.contractAction;
    if (!action || !action.state) {
      return {
        ok: false,
        indexerUrl,
        contractAddress: cleanAddr,
        checkedAt,
        error: 'No indexed contract state found at this address on the selected network.',
      };
    }

    const lower = action.state.toLowerCase();
    const losingPrices =
      expectedOutcome === 'FINALIZED'
        ? [94_000_000, 104_000_000, 126_000_000]
        : [88_500_000, 104_000_000, 126_000_000];
    const leaked = losingPrices.some((p) => lower.includes(uint32LeHex(p)));

    return {
      ok: true,
      indexerUrl,
      contractAddress: cleanAddr,
      checkedAt,
      rawStateHex: action.state,
      blockHeight: action.transaction?.block?.height,
      latestTxHash: action.transaction?.hash,
      zeroLosingPricesConfirmed: !leaked,
    };
  } catch (err) {
    return {
      ok: false,
      indexerUrl,
      contractAddress: cleanAddr,
      checkedAt,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
