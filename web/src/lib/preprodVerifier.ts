// SPDX-License-Identifier: Apache-2.0
// Assize — Live Midnight Preprod GraphQL Indexer Verifier Client
// Queries real Midnight Preprod Indexer state honestly; never fabricates tx hashes.

export interface PreprodTxRecord {
  step: string;
  circuit: string;
  txHash: string;
  blockHeight?: number;
  note: string;
}

export interface PreprodDeploymentEntry {
  label: string;
  tenderCode: string;
  expectedOutcome: 'FINALIZED' | 'CONTESTED';
  network: 'preprod' | 'preview';
  contractAddress: string | null;
  explorerBaseUrl: string;
  indexerUrl: string;
  deployedAt: string | null;
  transactions: PreprodTxRecord[];
}

export const PREPROD_INDEXER_DEFAULT = 'https://midnight-preprod.blockfrost.io/api/v0';

export const PREPROD_MANIFEST: PreprodDeploymentEntry[] = [
  {
    label: 'Tender A — Clean Fair Award (FINALIZED)',
    tenderCode: 'PW-2026-041-A',
    expectedOutcome: 'FINALIZED',
    network: 'preprod',
    contractAddress: null,
    explorerBaseUrl: 'https://preprod.midnightexplorer.com',
    indexerUrl: PREPROD_INDEXER_DEFAULT,
    deployedAt: null,
    transactions: [],
  },
  {
    label: 'Tender B — Pretextual Exclusion Caught (CONTESTED)',
    tenderCode: 'PW-2026-041-B',
    expectedOutcome: 'CONTESTED',
    network: 'preprod',
    contractAddress: null,
    explorerBaseUrl: 'https://preprod.midnightexplorer.com',
    indexerUrl: PREPROD_INDEXER_DEFAULT,
    deployedAt: null,
    transactions: [],
  },
];

export interface IndexerQueryResult {
  ok: boolean;
  indexerUrl: string;
  contractAddress: string;
  checkedAt: string;
  rawStateHex?: string;
  blockHeight?: number;
  error?: string;
}

/**
 * Queries a live Midnight GraphQL Indexer for contractAction(address).
 * Fails cleanly with real network/GraphQL error if unreachable or contract not yet deployed.
 */
export async function queryMidnightIndexerContract(
  contractAddress: string,
  indexerUrl: string = PREPROD_INDEXER_DEFAULT,
  blockfrostProjectId?: string
): Promise<IndexerQueryResult> {
  const checkedAt = new Date().toISOString();
  const cleanAddr = contractAddress.trim();
  if (!cleanAddr) {
    return {
      ok: false,
      indexerUrl,
      contractAddress: cleanAddr,
      checkedAt,
      error: 'Enter a valid Midnight Preprod contract address to query the live GraphQL indexer.',
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
          transaction?: { block?: { height?: number } };
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
    return {
      ok: true,
      indexerUrl,
      contractAddress: cleanAddr,
      checkedAt,
      rawStateHex: action.state,
      blockHeight: action.transaction?.block?.height,
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
