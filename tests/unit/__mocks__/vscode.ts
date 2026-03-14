const vscode = {
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    createInputBox: jest.fn(),
    createWebviewPanel: jest.fn(),
  },
  workspace: {
    onDidOpenTextDocument: jest.fn(),
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
};

export = vscode;
