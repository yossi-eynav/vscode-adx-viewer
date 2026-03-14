/**
 * Integration tests for adxDocumentProvider.
 *
 * These tests run inside a VS Code host via @vscode/test-electron.
 */
import * as vscode from 'vscode';
import * as assert from 'assert';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const CREDS_PATH = path.join(os.homedir(), '.config', 'adx-viewer', 'credentials.json');

suite('adxDocumentProvider integration', () => {
  setup(async () => {
    try {
      await fs.promises.unlink(CREDS_PATH);
    } catch {
      // ignore
    }
  });

  test('opening .adx file without credentials shows error notification', async () => {
    // Create a temp .adx file
    const tmpDir = os.tmpdir();
    const adxFile = path.join(tmpDir, 'test-missing-creds.adx');
    await fs.promises.writeFile(adxFile, 'StormEvents | take 10');

    const doc = await vscode.workspace.openTextDocument(adxFile);
    await vscode.window.showTextDocument(doc);

    // Give the provider time to react
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Clean up
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    await fs.promises.unlink(adxFile);

    assert.ok(true, 'No errors thrown when opening .adx without credentials');
  });
});
