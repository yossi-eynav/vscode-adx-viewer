import * as vscode from 'vscode';
import * as crypto from 'crypto';

export function getResultsHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'out', 'webview', 'webview.js')
  );
  const nonce = crypto.randomBytes(16).toString('base64');
  const cspSource = webview.cspSource;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'nonce-${nonce}' ${cspSource}; style-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} data:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ADX Query Results</title>
</head>
<body>
  <div id="root"></div>
  <div id="load-error" style="display:none;padding:16px;color:#f48771;font-family:monospace;white-space:pre-wrap;"></div>
  <script nonce="${nonce}">
    window.onerror = function(msg, src, line, col, err) {
      var el = document.getElementById('load-error');
      el.style.display = 'block';
      el.textContent = 'JS Error: ' + msg + '\\n' + (err && err.stack ? err.stack : '') + '\\nsrc:' + src + ':' + line;
    };
    window.addEventListener('unhandledrejection', function(e) {
      var el = document.getElementById('load-error');
      el.style.display = 'block';
      el.textContent = 'Unhandled promise rejection: ' + (e.reason && e.reason.stack ? e.reason.stack : String(e.reason));
    });
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
