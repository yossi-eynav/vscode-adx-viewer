export enum ColumnType {
  datetime = 'datetime',
  numeric = 'numeric',
  string = 'string',
  bool = 'bool',
  timespan = 'timespan',
  dynamic = 'dynamic',
  other = 'other',
}

export interface ResultColumn {
  name: string;
  type: ColumnType;
}

export type ResultRow = Array<string | number | boolean | null>;

export interface RenderLoadingMessage {
  command: 'renderLoading';
}

export interface RenderResultsMessage {
  command: 'renderResults';
  columns: ResultColumn[];
  rows: ResultRow[];
  truncated: boolean;
  totalRowCount: number;
  executedAt: string; // ISO 8601
  queryDurationMs: number;
}

export interface RenderEmptyMessage {
  command: 'renderEmpty';
}

export interface RenderErrorMessage {
  command: 'renderError';
  message: string;
  statusCode?: number;
  responseBody?: string;
}

export interface ActiveFilter {
  name: string;
  value: string;
}

export interface SetConfigMessage {
  command: 'setConfig';
  activeFilters: ActiveFilter[];
}

export interface ReadyMessage {
  command: 'ready';
}

export type HostToWebviewMessage =
  | RenderLoadingMessage
  | RenderResultsMessage
  | RenderEmptyMessage
  | RenderErrorMessage
  | SetConfigMessage;

export type WebviewToHostMessage = ReadyMessage;
