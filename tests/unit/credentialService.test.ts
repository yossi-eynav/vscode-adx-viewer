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
  writeCredentials,
  validateCredentials,
  ADXCredentials,
} from '../../src/services/credentialService';

const fsMock = fs.promises as jest.Mocked<typeof fs.promises>;

const CREDS_PATH = path.join(os.homedir(), '.config', 'adx-viewer', 'credentials.json');
const VALID_CREDS: ADXCredentials = {
  clusterUrl: 'https://mycluster.eastus.kusto.windows.net',
  tenantId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  clientId: 'yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy',
  clientSecret: 'my-secret',
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

  it('returns parsed credentials when file exists and is valid', async () => {
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
    fsMock.readFile.mockResolvedValueOnce(JSON.stringify(incomplete));

    const result = await readCredentials();
    expect(result).toBeNull();
  });
});

describe('writeCredentials', () => {
  it('creates the credentials file at the correct path', async () => {
    fsMock.mkdir.mockResolvedValueOnce(undefined);
    fsMock.writeFile.mockResolvedValueOnce(undefined);
    fsMock.chmod.mockResolvedValueOnce(undefined);

    await writeCredentials(VALID_CREDS);

    expect(fsMock.writeFile).toHaveBeenCalledWith(
      CREDS_PATH,
      JSON.stringify(VALID_CREDS, null, 2),
      'utf8'
    );
  });

  it('sets file permissions to 0o600 after writing', async () => {
    fsMock.mkdir.mockResolvedValueOnce(undefined);
    fsMock.writeFile.mockResolvedValueOnce(undefined);
    fsMock.chmod.mockResolvedValueOnce(undefined);

    await writeCredentials(VALID_CREDS);

    expect(fsMock.chmod).toHaveBeenCalledWith(CREDS_PATH, 0o600);
  });

  it('creates the parent directory with mkdir -p', async () => {
    fsMock.mkdir.mockResolvedValueOnce(undefined);
    fsMock.writeFile.mockResolvedValueOnce(undefined);
    fsMock.chmod.mockResolvedValueOnce(undefined);

    await writeCredentials(VALID_CREDS);

    const dirPath = path.join(os.homedir(), '.config', 'adx-viewer');
    expect(fsMock.mkdir).toHaveBeenCalledWith(dirPath, { recursive: true });
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
