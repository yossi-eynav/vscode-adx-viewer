class EventEmitter<T> {
  private listeners: ((e: T) => void)[] = [];

  readonly event = (listener: (e: T) => void): { dispose: () => void } => {
    this.listeners.push(listener);
    return {
      dispose: () => {
        const idx = this.listeners.indexOf(listener);
        if (idx >= 0) this.listeners.splice(idx, 1);
      },
    };
  };

  fire(data?: T): void {
    this.listeners.forEach((l) => l(data as T));
  }

  dispose(): void {
    this.listeners = [];
  }
}

class TreeItem {
  id?: string;
  description?: string | boolean;
  collapsibleState?: number;

  constructor(
    public label: string,
    collapsibleState?: number
  ) {
    this.collapsibleState = collapsibleState;
  }
}

const TreeItemCollapsibleState = {
  None: 0,
  Collapsed: 1,
  Expanded: 2,
};

const vscode = {
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    createInputBox: jest.fn(),
    createWebviewPanel: jest.fn(),
    registerTreeDataProvider: jest.fn(),
  },
  workspace: {
    onDidOpenTextDocument: jest.fn(),
    onDidSaveTextDocument: jest.fn(),
    textDocuments: [],
  },
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn(),
  },
  Uri: {
    file: jest.fn((f: string) => ({ fsPath: f, scheme: 'file' })),
    joinPath: jest.fn(),
  },
  ViewColumn: {
    Beside: 2,
  },
  ExtensionContext: jest.fn(),
  EventEmitter,
  TreeItem,
  TreeItemCollapsibleState,
};

export = vscode;
