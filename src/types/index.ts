export type FlagType = 'suspicious' | 'reviewed' | 'noteworthy'

export interface ColumnMeta {
  id: string
  label: string
  width: number
  minWidth?: number
  isTimestamp?: boolean
  isNumeric?: boolean
  noFilter?: boolean
}

export interface DataRow {
  _flagKey: string   // unique key for flagging (EventRecordID or row index)
  _rowIndex: number
  [key: string]: string | number
}

export type FileType = 'evtx' | 'csv' | 'sample'

export interface LoadedFile {
  name: string
  type: FileType
  hash: string
  totalRows: number
}

export interface FileEntry {
  id: string
  metadata: LoadedFile
  columns: ColumnMeta[]
  rows: DataRow[]
  columnFilters: Record<string, string>
  showFlaggedOnly: boolean
  columnVisibility: Record<string, boolean>  // columnId → visible (missing = true)
  columnWidths: Record<string, number>       // columnId → px width override
  columnOrder?: string[]                     // ordered column IDs (undefined = natural order)
}

export type WorkerMessage =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'done'; rows: DataRow[]; columns: ColumnMeta[] }
  | { type: 'error'; message: string }

export type WorkerRequest =
  | { type: 'parse'; buffer: ArrayBuffer; fileName: string }
