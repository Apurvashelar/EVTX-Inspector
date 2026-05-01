import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  type ColumnDef,
  type FilterFn,
  type Row as TRow,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useAppStore, useActiveFile, useFlagStore } from '../store/useAppStore'
import type { DataRow, FlagType } from '../types'

const ROW_HEIGHT = 34

const LEVEL_COLORS: Record<string, string> = {
  Critical: 'var(--flag-suspicious)',
  Error: 'var(--flag-suspicious)',
  Warning: 'var(--flag-noteworthy)',
  Information: 'var(--accent-blue)',
  Verbose: 'var(--text-muted)',
  LogAlways: 'var(--text-muted)',
}

const FLAG_COLORS: Record<FlagType, string> = {
  suspicious: 'var(--flag-suspicious)',
  reviewed: 'var(--flag-reviewed)',
  noteworthy: 'var(--flag-noteworthy)',
}

const FLAG_BG: Record<FlagType, string> = {
  suspicious: 'var(--flag-bg-suspicious)',
  reviewed: 'var(--flag-bg-reviewed)',
  noteworthy: 'var(--flag-bg-noteworthy)',
}

const FLAG_LABELS: Record<FlagType, string> = {
  suspicious: 'Suspicious',
  reviewed: 'Reviewed',
  noteworthy: 'Noteworthy',
}

const substringFilter: FilterFn<DataRow> = (row, columnId, filterValue: string) => {
  if (!filterValue) return true
  const val = String(row.getValue(columnId) ?? '').toLowerCase()
  return val.includes(filterValue.toLowerCase())
}

interface ContextMenu { x: number; y: number; flagKey: string }

function normalizeTs(ts: string): string {
  return ts.replace(' ', 'T').replace('Z', '').replace(' UTC', '').substring(0, 19)
}

// Checkbox column width (px)
const SELECT_COL_W = 28

export function EventTable() {
  const entry = useActiveFile()
  const { setColumnFilter, timeFrom, timeTo, globalSearch, flagNavRequest } = useAppStore()
  const { getFlags, setFlag } = useFlagStore()

  // Scroll containers
  const containerRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null)
  const [flashIndex, setFlashIndex] = useState<number | null>(null)
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set())
  const selectAllRef = useRef<HTMLInputElement>(null)
  const flagNavIndexRef = useRef<Record<FlagType, number>>({ suspicious: -1, reviewed: -1, noteworthy: -1 })
  const prevFlagNavRef = useRef<typeof flagNavRequest>(null)

  const columnMeta = entry?.columns ?? []
  const rows = entry?.rows ?? []
  const columnFilters = entry?.columnFilters ?? {}
  const showFlaggedOnly = entry?.showFlaggedOnly ?? false
  const columnVisibility = entry?.columnVisibility ?? {}
  const columnWidths = entry?.columnWidths ?? {}
  const fileHash = entry?.metadata.hash ?? ''
  const flags = getFlags(fileHash)

  // Reset selection when the file changes
  useEffect(() => {
    setCheckedKeys(new Set())
    setSelectedRowKey(null)
  }, [fileHash])

  const tableCols = useMemo<ColumnDef<DataRow>[]>(() => [
    { id: '_flag', header: '', size: 10, enableColumnFilter: false, cell: () => null },
    ...columnMeta
      .filter(col => columnVisibility[col.id] !== false)
      .map(col => ({
        id: col.id,
        accessorKey: col.id,
        header: col.label,
        size: columnWidths[col.id] ?? col.width,
        filterFn: substringFilter,
        cell: () => null,
      })),
  ], [columnMeta, columnVisibility, columnWidths])

  const tanstackFilters = useMemo(() =>
    Object.entries(columnFilters)
      .filter(([, v]) => v !== '')
      .map(([id, value]) => ({ id, value })),
    [columnFilters]
  )

  const table = useReactTable<DataRow>({
    data: rows,
    columns: tableCols,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: { columnFilters: tanstackFilters },
    manualFiltering: false,
    filterFns: { substring: substringFilter },
  })

  const tanFilteredRows = table.getFilteredRowModel().rows

  const globalFiltered = useMemo(() => {
    const q = globalSearch.trim().toLowerCase()
    if (!q) return tanFilteredRows
    return tanFilteredRows.filter(r =>
      columnMeta.some(col =>
        String(r.original[col.id] ?? '').toLowerCase().includes(q)
      )
    )
  }, [tanFilteredRows, globalSearch, columnMeta])

  const flagFiltered = useMemo(() => {
    if (!showFlaggedOnly) return globalFiltered
    return globalFiltered.filter(r => !!flags[r.original._flagKey])
  }, [globalFiltered, showFlaggedOnly, flags])

  const filteredRows = useMemo(() => {
    if (!timeFrom && !timeTo) return flagFiltered
    const tsCol = columnMeta.find(c => c.isTimestamp)?.id
    if (!tsCol) return flagFiltered
    return flagFiltered.filter(r => {
      const ts = normalizeTs(String(r.original[tsCol] ?? ''))
      if (!ts) return true
      if (timeFrom && ts < timeFrom) return false
      if (timeTo && ts > timeTo) return false
      return true
    })
  }, [flagFiltered, timeFrom, timeTo, columnMeta])

  const rowVirtualizer = useVirtualizer({
    count: filteredRows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 25,
  })

  const virtualItems = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()

  const visibleCols = useMemo(() =>
    tableCols.filter(c => c.id === '_flag' || columnVisibility[String(c.id)] !== false),
    [tableCols, columnVisibility]
  )

  // Grid template includes the leading SELECT_COL_W checkbox column
  const gridTemplate = useMemo(
    () => `${SELECT_COL_W}px ${visibleCols.map(c => {
      if (c.id === '_flag') return '10px'
      const id = String(c.id)
      const meta = columnMeta.find(m => m.id === id)
      return `${columnWidths[id] ?? meta?.width ?? 160}px`
    }).join(' ')}`,
    [visibleCols, columnMeta, columnWidths]
  )

  const totalColumnWidth = useMemo(
    () => SELECT_COL_W + visibleCols.reduce((sum, c) => {
      if (c.id === '_flag') return sum + 10
      const id = String(c.id)
      const meta = columnMeta.find(m => m.id === id)
      return sum + (columnWidths[id] ?? meta?.width ?? 160)
    }, 0),
    [visibleCols, columnMeta, columnWidths]
  )

  // Keep select-all checkbox indeterminate state in sync
  useEffect(() => {
    if (!selectAllRef.current) return
    const total = filteredRows.length
    const checked = filteredRows.filter(r => checkedKeys.has(r.original._flagKey)).length
    selectAllRef.current.indeterminate = checked > 0 && checked < total
  }, [checkedKeys, filteredRows])

  const syncHeaderScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (headerRef.current) {
      headerRef.current.scrollLeft = e.currentTarget.scrollLeft
    }
  }, [])

  const [resizingCol, setResizingCol] = useState<string | null>(null)
  const startResize = useCallback((colId: string, startX: number, startWidth: number) => {
    setResizingCol(colId)
    const onMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(40, startWidth + e.clientX - startX)
      useAppStore.getState().setColumnWidth(colId, newWidth)
    }
    const onMouseUp = () => {
      setResizingCol(null)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [])

  // Flag navigation
  useEffect(() => {
    if (!flagNavRequest || flagNavRequest === prevFlagNavRef.current) return
    if (prevFlagNavRef.current?.seq === flagNavRequest.seq) return
    prevFlagNavRef.current = flagNavRequest
    const { type } = flagNavRequest
    const flaggedOfType = filteredRows
      .map((row, idx) => ({ row, idx }))
      .filter(({ row }) => flags[row.original._flagKey] === type)
    if (flaggedOfType.length === 0) return
    flagNavIndexRef.current[type] = (flagNavIndexRef.current[type] + 1) % flaggedOfType.length
    const target = flaggedOfType[flagNavIndexRef.current[type]]
    rowVirtualizer.scrollToIndex(target.idx, { align: 'center' })
    setFlashIndex(target.idx)
    setTimeout(() => setFlashIndex(null), 750)
  }, [flagNavRequest, filteredRows, flags, rowVirtualizer])

  // Context menu
  const onRightClick = useCallback((e: React.MouseEvent, row: TRow<DataRow>) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, flagKey: row.original._flagKey })
  }, [])

  const onSetFlag = useCallback((flag: FlagType | null) => {
    if (!contextMenu) return
    setFlag(fileHash, contextMenu.flagKey, flag)
    setContextMenu(null)
  }, [contextMenu, fileHash, setFlag])

  useEffect(() => {
    if (!contextMenu) return
    const handler = () => setContextMenu(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [contextMenu])

  // Checkbox selection helpers
  const toggleCheck = useCallback((flagKey: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setCheckedKeys(prev => {
      const next = new Set(prev)
      next.has(flagKey) ? next.delete(flagKey) : next.add(flagKey)
      return next
    })
  }, [])

  const allVisibleChecked =
    filteredRows.length > 0 && filteredRows.every(r => checkedKeys.has(r.original._flagKey))

  const handleSelectAll = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setCheckedKeys(new Set(filteredRows.map(r => r.original._flagKey)))
    } else {
      setCheckedKeys(new Set())
    }
  }, [filteredRows])

  const flagSelected = useCallback((flag: FlagType | null) => {
    checkedKeys.forEach(key => setFlag(fileHash, key, flag))
    setCheckedKeys(new Set())
  }, [checkedKeys, fileHash, setFlag])

  if (columnMeta.length === 0) return null

  const headerGroups = table.getHeaderGroups()

  return (
    <div className="flex flex-col flex-1 min-h-0 font-mono text-xs select-none">

      {/* ── Batch action bar (visible when rows are checked) ─────────────── */}
      {checkedKeys.size > 0 && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 border-b flex-shrink-0 flex-wrap"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
        >
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
            {checkedKeys.size} row{checkedKeys.size !== 1 ? 's' : ''} selected
          </span>
          <div className="h-3.5 w-px" style={{ background: 'var(--border)' }} />
          <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>
            Flag as
          </span>
          {(['suspicious', 'reviewed', 'noteworthy'] as FlagType[]).map(f => (
            <button
              key={f}
              onClick={() => flagSelected(f)}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs transition-colors"
              style={{ borderColor: FLAG_COLORS[f], color: FLAG_COLORS[f] }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: FLAG_COLORS[f], display: 'inline-block', flexShrink: 0 }} />
              {FLAG_LABELS[f]}
            </button>
          ))}
          <button
            onClick={() => flagSelected(null)}
            className="px-2 py-0.5 rounded border text-xs transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            Clear flags
          </button>
          <button
            onClick={() => setCheckedKeys(new Set())}
            className="text-xs underline-offset-2 hover:underline ml-auto"
            style={{ color: 'var(--text-muted)' }}
          >
            Deselect all
          </button>
        </div>
      )}

      {/* ── Sticky header ────────────────────────────────────────────────── */}
      <div
        ref={headerRef}
        className="flex-shrink-0"
        style={{ overflow: 'hidden', background: 'var(--bg-header)' }}
      >
        <div style={{ minWidth: totalColumnWidth }}>
          {headerGroups.map(hg => (
            <div key={hg.id}>
              {/* Column label row */}
              <div
                className="border-b border-[var(--border)]"
                style={{ display: 'grid', gridTemplateColumns: gridTemplate }}
              >
                {/* Select-all checkbox */}
                <div className="flex items-center justify-center border-r border-[var(--border)]">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allVisibleChecked}
                    onChange={handleSelectAll}
                    title="Select all visible rows"
                    className="w-3.5 h-3.5 accent-[var(--accent-blue)] cursor-pointer"
                  />
                </div>

                {hg.headers
                  .filter(h => h.column.id === '_flag' || columnVisibility[h.column.id] !== false)
                  .map(header => {
                    const colId = header.column.id
                    const col = columnMeta.find(c => c.id === colId)
                    const colWidth = columnWidths[colId] ?? col?.width ?? 160
                    return (
                      <div
                        key={header.id}
                        className="relative px-2 py-1.5 font-semibold text-[11px] uppercase tracking-wide truncate border-r border-[var(--border)] last:border-r-0"
                        style={{ minWidth: 0, color: 'var(--text-secondary)' }}
                      >
                        {colId === '_flag' ? '' : String(header.column.columnDef.header ?? '')}
                        {colId !== '_flag' && (
                          <div
                            className={`col-resize-handle ${resizingCol === colId ? 'resizing' : ''}`}
                            onMouseDown={e => { e.preventDefault(); startResize(colId, e.clientX, colWidth) }}
                          />
                        )}
                      </div>
                    )
                  })}
              </div>

              {/* Filter input row */}
              <div
                className="border-b-2 border-[var(--border)]"
                style={{ display: 'grid', gridTemplateColumns: gridTemplate }}
              >
                {/* Empty cell under select-all */}
                <div className="border-r border-[var(--border)] h-7" />

                {hg.headers
                  .filter(h => h.column.id === '_flag' || columnVisibility[h.column.id] !== false)
                  .map(header => (
                    <div key={header.id + '_f'} className="border-r border-[var(--border)] last:border-r-0">
                      {header.column.id !== '_flag' ? (
                        <input
                          type="text"
                          placeholder="filter…"
                          value={columnFilters[header.column.id] ?? ''}
                          onChange={e => setColumnFilter(header.column.id, e.target.value)}
                          className="w-full h-7 px-2 text-xs outline-none transition-colors"
                          style={{
                            background: 'var(--bg-filter)',
                            color: 'var(--text-primary)',
                            fontFamily: 'inherit',
                          }}
                          onFocus={e => (e.target.style.background = 'var(--bg-filter-focus)')}
                          onBlur={e => (e.target.style.background = 'var(--bg-filter)')}
                        />
                      ) : (
                        <div className="h-7" />
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Virtualized rows ─────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="flex-1"
        style={{ overflowX: 'auto', overflowY: 'auto' }}
        onScroll={syncHeaderScroll}
      >
        <div style={{ height: totalSize, position: 'relative', minWidth: totalColumnWidth }}>
          {filteredRows.length === 0 && (
            <div
              className="absolute inset-0 flex items-center justify-center text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              No events match the current filters
            </div>
          )}

          {virtualItems.map(virtualRow => {
            const row = filteredRows[virtualRow.index]
            const flag = flags[row.original._flagKey]
            const isSelected = row.original._flagKey === selectedRowKey
            const isChecked = checkedKeys.has(row.original._flagKey)
            const isFlashing = flashIndex === virtualRow.index

            const bgColor = isSelected
              ? 'var(--row-highlight)'
              : flag
                ? FLAG_BG[flag]
                : virtualRow.index % 2 === 0
                  ? 'var(--bg-row)'
                  : 'var(--bg-row-alt)'

            const shadowColor = isSelected
              ? 'var(--accent-blue)'
              : flag
                ? FLAG_COLORS[flag]
                : null
            const boxShadow = shadowColor ? `inset 3px 0 0 ${shadowColor}` : 'none'

            return (
              <div
                key={row.id}
                onClick={() => setSelectedRowKey(k => k === row.original._flagKey ? null : row.original._flagKey)}
                onContextMenu={e => onRightClick(e, row)}
                className={`border-b border-[var(--border-row)] ${isFlashing ? 'row-flash' : ''}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: ROW_HEIGHT,
                  transform: `translateY(${virtualRow.start}px)`,
                  display: 'grid',
                  gridTemplateColumns: gridTemplate,
                  background: bgColor,
                  boxShadow,
                  cursor: 'default',
                }}
                onMouseEnter={e => {
                  if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--bg-row-hover)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = bgColor
                }}
              >
                {/* Checkbox cell */}
                <div
                  className="flex items-center justify-center border-r border-[var(--border-row)]"
                  onClick={e => toggleCheck(row.original._flagKey, e)}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {/* controlled via onClick above */}}
                    className="w-3.5 h-3.5 accent-[var(--accent-blue)] cursor-pointer"
                  />
                </div>

                {/* Flag dot cell */}
                <div className="flex items-center justify-center border-r border-[var(--border-row)]">
                  {flag && (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: FLAG_COLORS[flag] }} />
                  )}
                </div>

                {/* Data cells */}
                {columnMeta
                  .filter(col => columnVisibility[col.id] !== false)
                  .map(col => {
                    const val = String(row.original[col.id] ?? '')
                    const isLevel = col.id === 'Level'
                    const levelColor = isLevel ? LEVEL_COLORS[val] : undefined
                    return (
                      <div
                        key={col.id}
                        className="flex items-center px-2 border-r border-[var(--border-row)] last:border-r-0 overflow-hidden"
                        style={{ minWidth: 0 }}
                      >
                        <span
                          className="truncate"
                          title={val}
                          style={levelColor ? { color: levelColor, fontWeight: 500 } : undefined}
                        >
                          {val}
                        </span>
                      </div>
                    )
                  })}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Right-click context menu ──────────────────────────────────────── */}
      {contextMenu && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 50,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            padding: '4px 0',
            minWidth: 160,
          }}
        >
          <div>
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>
              Flag row
            </div>
            {(['suspicious', 'reviewed', 'noteworthy'] as FlagType[]).map(f => (
              <button
                key={f}
                onClick={() => onSetFlag(f)}
                className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-[var(--bg-row-hover)]"
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: FLAG_COLORS[f], flexShrink: 0, display: 'inline-block' }} />
                <span style={{ color: FLAG_COLORS[f] }}>{FLAG_LABELS[f]}</span>
              </button>
            ))}
            {flags[contextMenu.flagKey] && (
              <>
                <div className="my-1 border-t" style={{ borderColor: 'var(--border)' }} />
                <button
                  onClick={() => onSetFlag(null)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-row-hover)]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Clear flag
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
