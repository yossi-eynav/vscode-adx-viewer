import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    ...jest.requireActual('fs').promises,
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    chmod: jest.fn(),
  },
}));

import {
  readCredentials,
  readAllConnections,
  writeConnection,
  setActiveConnection,
  validateCredentials,
  ADXCredentials,
  ConnectionsStore,
} from '../../src/services/credentialService';

const fsMock = fs.promises as jest.Mocked<typeof fs.promises>;

const CREDS_PATH = path.join(os.homedir(), '.config', 'adx-viewer', 'credentials.json');
const VALID_CREDS: ADXCredentials = {
  clusterUrl: 'https://mycluster.eastus.kusto.windows.net',
  tenantId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  clientId: 'yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy',
  clientSecret: 'my-secret',
  defaultDatabase: 'MyDatabase',
};

const VALID_STORE: ConnectionsStore = {
  activeConnection: 'default',
  connections: { default: VALID_CREDS },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('readCredentials', () => {
  it('returns null when credentials file is absent', async () => {
    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    fsMock.readFile.mockRejectedValueOnce(err);

    const result = await readCredentials();
    expect(result).toBeNull();
  });

  it('returns active connection credentials from new multi-connection format', async () => {
    fsMock.readFile.mockResolvedValueOnce(JSON.stringify(VALID_STORE));

    const result = await readCredentials();
    expect(result).toEqual(VALID_CREDS);
  });

  it('migrates old single-connection format and returns credentials', async () => {
    fsMock.readFile.mockResolvedValueOnce(JSON.stringify(VALID_CREDS));

    const result = await readCredentials();
    expect(result).toEqual(VALID_CREDS);
  });

  it('returns null when file content is invalid JSON', async () => {
    fsMock.readFile.mockResolvedValueOnce('not-json');

    const result = await readCredentials();
    expect(result).toBeNull();
  });

  it('returns null when required fields are missing', async () => {
    const incomplete = { clusterUrl: 'https://test.kusto.windows.net' };
    const store: ConnectionsStore = {
      activeConnection: 'default',
      connections: { default: incomplete as ADXCredentials },
    };
    fsMock.readFile.mockResolvedValueOnce(JSON.stringify(store));

    const result = await readCredentials();
    expect(result).toBeNull();
  });
});

describe('readAllConnections', () => {
  it('returns null when file is absent', async () => {
    fsMock.readFile.mockRejectedValueOnce(new Error('ENOENT'));
    expect(await readAllConnections()).toBeNull();
  });

  it('returns the full store', async () => {
    fsMock.readFile.mockResolvedValueOnce(JSON.stringify(VALID_STORE));
    expect(await readAllConnections()).toEqual(VALID_STORE);
  });

  it('migrates old format into a store with a default connection', async () => {
    fsMock.readFile.mockResolvedValueOnce(JSON.stringify(VALID_CREDS));
    const result = await readAllConnections();
    expect(result?.activeConnection).toBe('default');
    expect(result?.connections['default']).toEqual(VALID_CREDS);
  });
});

describe('writeConnection', () => {
  it('creates a new store when file is absent, writing to correct path', async () => {
    fsMock.readFile.mockRejectedValueOnce(new Error('ENOENT'));
    fsMock.mkdir.mockResolvedValueOnce(undefined);
    fsMock.writeFile.mockResolvedValueOnce(undefined);
    fsMock.chmod.mockResolvedValueOnce(undefined);

    await writeConnection('default', VALID_CREDS);

    const expectedStore: ConnectionsStore = {
      activeConnection: 'default',
      connections: { default: VALID_CREDS },
    };
    expect(fsMock.writeFile).toHaveBeenCalledWith(
      CREDS_PATH,
      JSON.stringify(expectedStore, null, 2),
      'utf8'
    );
  });

  it('adds a new connection to an existing store', async () => {
    fsMock.readFile.mockResolvedValueOnce(JSON.stringify(VALID_STORE));
    fsMock.mkdir.mockResolvedValueOnce(undefined);
    fsMock.writeFile.mockResolvedValueOnce(undefined);
    fsMock.chmod.mockResolvedValueOnce(undefined);

    const staging: ADXCredentials = { ...VALID_CREDS, clusterUrl: 'https://staging.kusto.windows.net' };
    await writeConnection('staging', staging);

    const written = JSON.parse((fsMock.writeFile.mock.calls[0][1] as string)) as ConnectionsStore;
    expect(written.connections['staging']).toEqual(staging);
    expect(written.connections['default']).toEqual(VALID_CREDS);
    expect(written.activeConnection).toBe('default');
  });

  it('sets file permissions to 0o600 after writing', async () => {
    fsMock.readFile.mockRejectedValueOnce(new Error('ENOENT'));
    fsMock.mkdir.mockResolvedValueOnce(undefined);
    fsMock.writeFile.mockResolvedValueOnce(undefined);
    fsMock.chmod.mockResolvedValueOnce(undefined);

    await writeConnection('default', VALID_CREDS);

    expect(fsMock.chmod).toHaveBeenCalledWith(CREDS_PATH, 0o600);
  });

  it('creates the parent directory with mkdir -p', async () => {
    fsMock.readFile.mockRejectedValueOnce(new Error('ENOENT'));
    fsMock.mkdir.mockResolvedValueOnce(undefined);
    fsMock.writeFile.mockResolvedValueOnce(undefined);
    fsMock.chmod.mockResolvedValueOnce(undefined);

    await writeConnection('default', VALID_CREDS);

    const dirPath = path.join(os.homedir(), '.config', 'adx-viewer');
    expect(fsMock.mkdir).toHaveBeenCalledWith(dirPath, { recursive: true });
  });
});

describe('setActiveConnection', () => {
  it('updates activeConnection in the store', async () => {
    const store: ConnectionsStore = {
      activeConnection: 'default',
      connections: {
        default: VALID_CREDS,
        staging: { ...VALID_CREDS, clusterUrl: 'https://staging.kusto.windows.net' },
      },
    };
    fsMock.readFile.mockResolvedValueOnce(JSON.stringify(store));
    fsMock.mkdir.mockResolvedValueOnce(undefined);
    fsMock.writeFile.mockResolvedValueOnce(undefined);
    fsMock.chmod.mockResolvedValueOnce(undefined);

    await setActiveConnection('staging');

    const written = JSON.parse((fsMock.writeFile.mock.calls[0][1] as string)) as ConnectionsStore;
    expect(written.activeConnection).toBe('staging');
  });

  it('does nothing when the connection name does not exist', async () => {
    fsMock.readFile.mockResolvedValueOnce(JSON.stringify(VALID_STORE));

    await setActiveConnection('nonexistent');

    expect(fsMock.writeFile).not.toHaveBeenCalled();
  });
});

describe('validateCredentials', () => {
  it('returns null for valid complete credentials', () => {
    expect(validateCredentials(VALID_CREDS)).toBeNull();
  });

  it('rejects missing clusterUrl', () => {
    const { clusterUrl, ...rest } = VALID_CREDS;
    expect(validateCredentials(rest)).not.toBeNull();
  });

  it('rejects empty clusterUrl', () => {
    expect(validateCredentials({ ...VALID_CREDS, clusterUrl: '' })).not.toBeNull();
  });

  it('rejects clusterUrl that does not start with https://', () => {
    expect(
      validateCredentials({ ...VALID_CREDS, clusterUrl: 'http://cluster.kusto.windows.net' })
    ).toMatch(/https:\/\//i);
  });

  it('rejects missing tenantId', () => {
    const { tenantId, ...rest } = VALID_CREDS;
    expect(validateCredentials(rest)).not.toBeNull();
  });

  it('rejects missing clientId', () => {
    const { clientId, ...rest } = VALID_CREDS;
    expect(validateCredentials(rest)).not.toBeNull();
  });

  it('rejects missing clientSecret', () => {
    const { clientSecret, ...rest } = VALID_CREDS;
    expect(validateCredentials(rest)).not.toBeNull();
  });

  it('allows missing optional defaultDatabase', () => {
    const { defaultDatabase, ...rest } = VALID_CREDS;
    expect(validateCredentials(rest)).toBeNull();
  });
});
