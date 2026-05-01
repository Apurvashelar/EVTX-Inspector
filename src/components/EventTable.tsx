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
const SELECT_COL_W = 28

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

// Comma-separated terms are OR'd: "4624, 4625" matches either value
const substringFilter: FilterFn<DataRow> = (row, columnId, filterValue: string) => {
  if (!filterValue) return true
  const val = String(row.getValue(columnId) ?? '').toLowerCase()
  const terms = filterValue.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
  return terms.length === 0 || terms.some(t => val.includes(t))
}

interface ContextMenu {
  x: number
  y: number
  flagKey: string
  colId?: string
  colVal?: string
}

function normalizeTs(ts: string): string {
  return ts.replace(' ', 'T').replace('Z', '').replace(' UTC', '').substring(0, 19)
}

export function EventTable() {
  const entry = useActiveFile()
  const { setColumnFilter, timeFrom, timeTo, globalSearch, flagNavRequest } = useAppStore()
  const { getFlags, setFlag } = useFlagStore()

  const containerRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null)
  const [flashIndex, setFlashIndex] = useState<number | null>(null)
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set())
  const selectAllRef = useRef<HTMLInputElement>(null)
  const flagNavIndexRef = useRef<Record<FlagType, number>>({ suspicious: -1, reviewed: -1, noteworthy: -1 })
  const prevFlagNavRef = useRef<typeof flagNavRequest>(null)

  // Column drag-and-drop state
  const [dragCol, setDragCol] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  const rawColumns = entry?.columns ?? []
  const columnOrderIds = entry?.columnOrder
  const rows = entry?.rows ?? []
  const columnFilters = entry?.columnFilters ?? {}
  const showFlaggedOnly = entry?.showFlaggedOnly ?? false
  const columnVisibility = entry?.columnVisibility ?? {}
  const columnWidths = entry?.columnWidths ?? {}
  const fileHash = entry?.metadata.hash ?? ''
  const flags = getFlags(fileHash)

  // Apply user-defined column order; unknown IDs fall to the end
  const columnMeta = useMemo(() => {
    if (!columnOrderIds?.length) return rawColumns
    const orderMap = new Map(columnOrderIds.map((id, i) => [id, i]))
    return [...rawColumns].sort((a, b) => (orderMap.get(a.id) ?? Infinity) - (orderMap.get(b.id) ?? Infinity))
  }, [rawColumns, columnOrderIds])

  useEffect(() => {
    setCheckedKeys(new Set())
    setSelectedRowKey(null)
  }, [fileHash])

  // TanStack table: _flag col is internal only, never rendered in the grid
  const tableCols = useMemo<ColumnDef<DataRow>[]>(() => [
    { id: '_flag', header: '', size: 0, enableColumnFilter: false, cell: () => null },
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
      columnMeta.some(col => String(r.original[col.id] ?? '').toLowerCase().includes(q))
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

  // Visible data columns — _flag excluded from the rendered grid
  const visibleCols = useMemo(() =>
    tableCols.filter(c => c.id !== '_flag' && columnVisibility[String(c.id)] !== false),
    [tableCols, columnVisibility]
  )

  const gridTemplate = useMemo(
    () => `${SELECT_COL_W}px ${visibleCols.map(c => {
      const id = String(c.id)
      const meta = columnMeta.find(m => m.id === id)
      return `${columnWidths[id] ?? meta?.width ?? 160}px`
    }).join(' ')}`,
    [visibleCols, columnMeta, columnWidths]
  )

  const totalColumnWidth = useMemo(
    () => SELECT_COL_W + visibleCols.reduce((sum, c) => {
      const id = String(c.id)
      const meta = columnMeta.find(m => m.id === id)
      return sum + (columnWidths[id] ?? meta?.width ?? 160)
    }, 0),
    [visibleCols, columnMeta, columnWidths]
  )

  // Keep select-all indeterminate state in sync
  useEffect(() => {
    if (!selectAllRef.current) return
    const total = filteredRows.length
    const checked = filteredRows.filter(r => checkedKeys.has(r.original._flagKey)).length
    selectAllRef.current.indeterminate = checked > 0 && checked < total
  }, [checkedKeys, filteredRows])

  // Sync header horizontal scroll with rows container
  const syncHeaderScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (headerRef.current) headerRef.current.scrollLeft = e.currentTarget.scrollLeft
  }, [])

  // Column resize
  const [resizingCol, setResizingCol] = useState<string | null>(null)
  const startResize = useCallback((colId: string, startX: number, startWidth: number) => {
    setResizingCol(colId)
    const onMouseMove = (e: MouseEvent) => {
      useAppStore.getState().setColumnWidth(colId, Math.max(40, startWidth + e.clientX - startX))
    }
    const onMouseUp = () => {
      setResizingCol(null)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [])

  // Column drag-and-drop reordering
  const handleDragStart = useCallback((e: React.DragEvent, colId: string) => {
    // Don't initiate a column drag when the user is grabbing the resize handle
    if ((e.target as HTMLElement).classList.contains('col-resize-handle')) {
      e.preventDefault()
      return
    }
    e.dataTransfer.effectAllowed = 'move'
    setDragCol(colId)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, colId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCol(colId)
  }, [])

  const handleDrop = useCallback((targetColId: string) => {
    if (!dragCol || dragCol === targetColId) { setDragOverCol(null); return }
    const ids = columnMeta.map(c => c.id)
    const from = ids.indexOf(dragCol)
    const to = ids.indexOf(targetColId)
    if (from === -1 || to === -1) return
    const next = [...ids]
    next.splice(from, 1)
    next.splice(to, 0, dragCol)
    useAppStore.getState().setColumnOrder(next)
    setDragCol(null)
    setDragOverCol(null)
  }, [dragCol, columnMeta])

  const handleDragEnd = useCallback(() => {
    setDragCol(null)
    setDragOverCol(null)
  }, [])

  // Flag navigation
  useEffect(() => {
    if (!flagNavRequest || prevFlagNavRef.current?.seq === flagNavRequest.seq) return
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

  // Right-click: row-level (checkbox area) — flag menu only
  const onRightClick = useCallback((e: React.MouseEvent, row: TRow<DataRow>) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, flagKey: row.original._flagKey })
  }, [])

  // Right-click: cell-level — flag menu + add-to-filter
  const onCellRightClick = useCallback((
    e: React.MouseEvent,
    row: TRow<DataRow>,
    colId: string,
    colVal: string,
  ) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, flagKey: row.original._flagKey, colId, colVal })
  }, [])

  const onSetFlag = useCallback((flag: FlagType | null) => {
    if (!contextMenu) return
    setFlag(fileHash, contextMenu.flagKey, flag)
    setContextMenu(null)
  }, [contextMenu, fileHash, setFlag])

  // Append to column filter with OR; deduplicates existing terms
  const onAddToFilter = useCallback((colId: string, colVal: string) => {
    const existing = (entry?.columnFilters ?? {})[colId] ?? ''
    const terms = existing.split(',').map(t => t.trim()).filter(Boolean)
    if (!terms.includes(colVal.trim())) {
      setColumnFilter(colId, [...terms, colVal.trim()].join(', '))
    }
    setContextMenu(null)
  }, [entry?.columnFilters, setColumnFilter])

  useEffect(() => {
    if (!contextMenu) return
    const handler = () => setContextMenu(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [contextMenu])

  // Checkbox helpers
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
    setCheckedKeys(e.target.checked
      ? new Set(filteredRows.map(r => r.original._flagKey))
      : new Set()
    )
  }, [filteredRows])

  const flagSelected = useCallback((flag: FlagType | null) => {
    checkedKeys.forEach(key => setFlag(fileHash, key, flag))
    setCheckedKeys(new Set())
  }, [checkedKeys, fileHash, setFlag])

  if (columnMeta.length === 0) return null

  const headerGroups = table.getHeaderGroups()

  return (
    <div className="flex flex-col flex-1 min-h-0 font-mono text-xs select-none">

      {/* ── Batch action bar ─────────────────────────────────────────────── */}
      {checkedKeys.size > 0 && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 border-b flex-shrink-0 flex-wrap"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
        >
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
            {checkedKeys.size} row{checkedKeys.size !== 1 ? 's' : ''} selected
          </span>
          <div className="h-3.5 w-px" style={{ background: 'var(--border)' }} />
          <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>Flag as</span>
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
            className="px-2 py-0.5 rounded border text-xs"
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

      {/* ── Sticky header — overflow hidden via CSS class (no visible scrollbar) */}
      <div
        ref={headerRef}
        className="flex-shrink-0 header-scroll"
        style={{ background: 'var(--bg-header)' }}
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
                    title="Select / deselect all visible rows"
                    className="w-3.5 h-3.5 accent-[var(--accent-blue)] cursor-pointer"
                  />
                </div>

                {/* Data column headers — _flag excluded; draggable for reordering */}
                {hg.headers
                  .filter(h => h.column.id !== '_flag' && columnVisibility[h.column.id] !== false)
                  .map(header => {
                    const colId = header.column.id
                    const col = columnMeta.find(c => c.id === colId)
                    const colWidth = columnWidths[colId] ?? col?.width ?? 160
                    const isDragging = dragCol === colId
                    const isDropTarget = dragOverCol === colId && dragCol !== colId
                    return (
                      <div
                        key={header.id}
                        draggable
                        onDragStart={e => handleDragStart(e, colId)}
                        onDragOver={e => handleDragOver(e, colId)}
                        onDrop={() => handleDrop(colId)}
                        onDragEnd={handleDragEnd}
                        onDragLeave={() => setDragOverCol(null)}
                        className="relative px-2 py-1.5 font-bold text-[11px] uppercase tracking-wide truncate border-r border-[var(--border)] last:border-r-0"
                        style={{
                          minWidth: 0,
                          color: 'var(--text-primary)',
                          cursor: isDragging ? 'grabbing' : 'grab',
                          opacity: isDragging ? 0.4 : 1,
                          boxShadow: isDropTarget ? 'inset 2px 0 0 var(--accent-blue)' : undefined,
                        }}
                      >
                        {String(header.column.columnDef.header ?? '')}
                        <div
                          className={`col-resize-handle ${resizingCol === colId ? 'resizing' : ''}`}
                          onMouseDown={e => { e.preventDefault(); startResize(colId, e.clientX, colWidth) }}
                        />
                      </div>
                    )
                  })}
              </div>

              {/* Filter input row */}
              <div
                className="border-b-2 border-[var(--border)]"
                style={{ display: 'grid', gridTemplateColumns: gridTemplate }}
              >
                <div className="border-r border-[var(--border)] h-7" />
                {hg.headers
                  .filter(h => h.column.id !== '_flag' && columnVisibility[h.column.id] !== false)
                  .map(header => (
                    <div key={header.id + '_f'} className="border-r border-[var(--border)] last:border-r-0">
                      <input
                        type="text"
                        placeholder="filter…"
                        value={columnFilters[header.column.id] ?? ''}
                        onChange={e => setColumnFilter(header.column.id, e.target.value)}
                        title="Type a value to filter. Use commas for OR: 4624, 4625"
                        className="w-full h-7 px-2 text-xs outline-none transition-colors"
                        style={{
                          background: 'var(--bg-filter)',
                          color: 'var(--text-primary)',
                          fontFamily: 'inherit',
                        }}
                        onFocus={e => (e.target.style.background = 'var(--bg-filter-focus)')}
                        onBlur={e => (e.target.style.background = 'var(--bg-filter)')}
                      />
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
                : virtualRow.index % 2 === 0 ? 'var(--bg-row)' : 'var(--bg-row-alt)'

            const shadowColor = isSelected ? 'var(--accent-blue)' : flag ? FLAG_COLORS[flag] : null
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
                {/* Checkbox + flag dot — combined into one cell */}
                <div
                  className="flex items-center justify-center gap-1 border-r border-[var(--border-row)]"
                  onClick={e => toggleCheck(row.original._flagKey, e)}
                >
                  {flag && (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: FLAG_COLORS[flag], flexShrink: 0 }} />
                  )}
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {/* controlled via parent onClick */}}
                    className="w-3.5 h-3.5 accent-[var(--accent-blue)] cursor-pointer"
                  />
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
                        onContextMenu={e => onCellRightClick(e, row, col.id, val)}
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
          {/* Filter by cell value — only shown when right-clicking a data cell */}
          {contextMenu.colId && contextMenu.colVal && (
            <>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>
                Filter
              </div>
              <button
                onClick={() => onAddToFilter(contextMenu.colId!, contextMenu.colVal!)}
                className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-[var(--bg-row-hover)]"
                style={{ color: 'var(--text-primary)' }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, color: 'var(--accent-blue)' }}>
                  <path d="M22 3H2l8 9.46V19l4 2V12.46L22 3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="truncate" title={contextMenu.colVal}>
                  Add "{contextMenu.colVal.length > 22 ? contextMenu.colVal.slice(0, 22) + '…' : contextMenu.colVal}"
                </span>
              </button>
              <div className="my-1 border-t" style={{ borderColor: 'var(--border)' }} />
            </>
          )}

          {/* Flag row */}
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
      )}
    </div>
  )
}
