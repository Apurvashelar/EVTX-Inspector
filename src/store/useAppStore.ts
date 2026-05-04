import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ColumnMeta, DataRow, FileEntry, FileType, FlagType, LoadedFile } from '../types'
import { computeFileHash } from '../utils/fileHash'
import { SAMPLE_FILE_ENTRY } from '../data/sampleData'

// ---------------------------------------------------------------------------
// Flag store — persisted to localStorage keyed by fileHash → flagKey → FlagType
// ---------------------------------------------------------------------------

interface FlagStore {
  flags: Record<string, Record<string, FlagType>>
  setFlag: (fileHash: string, flagKey: string, flag: FlagType | null) => void
  getFlags: (fileHash: string) => Record<string, FlagType>
}

export const useFlagStore = create<FlagStore>()(
  persist(
    (set, get) => ({
      flags: {},
      setFlag: (fileHash, flagKey, flag) => {
        set(state => {
          const current = { ...(state.flags[fileHash] ?? {}) }
          if (flag === null) {
            delete current[flagKey]
          } else {
            current[flagKey] = flag
          }
          return { flags: { ...state.flags, [fileHash]: current } }
        })
      },
      getFlags: (fileHash) => get().flags[fileHash] ?? {},
    }),
    { name: 'evtx-inspector-flags' }
  )
)

// ---------------------------------------------------------------------------
// App state — multi-file, not persisted (files are in-memory only)
// ---------------------------------------------------------------------------

export interface FlagNavRequest {
  type: FlagType
  seq: number  // increments each click to re-trigger effect
}

interface AppState {
  // Multi-file
  files: Record<string, FileEntry>
  activeFileId: string | null
  sidebarCollapsed: boolean
  isSample: boolean

  // Loading state (single active load at a time)
  isLoading: boolean
  loadProgress: number
  loadError: string | null

  // Time range filter — applied on the active file's timestamp column
  timeFrom: string
  timeTo: string

  // Global search — applied across all columns before column filters
  globalSearch: string

  // Flag navigation signal
  flagNavRequest: FlagNavRequest | null

  // Actions
  addFile: (entry: FileEntry) => void
  restoreFile: (entry: FileEntry) => void
  switchFile: (id: string) => void
  removeFile: (id: string) => void
  toggleSidebar: () => void

  setColumnFilter: (columnId: string, value: string) => void
  clearAllFilters: () => void
  toggleShowFlaggedOnly: () => void
  setColumnVisibility: (columnId: string, visible: boolean) => void
  resetColumnVisibility: () => void
  setColumnWidth: (columnId: string, width: number) => void
  setColumnOrder: (colIds: string[]) => void

  setLoading: (progress: number) => void
  setLoadError: (msg: string) => void
  setData: (file: File, fileType: FileType, hash: string, columns: ColumnMeta[], rows: DataRow[]) => void
  reset: () => void

  setTimeRange: (from: string, to: string) => void
  clearTimeRange: () => void
  setGlobalSearch: (q: string) => void
  navigateToFlag: (type: FlagType) => void
  loadSampleData: () => void
}

// Convenience selector — returns the active FileEntry or null
export function useActiveFile(): FileEntry | null {
  return useAppStore(state =>
    state.activeFileId ? (state.files[state.activeFileId] ?? null) : null
  )
}

// Convenience selector — checks whether any real file (non-sample) is loaded
export function useHasRealFile(): boolean {
  return useAppStore(state =>
    Object.values(state.files).some(f => f.metadata.type !== 'sample')
  )
}

const INITIAL_STATE = {
  files: { '__sample__': SAMPLE_FILE_ENTRY } as Record<string, FileEntry>,
  activeFileId: '__sample__' as string | null,
  sidebarCollapsed: false,
  isSample: true,
  isLoading: false,
  loadProgress: 0,
  loadError: null,
  timeFrom: '',
  timeTo: '',
  globalSearch: '',
  flagNavRequest: null,
}

export const useAppStore = create<AppState>()((set) => ({
  ...INITIAL_STATE,

  addFile: (entry) =>
    set(state => ({
      files: { ...state.files, [entry.id]: entry },
      activeFileId: entry.id,
      isSample: false,
    })),

  // Restores a persisted file without changing activeFileId
  restoreFile: (entry) =>
    set(state => ({
      files: { ...state.files, [entry.id]: entry },
    })),

  switchFile: (id) =>
    set({
      activeFileId: id,
      isSample: id === '__sample__',
      timeFrom: '',
      timeTo: '',
      globalSearch: '',
    }),

  removeFile: (id) =>
    set(state => {
      const files = { ...state.files }
      delete files[id]

      // Fall back to another file, or re-add sample if nothing left
      let nextId = state.activeFileId === id
        ? (Object.keys(files)[0] ?? null)
        : state.activeFileId

      const isSample = nextId === '__sample__'
      return { files, activeFileId: nextId, isSample, timeFrom: '', timeTo: '' }
    }),

  toggleSidebar: () =>
    set(state => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setColumnFilter: (columnId, value) =>
    set(state => {
      if (!state.activeFileId) return {}
      const entry = state.files[state.activeFileId]
      if (!entry) return {}
      return {
        files: {
          ...state.files,
          [state.activeFileId]: {
            ...entry,
            columnFilters: { ...entry.columnFilters, [columnId]: value },
          },
        },
      }
    }),

  clearAllFilters: () =>
    set(state => {
      if (!state.activeFileId) return {}
      const entry = state.files[state.activeFileId]
      if (!entry) return {}
      return {
        files: {
          ...state.files,
          [state.activeFileId]: { ...entry, columnFilters: {} },
        },
      }
    }),

  toggleShowFlaggedOnly: () =>
    set(state => {
      if (!state.activeFileId) return {}
      const entry = state.files[state.activeFileId]
      if (!entry) return {}
      return {
        files: {
          ...state.files,
          [state.activeFileId]: { ...entry, showFlaggedOnly: !entry.showFlaggedOnly },
        },
      }
    }),

  setColumnVisibility: (columnId, visible) =>
    set(state => {
      if (!state.activeFileId) return {}
      const entry = state.files[state.activeFileId]
      if (!entry) return {}
      return {
        files: {
          ...state.files,
          [state.activeFileId]: {
            ...entry,
            columnVisibility: { ...entry.columnVisibility, [columnId]: visible },
          },
        },
      }
    }),

  resetColumnVisibility: () =>
    set(state => {
      if (!state.activeFileId) return {}
      const entry = state.files[state.activeFileId]
      if (!entry) return {}
      return {
        files: {
          ...state.files,
          [state.activeFileId]: { ...entry, columnVisibility: {} },
        },
      }
    }),

  setColumnWidth: (columnId, width) =>
    set(state => {
      if (!state.activeFileId) return {}
      const entry = state.files[state.activeFileId]
      if (!entry) return {}
      return {
        files: {
          ...state.files,
          [state.activeFileId]: {
            ...entry,
            columnWidths: { ...entry.columnWidths, [columnId]: width },
          },
        },
      }
    }),

  setColumnOrder: (colIds) =>
    set(state => {
      if (!state.activeFileId) return {}
      const entry = state.files[state.activeFileId]
      if (!entry) return {}
      return {
        files: {
          ...state.files,
          [state.activeFileId]: { ...entry, columnOrder: colIds },
        },
      }
    }),

  setLoading: (progress) =>
    set({ isLoading: true, loadProgress: progress, loadError: null }),

  setLoadError: (msg) =>
    set({ isLoading: false, loadError: msg }),

  setData: (file, fileType, hash, columns, rows) => {
    const entry: FileEntry = {
      id: hash,
      metadata: { name: file.name, type: fileType, hash, totalRows: rows.length } as LoadedFile,
      columns,
      rows,
      columnFilters: {},
      showFlaggedOnly: false,
      columnVisibility: {},
      columnWidths: {},
    }
    set(state => ({
      isLoading: false,
      loadProgress: 100,
      loadError: null,
      isSample: false,
      files: { ...state.files, [hash]: entry },
      activeFileId: hash,
      timeFrom: '',
      timeTo: '',
      globalSearch: '',
    }))
  },

  reset: () => set({ ...INITIAL_STATE }),

  setTimeRange: (from, to) => set({ timeFrom: from, timeTo: to }),

  clearTimeRange: () => set({ timeFrom: '', timeTo: '' }),

  setGlobalSearch: (q) => set({ globalSearch: q }),

  navigateToFlag: (type) =>
    set(state => ({
      flagNavRequest: {
        type,
        seq: (state.flagNavRequest?.seq ?? 0) + 1,
      },
    })),

  loadSampleData: () =>
    set({
      files: { '__sample__': SAMPLE_FILE_ENTRY },
      activeFileId: '__sample__',
      isSample: true,
    }),
}))

// ---------------------------------------------------------------------------
// loadFile — dispatches to the correct Web Worker
// ---------------------------------------------------------------------------

import EvtxWorker from '../workers/evtxWorker?worker'
import CsvWorker from '../workers/csvWorker?worker'
import { persistFile, unpersistFile } from '../utils/persistence'

export async function loadFile(file: File): Promise<void> {
  const store = useAppStore.getState()
  store.setLoading(0)

  const ext = file.name.toLowerCase().split('.').pop()
  const fileType: FileType = ext === 'evtx' ? 'evtx' : 'csv'
  const hash = await computeFileHash(file)
  const buffer = await file.arrayBuffer()

  const worker = fileType === 'evtx' ? new EvtxWorker() : new CsvWorker()

  worker.onmessage = (e) => {
    const msg = e.data
    if (msg.type === 'progress') {
      store.setLoading(Math.round((msg.loaded / msg.total) * 100))
    } else if (msg.type === 'done') {
      store.setData(file, fileType, hash, msg.columns, msg.rows)
      // Persist the loaded file so it survives page refresh
      const entry = useAppStore.getState().files[hash]
      if (entry) persistFile(entry).catch(() => {})
      worker.terminate()
    } else if (msg.type === 'error') {
      store.setLoadError(msg.message)
      worker.terminate()
    }
  }

  worker.onerror = (e) => {
    store.setLoadError(e.message ?? 'Unknown worker error')
    worker.terminate()
  }

  worker.postMessage({ type: 'parse', buffer, fileName: file.name }, [buffer])
}

export async function removeFileAndUnpersist(id: string): Promise<void> {
  useAppStore.getState().removeFile(id)
  await unpersistFile(id).catch(() => {})
}
