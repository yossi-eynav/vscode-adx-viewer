import * as vscode from 'vscode';
import * as crypto from 'crypto';

export function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

export function getResultsHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  nonce: string
): string {
  const chartUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'chart.min.js')
  );
  const cspSource = webview.cspSource;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${cspSource} 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ADX Query Results</title>
  <style>
    body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); background: var(--vscode-editor-background); margin: 0; padding: 16px; }
    #status { padding: 12px; font-style: italic; color: var(--vscode-descriptionForeground); }
    #truncation-notice { padding: 8px; background: var(--vscode-inputValidation-warningBackground); border: 1px solid var(--vscode-inputValidation-warningBorder); margin-bottom: 12px; display: none; }
    #results-table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
    #results-table th { background: var(--vscode-editor-lineHighlightBackground); text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--vscode-editorGroup-border); }
    #results-table td { padding: 4px 8px; border-bottom: 1px solid var(--vscode-editorGroup-border); }
    #chart-container { margin-top: 24px; max-height: 320px; }
    canvas { max-width: 100%; }
    #error-message { color: var(--vscode-errorForeground); padding: 12px; }
  </style>
</head>
<body>
  <div id="status">Loading...</div>
  <div id="truncation-notice"></div>
  <div id="error-message" style="display:none;"></div>
  <table id="results-table" style="display:none;">
    <thead><tr id="table-headers"></tr></thead>
    <tbody id="table-body"></tbody>
  </table>
  <div id="chart-container" style="display:none;">
    <canvas id="results-chart"></canvas>
  </div>

  <script nonce="${nonce}" src="${chartUri}"></script>
  <script nonce="${nonce}">
    (function() {
      const vscode = acquireVsCodeApi();
      let chartInstance = null;

      window.addEventListener('message', function(event) {
        const msg = event.data;
        switch (msg.command) {
          case 'renderLoading':
            showStatus('Loading query results...');
            break;
          case 'renderEmpty':
            showStatus('No results returned.');
            break;
          case 'renderError':
            showError(msg.message);
            break;
          case 'renderResults':
            renderResults(msg);
            break;
        }
      });

      function showStatus(text) {
        document.getElementById('status').style.display = '';
        document.getElementById('status').textContent = text;
        document.getElementById('error-message').style.display = 'none';
        document.getElementById('results-table').style.display = 'none';
        document.getElementById('chart-container').style.display = 'none';
        document.getElementById('truncation-notice').style.display = 'none';
      }

      function showError(message) {
        document.getElementById('status').style.display = 'none';
        document.getElementById('error-message').style.display = '';
        document.getElementById('error-message').textContent = message;
        document.getElementById('results-table').style.display = 'none';
        document.getElementById('chart-container').style.display = 'none';
      }

      function renderResults(msg) {
        document.getElementById('status').style.display = 'none';
        document.getElementById('error-message').style.display = 'none';

        if (msg.truncated) {
          const notice = document.getElementById('truncation-notice');
          notice.style.display = '';
          notice.textContent = 'Showing first 1,000 rows of ' + msg.totalRowCount + ' total';
        } else {
          document.getElementById('truncation-notice').style.display = 'none';
        }

        // Render table
        const table = document.getElementById('results-table');
        table.style.display = '';
        const headers = document.getElementById('table-headers');
        headers.innerHTML = '';
        msg.columns.forEach(function(col) {
          const th = document.createElement('th');
          th.textContent = col.name;
          headers.appendChild(th);
        });
        const tbody = document.getElementById('table-body');
        tbody.innerHTML = '';
        msg.rows.forEach(function(row) {
          const tr = document.createElement('tr');
          row.forEach(function(cell) {
            const td = document.createElement('td');
            td.textContent = cell === null ? '' : String(cell);
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });

        // Render chart
        renderChart(msg.columns, msg.rows);
      }

      function selectChartType(columns) {
        const hasDatetime = columns.some(function(c) { return c.type === 'datetime'; });
        const hasNumeric = columns.some(function(c) { return c.type === 'numeric'; });
        return (hasDatetime && hasNumeric) ? 'line' : 'bar';
      }

      function renderChart(columns, rows) {
        if (!window.Chart) return;
        const container = document.getElementById('chart-container');
        const canvas = document.getElementById('results-chart');

        if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

        const labelColIdx = columns.findIndex(function(c) { return c.type !== 'numeric'; });
        const numericCols = columns.map(function(c, i) { return { c, i }; }).filter(function(x) { return x.c.type === 'numeric'; });

        if (numericCols.length === 0) { container.style.display = 'none'; return; }
        container.style.display = '';

        const labels = rows.map(function(row) { return labelColIdx >= 0 ? row[labelColIdx] : ''; });
        const datasets = numericCols.map(function(x) {
          return {
            label: columns[x.i].name,
            data: rows.map(function(row) { return row[x.i]; }),
            fill: false,
          };
        });

        const chartType = selectChartType(columns);
        chartInstance = new window.Chart(canvas, {
          type: chartType,
          data: { labels: labels, datasets: datasets },
          options: { responsive: true, maintainAspectRatio: true },
        });
      }

      // Signal ready to the extension host
      vscode.postMessage({ command: 'ready' });
    })();
  </script>
</body>
</html>`;
}
