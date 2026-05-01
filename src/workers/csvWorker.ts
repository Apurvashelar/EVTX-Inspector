// Web Worker: parses a CSV file using PapaParse streaming.
import Papa from 'papaparse'
import type { ColumnMeta, DataRow } from '../types'

// Well-known EvtxECmd column names → canonical display labels
const KNOWN_LABELS: Record<string, string> = {
  EventRecordID: 'Record ID',
  TimeCreated: 'Time Created',
  EventID: 'Event ID',
  LevelName: 'Level',
  Channel: 'Channel',
  Computer: 'Computer',
  Provider: 'Provider',
  UserId: 'User ID',
  Keywords: 'Keywords',
  MapDescription: 'Description',
  PayloadData1: 'Payload 1',
  PayloadData2: 'Payload 2',
  PayloadData3: 'Payload 3',
  PayloadData4: 'Payload 4',
  PayloadData5: 'Payload 5',
  PayloadData6: 'Payload 6',
}

const DEFAULT_WIDTH = 160
const WIDE_COLUMNS = new Set(['MapDescription', 'PayloadData1', 'PayloadData2', 'PayloadData3',
  'PayloadData4', 'PayloadData5', 'PayloadData6', 'EventData', 'Message'])
const NARROW_COLUMNS = new Set(['EventID', 'EventRecordID', 'Task', 'Opcode', 'Level', 'LevelName'])
const TIMESTAMP_COLUMNS = new Set(['TimeCreated', 'TimeGenerated', 'TimeWritten', 'Timestamp'])

self.onmessage = async (e: MessageEvent) => {
  const { type, buffer } = e.data
  if (type !== 'parse') return

  try {
    const decoder = new TextDecoder('utf-8')
    const csvText = decoder.decode(new Uint8Array(buffer as ArrayBuffer))

    const rows: DataRow[] = []
    let headers: string[] = []
    let rowIndex = 0

    // Use PapaParse in sync mode since we already have the full text in memory
    const result = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    })

    if (result.errors.length > 0 && rows.length === 0) {
      const fatal = result.errors.find(e => e.type === 'Delimiter' || e.type === 'FieldMismatch')
      if (fatal) {
        self.postMessage({ type: 'error', message: `CSV parse error: ${fatal.message}` })
        return
      }
    }

    headers = result.meta.fields ?? []
    if (headers.length === 0) {
      self.postMessage({ type: 'error', message: 'CSV file has no header row or is empty.' })
      return
    }

    // Choose the flag key column: prefer EventRecordID, else row index
    const flagKeyCol = headers.find(h =>
      h === 'EventRecordID' || h === 'RecordNumber' || h === 'RecordID'
    )

    for (const rawRow of result.data) {
      const flagKey = flagKeyCol ? String(rawRow[flagKeyCol] ?? rowIndex) : String(rowIndex)
      rows.push({ _flagKey: flagKey, _rowIndex: rowIndex, ...rawRow })
      rowIndex++
      if (rowIndex % 2000 === 0) {
        // Approximate progress based on average row index vs total
        self.postMessage({ type: 'progress', loaded: rowIndex, total: rowIndex + 1 })
      }
    }

    const columns: ColumnMeta[] = headers.map(h => ({
      id: h,
      label: KNOWN_LABELS[h] ?? h,
      width: WIDE_COLUMNS.has(h) ? 300 : NARROW_COLUMNS.has(h) ? 80 : DEFAULT_WIDTH,
      isTimestamp: TIMESTAMP_COLUMNS.has(h),
      isNumeric: NARROW_COLUMNS.has(h) && h !== 'LevelName',
    }))

    self.postMessage({ type: 'progress', loaded: rowIndex, total: rowIndex })
    self.postMessage({ type: 'done', rows, columns })
  } catch (err) {
    self.postMessage({ type: 'error', message: (err as Error).message ?? String(err) })
  }
}
