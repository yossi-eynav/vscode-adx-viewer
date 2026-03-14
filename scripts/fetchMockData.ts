/**
 * Fetches a sample of query results from ADX and writes them to
 * src/webview-app/mock-results.json for use as dev mock data.
 *
 * Usage: npm run webview:fetch
 */
import * as fs from 'fs';
import * as path from 'path';
import { Client, KustoConnectionStringBuilder } from 'azure-kusto-data';
import { ClientSecretCredential } from '@azure/identity';
import { readCredentials } from '../src/services/credentialService';

const QUERY = `
exceptions
| where timestamp > ago(1h)
| where source == "dr-strange"
`;

const MAX_MOCK_ROWS = 15;
const MAX_STR_LEN = 300;
const OUT_PATH = path.resolve(__dirname, '../src/webview-app/mock-results.json');

function truncate(v: unknown): string | number | boolean | null | object {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  // Objects (e.g. customDimensions) → keep as-is so JSON.parse works in the viewer
  if (typeof v === 'object') return v;
  // Primitive strings → truncate long ones (stack traces etc.)
  if (typeof v === 'string') return v.length > MAX_STR_LEN ? v.slice(0, MAX_STR_LEN) + '…' : v;
  return String(v);
}

async function main() {
  const creds = await readCredentials();
  if (!creds) {
    console.error('No credentials found. Run "ADX: Configure Connection" in VS Code first.');
    process.exit(1);
  }

  const db = creds.defaultDatabase ?? '';
  process.stderr.write(`Querying ${creds.clusterUrl} / ${db} …\n`);

  const credential = new ClientSecretCredential(creds.tenantId, creds.clientId, creds.clientSecret);
  const kcsb = KustoConnectionStringBuilder.withTokenCredential(creds.clusterUrl, credential);
  const client = new Client(kcsb);

  const result = await client.execute(db, QUERY);
  const table = result.primaryResults[0];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawCols = table.columns as unknown as any[];
  const columns = rawCols.map((col) => ({
    name: (col.name ?? col.columnName ?? '') as string,
    type: (col.type ?? col.columnType ?? '') as string,
  }));

  const allRows: unknown[][] = [];
  for (const row of table.rows()) {
    const r = row as unknown;
    let arr: unknown[];
    if (Array.isArray(r)) {
      arr = r;
    } else if (r && typeof (r as Record<string, unknown>)['values'] === 'function') {
      const vals = (r as { values: () => unknown })['values']();
      arr = Array.isArray(vals) ? vals : Array.from(vals as Iterable<unknown>);
    } else {
      arr = Array.from(r as Iterable<unknown>);
    }
    allRows.push(arr);
  }

  process.stderr.write(`Total rows: ${allRows.length}, writing ${Math.min(allRows.length, MAX_MOCK_ROWS)} to mock-results.json\n`);

  const output = {
    columns,
    rows: allRows.slice(0, MAX_MOCK_ROWS).map(row => row.map(truncate)),
    totalRowCount: allRows.length,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');
  process.stderr.write(`Written to ${OUT_PATH}\n`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
