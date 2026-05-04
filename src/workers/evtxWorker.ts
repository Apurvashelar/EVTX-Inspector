// Web Worker: parses an EVTX file from an ArrayBuffer using @ts-evtx/core.
// The EvtxFile constructor is called directly (private in TS, public in JS),
// bypassing the Node.js fs-dependent open() factory method.
import { EvtxFile } from '@ts-evtx/core'
import { extractEvtxFields } from '../utils/evtxXmlExtractor'
import type { ColumnMeta, DataRow } from '../types'

const EVTX_COLUMNS: ColumnMeta[] = [
  { id: 'EventRecordID', label: 'Record ID', width: 90, isNumeric: true },
  { id: 'TimeCreated',   label: 'Time Created', width: 200, isTimestamp: true },
  { id: 'EventID',       label: 'Event ID', width: 75, isNumeric: true },
  { id: 'Level',         label: 'Level', width: 100 },
  { id: 'Channel',       label: 'Channel', width: 130 },
  { id: 'Computer',      label: 'Computer', width: 150 },
  { id: 'Provider',      label: 'Provider', width: 280 },
  { id: 'UserID',        label: 'User ID', width: 130 },
  { id: 'Keywords',      label: 'Keywords', width: 100 },
  { id: 'Task',          label: 'Task', width: 60, isNumeric: true },
  { id: 'Opcode',        label: 'Opcode', width: 65, isNumeric: true },
  { id: 'EventData',     label: 'Event Data', width: 400 },
]

self.onmessage = (e: MessageEvent) => {
  const { type, buffer } = e.data
  if (type !== 'parse') return

  try {
    const uint8 = new Uint8Array(buffer as ArrayBuffer)
    // EvtxFile constructor is private in TypeScript but public in JS.
    // We bypass the private restriction to avoid the Node.js fs-dependent open() factory.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Klass = EvtxFile as unknown as new (buf: Uint8Array) => any
    const file = new Klass(uint8)

    let estimatedTotal = 1000
    try {
      const stats = file.getStats()
      estimatedTotal = (stats?.chunkCount ?? 0) * 60 || 1000
    } catch { /* getStats unavailable in some library versions — use fallback */ }

    const rows: DataRow[] = []
    let loaded = 0

    for (const record of file.records()) {
      try {
        const xml = record.renderXml()
        const fields = extractEvtxFields(xml)
        const flagKey = fields.EventRecordID || String(loaded)
        rows.push({ _flagKey: flagKey, _rowIndex: loaded, ...fields })
      } catch {
        // Skip malformed records rather than crashing the whole parse
      }

      loaded++
      if (loaded % 500 === 0) {
        self.postMessage({ type: 'progress', loaded, total: Math.max(estimatedTotal, loaded) })
      }
    }

    self.postMessage({ type: 'progress', loaded, total: loaded })
    self.postMessage({ type: 'done', rows, columns: EVTX_COLUMNS })
  } catch (err) {
    self.postMessage({ type: 'error', message: (err as Error).message ?? String(err) })
  }
}
