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

export interface ConnectionsStore {
  activeConnection: string;
  connections: Record<string, ADXCredentials>;
}

const CREDS_DIR = path.join(os.homedir(), '.config', 'adx-viewer');
const CREDS_PATH = path.join(CREDS_DIR, 'credentials.json');

async function readStore(): Promise<ConnectionsStore | null> {
  try {
    const content = await fs.promises.readFile(CREDS_PATH, 'utf8');
    const parsed = JSON.parse(content) as Record<string, unknown>;
    // Migration: old single-connection format has clusterUrl at root
    if (typeof parsed.clusterUrl === 'string') {
      return {
        activeConnection: 'default',
        connections: { default: parsed as unknown as ADXCredentials },
      };
    }
    if (
      typeof parsed.activeConnection === 'string' &&
      typeof parsed.connections === 'object' &&
      parsed.connections !== null
    ) {
      return parsed as unknown as ConnectionsStore;
    }
    return null;
  } catch {
    return null;
  }
}

async function writeStore(store: ConnectionsStore): Promise<void> {
  await fs.promises.mkdir(CREDS_DIR, { recursive: true });
  await fs.promises.writeFile(CREDS_PATH, JSON.stringify(store, null, 2), 'utf8');
  await fs.promises.chmod(CREDS_PATH, 0o600);
}

export async function readCredentials(): Promise<ADXCredentials | null> {
  const store = await readStore();
  if (!store) return null;
  const creds = store.connections[store.activeConnection];
  if (!creds || validateCredentials(creds) !== null) return null;
  return creds;
}

export async function readAllConnections(): Promise<ConnectionsStore | null> {
  return readStore();
}

export async function getActiveConnectionName(): Promise<string | null> {
  const store = await readStore();
  if (!store) return null;
  return store.activeConnection in store.connections ? store.activeConnection : null;
}

export async function writeConnection(name: string, creds: ADXCredentials): Promise<void> {
  const store = (await readStore()) ?? { activeConnection: name, connections: {} };
  store.connections[name] = creds;
  await writeStore(store);
}

export async function setActiveConnection(name: string): Promise<void> {
  const store = await readStore();
  if (!store || !(name in store.connections)) return;
  store.activeConnection = name;
  await writeStore(store);
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
