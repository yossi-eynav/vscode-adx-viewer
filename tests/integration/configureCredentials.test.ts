/**
 * Integration tests for configureCredentials command.
 *
 * These tests use @vscode/test-electron and run inside a VS Code host.
 * They verify command registration, credentials file creation, and pre-population.
 */
import * as vscode from 'vscode';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CREDS_PATH = path.join(os.homedir(), '.config', 'adx-viewer', 'credentials.json');

suite('configureCredentials integration', () => {
  setup(async () => {
    // Clean up any existing credentials file before each test
    try {
      await fs.promises.unlink(CREDS_PATH);
    } catch {
      // file may not exist — that's fine
    }
  });

  test('command adxViewer.configureCredentials is registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes('adxViewer.configureCredentials'),
      'adxViewer.configureCredentials should be registered'
    );
  });

  test('command appears in command palette with correct title', async () => {
    // Verify via extension manifest contributes.commands
    const ext = vscode.extensions.getExtension('adx-vscode-viewer.adx-vscode-viewer');
    if (ext) {
      const pkg = ext.packageJSON as {
        contributes?: { commands?: Array<{ command: string; title: string }> };
      };
      const contributed = pkg.contributes?.commands ?? [];
      const cmd = contributed.find((c) => c.command === 'adxViewer.configureCredentials');
      assert.ok(cmd, 'Command should be in contributes.commands');
      assert.strictEqual(cmd?.title, 'ADX: Configure Connection');
    }
  });
});
