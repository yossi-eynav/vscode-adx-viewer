import { ColumnType } from '../../src/types/messages';

// Mock azure-kusto-data before imports that use it
jest.mock('azure-kusto-data', () => {
  const mockExecute = jest.fn();
  return {
    Client: jest.fn().mockImplementation(() => ({ execute: mockExecute })),
    KustoConnectionStringBuilder: {
      withTokenCredential: jest.fn().mockReturnValue('mock-connection-string'),
    },
    __mockExecute: mockExecute,
  };
});

jest.mock('@azure/identity', () => ({
  ClientSecretCredential: jest.fn().mockImplementation(() => ({})),
}));

import {
  executeQuery,
  QueryError,
  EmptyQueryError,
} from '../../src/services/queryService';
import { ADXCredentials } from '../../src/services/credentialService';
import * as kustoData from 'azure-kusto-data';

const mockKusto = kustoData as unknown as {
  __mockExecute: jest.Mock;
  Client: jest.Mock;
};

const VALID_CREDS: ADXCredentials = {
  clusterUrl: 'https://mycluster.eastus.kusto.windows.net',
  tenantId: 'tenant-id',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  defaultDatabase: 'mydb',
};

function makeKustoResult(columns: { columnName: string; columnType: string }[], rows: unknown[][]) {
  return {
    primaryResults: [
      {
        columns,
        rows: function* () {
          for (const row of rows) {
            yield row;
          }
        },
      },
    ],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('executeQuery', () => {
  it('returns QueryResult with correct columns and rows', async () => {
    const columns = [
      { columnName: 'Timestamp', columnType: 'datetime' },
      { columnName: 'Count', columnType: 'int' },
    ];
    const rows = [['2024-01-01T00:00:00', 42]];

    mockKusto.__mockExecute.mockResolvedValueOnce(makeKustoResult(columns, rows));

    const result = await executeQuery(VALID_CREDS, 'MyTable | take 1', 'mydb');

    expect(result.columns).toHaveLength(2);
    expect(result.columns[0].name).toBe('Timestamp');
    expect(result.columns[0].type).toBe(ColumnType.datetime);
    expect(result.columns[1].name).toBe('Count');
    expect(result.columns[1].type).toBe(ColumnType.numeric);
    expect(result.rows).toHaveLength(1);
  });

  it('caps rows at 1,000 and sets truncated: true with correct totalRowCount', async () => {
    const columns = [{ columnName: 'Id', columnType: 'int' }];
    const rows = Array.from({ length: 1500 }, (_, i) => [i]);

    mockKusto.__mockExecute.mockResolvedValueOnce(makeKustoResult(columns, rows));

    const result = await executeQuery(VALID_CREDS, 'MyTable | take 1500', 'mydb');

    expect(result.rows).toHaveLength(1000);
    expect(result.truncated).toBe(true);
    expect(result.totalRowCount).toBe(1500);
  });

  it('does not set truncated when rows <= 1000', async () => {
    const columns = [{ columnName: 'Id', columnType: 'int' }];
    const rows = Array.from({ length: 50 }, (_, i) => [i]);

    mockKusto.__mockExecute.mockResolvedValueOnce(makeKustoResult(columns, rows));

    const result = await executeQuery(VALID_CREDS, 'MyTable | take 50', 'mydb');

    expect(result.truncated).toBe(false);
    expect(result.totalRowCount).toBe(50);
  });

  it('throws QueryError on auth failure', async () => {
    const authError = new Error('Authentication failed');
    mockKusto.__mockExecute.mockRejectedValueOnce(authError);

    await expect(executeQuery(VALID_CREDS, 'MyTable', 'mydb')).rejects.toBeInstanceOf(QueryError);
  });

  it('throws EmptyQueryError when queryText is empty', async () => {
    await expect(executeQuery(VALID_CREDS, '   ', 'mydb')).rejects.toBeInstanceOf(EmptyQueryError);
  });

  it('throws EmptyQueryError when queryText is empty string', async () => {
    await expect(executeQuery(VALID_CREDS, '', 'mydb')).rejects.toBeInstanceOf(EmptyQueryError);
  });
});
