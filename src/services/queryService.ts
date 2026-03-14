import { Client, KustoConnectionStringBuilder } from 'azure-kusto-data';
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
}

export class QueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueryError';
  }
}

export class EmptyQueryError extends Error {
  constructor() {
    super('Query is empty. Add a KQL query to this file.');
    this.name = 'EmptyQueryError';
  }
}

const MAX_ROWS = 1000;

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

    const result = await executeWithTimeout(client, database, queryText, 30000);

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

    const totalRowCount = allRows.length;
    const truncated = totalRowCount > MAX_ROWS;
    const rows = truncated ? allRows.slice(0, MAX_ROWS) : allRows;

    const columns: ResultColumn[] = (
      primaryTable.columns as unknown as Array<{ columnName: string; columnType: string }>
    ).map((col) => ({
      name: col.columnName,
      type: mapColumnType(col.columnType),
    }));

    return {
      columns,
      rows,
      totalRowCount,
      truncated,
      executedAt: new Date(),
    };
  } catch (err) {
    if (err instanceof QueryError || err instanceof EmptyQueryError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new QueryError(`Query failed: ${message}`);
  }
}

async function executeWithTimeout(
  client: Client,
  database: string,
  query: string,
  timeoutMs: number
): Promise<ReturnType<Client['execute']>> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new QueryError('Connection timed out. Check the cluster URL and your network.')),
      timeoutMs
    )
  );
  return Promise.race([client.execute(database, query), timeoutPromise]);
}
