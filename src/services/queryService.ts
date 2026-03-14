import { Client, KustoConnectionStringBuilder, ClientRequestProperties } from 'azure-kusto-data';
import { ClientSecretCredential } from '@azure/identity';
import { ResultColumn, ResultRow, ColumnType } from '../types/messages';
import { ADXCredentials } from './credentialService';
import { mapColumnType } from '../webview/resultTransformer';

export interface QueryResult {
  columns: ResultColumn[];
  rows: ResultRow[];
  totalRowCount: number;
  truncated: boolean;
  executedAt: Date;
  queryDurationMs: number;
}

export class QueryError extends Error {
  readonly statusCode?: number;
  readonly responseBody?: string;

  constructor(message: string, statusCode?: number, responseBody?: string) {
    super(message);
    this.name = 'QueryError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

export class EmptyQueryError extends Error {
  constructor() {
    super('Query is empty. Add a KQL query to this file.');
    this.name = 'EmptyQueryError';
  }
}



// ---------------------------------------------------------------------------
// Credential validation (US1)
// ---------------------------------------------------------------------------

export type ValidationResult =
  | { ok: true }
  | { ok: false; category: 'auth' | 'unreachable' | 'timeout'; message: string };

class TimeoutError extends Error {
  constructor() {
    super('timeout');
    this.name = 'TimeoutError';
  }
}

function classifyConnectionError(err: unknown): ValidationResult {
  if (err instanceof TimeoutError) {
    return {
      ok: false,
      category: 'timeout',
      message: 'Connection timed out after 10 seconds.',
    };
  }
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (
    msg.includes('authentication') ||
    msg.includes('unauthorized') ||
    msg.includes('aadsts') ||
    msg.includes('invalid_client') ||
    msg.includes('forbidden') ||
    msg.includes('access denied') ||
    msg.includes('principal') ||
    msg.includes('403') ||
    msg.includes('401')
  ) {
    return {
      ok: false,
      category: 'auth',
      message: 'Authentication failed. Check your Client ID and Client Secret.',
    };
  }
  return {
    ok: false,
    category: 'unreachable',
    message: 'Cannot reach cluster. Check the Cluster URL and your network.',
  };
}

export async function testConnection(credentials: ADXCredentials): Promise<ValidationResult> {
  try {
    const credential = new ClientSecretCredential(
      credentials.tenantId,
      credentials.clientId,
      credentials.clientSecret
    );

    const kcsb = KustoConnectionStringBuilder.withTokenCredential(
      credentials.clusterUrl,
      credential
    );

    const client = new Client(kcsb);

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new TimeoutError()), 10000)
    );

    await Promise.race([
      client.execute(credentials.defaultDatabase ?? '', 'print "ok"'),
      timeoutPromise,
    ]);

    return { ok: true };
  } catch (err) {
    return classifyConnectionError(err);
  }
}

// ---------------------------------------------------------------------------

export async function executeQuery(
  credentials: ADXCredentials,
  queryText: string,
  database: string
): Promise<QueryResult> {
  if (!queryText.trim()) {
    throw new EmptyQueryError();
  }

  try {
    const credential = new ClientSecretCredential(
      credentials.tenantId,
      credentials.clientId,
      credentials.clientSecret
    );

    const kcsb = KustoConnectionStringBuilder.withTokenCredential(
      credentials.clusterUrl,
      credential
    );

    const client = new Client(kcsb);

    const queryStart = Date.now();
    const result = await executeWithTimeout(client, database, queryText, 30000);
    const queryDurationMs = Date.now() - queryStart;

    const primaryTable = result.primaryResults[0];
    const allRows: ResultRow[] = [];

    for (const row of primaryTable.rows()) {
      // azure-kusto-data v7: row is KustoResultRow (array-like); flatten to plain array
      const rowAny = row as unknown;
      let rowArray: unknown[];
      if (Array.isArray(rowAny)) {
        rowArray = rowAny;
      } else if (
        rowAny &&
        typeof (rowAny as Record<string, unknown>)['values'] === 'function'
      ) {
        const vals = (rowAny as { values: () => unknown })['values']();
        rowArray = Array.isArray(vals) ? vals : Array.from(vals as Iterable<unknown>);
      } else {
        rowArray = Array.from(rowAny as Iterable<unknown>);
      }
      allRows.push(rowArray as ResultRow);
    }

    const MAX_ROWS = 5000;
    const totalRowCount = allRows.length;
    const truncated = totalRowCount > MAX_ROWS;
    const rows = truncated ? allRows.slice(0, MAX_ROWS) : allRows;

    const columns: ResultColumn[] = (
      primaryTable.columns as unknown as Array<{ name: string; type: string }>
    ).map((col) => ({
      name: col.name,
      type: mapColumnType(col.type),
    }));

    return {
      columns,
      rows,
      totalRowCount,
      truncated,
      executedAt: new Date(),
      queryDurationMs,
    };
  } catch (err) {
    if (err instanceof QueryError || err instanceof EmptyQueryError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    const { statusCode, responseBody } = extractHttpErrorDetails(err);
    throw new QueryError(`Query failed: ${message}`, statusCode, responseBody);
  }
}

function extractHttpErrorDetails(err: unknown): { statusCode?: number; responseBody?: string } {
  if (
    typeof err !== 'object' ||
    err === null ||
    !('response' in err) ||
    typeof (err as { response?: unknown }).response !== 'object' ||
    (err as { response?: unknown }).response === null
  ) {
    return {};
  }
  const response = (err as { response: { status?: unknown; data?: unknown } }).response;
  const statusCode = typeof response.status === 'number' ? response.status : undefined;
  if (response.data === undefined || response.data === null) {
    return { statusCode };
  }
  let bodyStr: string;
  try {
    bodyStr = JSON.stringify(response.data);
  } catch {
    bodyStr = String(response.data);
  }
  const responseBody = bodyStr.length > 500 ? bodyStr.slice(0, 500) + '…' : bodyStr;
  return { statusCode, responseBody };
}

async function executeWithTimeout(
  client: Client,
  database: string,
  query: string,
  timeoutMs: number
): Promise<ReturnType<Client['execute']>> {
  const props = new ClientRequestProperties();
  // Allow up to 256 MB result sets (default is 64 MB)
  props.setOption('truncationmaxsize', 256 * 1024 * 1024);
  // Allow up to 500 000 records (default is 500 000, kept explicit for clarity)
  props.setOption('truncationmaxrecords', 500_000);

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new QueryError('Connection timed out. Check the cluster URL and your network.')),
      timeoutMs
    )
  );
  return Promise.race([client.execute(database, query, props), timeoutPromise]);
}
