declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
};

let _api: ReturnType<typeof acquireVsCodeApi> | null = null;

export function isVsCodeWebview(): boolean {
  return typeof acquireVsCodeApi !== 'undefined';
}

export function getVsCodeApi(): ReturnType<typeof acquireVsCodeApi> | null {
  if (_api) return _api;
  if (isVsCodeWebview()) {
    _api = acquireVsCodeApi();
  }
  return _api;
}
