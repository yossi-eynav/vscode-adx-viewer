import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ADXCredentials {
  clusterUrl: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  defaultDatabase?: string;
}

const CREDS_DIR = path.join(os.homedir(), '.config', 'adx-viewer');
const CREDS_PATH = path.join(CREDS_DIR, 'credentials.json');

export async function readCredentials(): Promise<ADXCredentials | null> {
  try {
    const content = await fs.promises.readFile(CREDS_PATH, 'utf8');
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (validateCredentials(parsed) !== null) {
      return null;
    }
    return parsed as unknown as ADXCredentials;
  } catch {
    return null;
  }
}

export async function writeCredentials(creds: ADXCredentials): Promise<void> {
  await fs.promises.mkdir(CREDS_DIR, { recursive: true });
  await fs.promises.writeFile(CREDS_PATH, JSON.stringify(creds, null, 2), 'utf8');
  await fs.promises.chmod(CREDS_PATH, 0o600);
}

export function validateCredentials(creds: Partial<ADXCredentials>): string | null {
  if (!creds.clusterUrl) {
    return 'Cluster URL is required';
  }
  if (!creds.clusterUrl.startsWith('https://')) {
    return 'Cluster URL must start with https://';
  }
  if (!creds.tenantId) {
    return 'Tenant ID is required';
  }
  if (!creds.clientId) {
    return 'Client ID is required';
  }
  if (!creds.clientSecret) {
    return 'Client Secret is required';
  }
  return null;
}
