import { useCallback, useState, useEffect, useRef } from 'react'
import { useAppStore, useActiveFile, useFlagStore } from '../store/useAppStore'
import type { FlagType } from '../types'

const FLAG_COLORS: Record<FlagType, string> = {
  suspicious: 'var(--flag-suspicious)',
  reviewed: 'var(--flag-reviewed)',
  noteworthy: 'var(--flag-noteworthy)',
}

export function Toolbar() {
  const entry = useActiveFile()
  const {
    globalSearch, setGlobalSearch,
    clearAllFilters,
    toggleShowFlaggedOnly,
    setColumnVisibility,
    resetColumnVisibility,
    timeFrom, timeTo,
    setTimeRange, clearTimeRange,
    navigateToFlag,
  } = useAppStore()
  const { getFlags } = useFlagStore()

  const [showColumnsMenu, setShowColumnsMenu] = useState(false)
  const columnsMenuRef = useRef<HTMLDivElement>(null)

  // Local date buffers — only committed to store when user clicks OK
  const [localFrom, setLocalFrom] = useState(timeFrom)
  const [localTo, setLocalTo] = useState(timeTo)

  // Sync local state when the store clears the time range (e.g. "clear" or file switch)
  useEffect(() => { setLocalFrom(timeFrom) }, [timeFrom])
  useEffect(() => { setLocalTo(timeTo) }, [timeTo])

  const metadata = entry?.metadata
  const columnMeta = entry?.columns ?? []
  const columnFilters = entry?.columnFilters ?? {}
  const showFlaggedOnly = entry?.showFlaggedOnly ?? false
  const columnVisibility = entry?.columnVisibility ?? {}
  const fileHash = metadata?.hash ?? ''
  const flags = getFlags(fileHash)

  const activeFilterCount = Object.values(columnFilters).filter(Boolean).length
  const hasTimeFilter = !!(timeFrom || timeTo)

  const flagCounts = Object.values(flags).reduce<Record<FlagType, number>>(
    (acc, f) => { acc[f] = (acc[f] ?? 0) + 1; return acc },
    { suspicious: 0, reviewed: 0, noteworthy: 0 }
  )
  const totalFlagged = Object.values(flagCounts).reduce((a, b) => a + b, 0)

  // Close columns menu on outside click
  useEffect(() => {
    if (!showColumnsMenu) return
    const handler = (e: MouseEvent) => {
      if (columnsMenuRef.current && !columnsMenuRef.current.contains(e.target as Node)) {
        setShowColumnsMenu(false)
      }
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [showColumnsMenu])

  const exportFlagged = useCallback(() => {
    if (!metadata || columnMeta.length === 0) return
    const allRows = entry?.rows ?? []
    const flaggedRows = allRows.filter(r => !!flags[r._flagKey])
    if (flaggedRows.length === 0) return

    const headers = [...columnMeta.map(c => c.id), 'FlagType']
    const csvLines = [
      headers.join(','),
      ...flaggedRows.map(r => {
        const cells = columnMeta.map(c => {
          const val = String(r[c.id] ?? '').replace(/"/g, '""')
          return `"${val}"`
        })
        cells.push(`"${flags[r._flagKey]}"`)
        return cells.join(',')
      }),
    ]
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `flagged_${metadata.name.replace(/\.[^.]+$/, '')}.csv`
    a.click()
    // Defer revocation so the browser has time to initiate the download
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }, [metadata, columnMeta, entry?.rows, flags])

  if (!metadata) return null

  const dataColumns = columnMeta.filter(c => c.id !== '_flag')
  const hasAnyFilter = activeFilterCount > 0 || hasTimeFilter || !!globalSearch

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border)] select-none flex-shrink-0 flex-wrap min-w-0"
      style={{ background: 'var(--bg-surface)' }}
    >
      {/* Global search — most prominent control */}
      <div className="relative flex items-center flex-shrink-0" style={{ width: 260 }}>
        <svg
          width="13" height="13" viewBox="0 0 24 24" fill="none"
          className="absolute left-2.5 pointer-events-none"
          style={{ color: globalSearch ? 'var(--accent-blue)' : 'var(--text-muted)' }}
        >
          <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
          <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <input
          type="text"
          placeholder="Search all columns…"
          value={globalSearch}
          onChange={e => setGlobalSearch(e.target.value)}
          className="w-full h-7 pl-7 pr-6 text-xs rounded border outline-none transition-colors"
          style={{
            background: 'var(--bg-filter)',
            border: globalSearch ? '1px solid var(--accent-blue)' : '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--accent-blue)')}
          onBlur={e => (e.target.style.borderColor = globalSearch ? 'var(--accent-blue)' : 'var(--border)')}
        />
        {globalSearch && (
          <button
            onClick={() => setGlobalSearch('')}
            className="absolute right-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            style={{ lineHeight: 1 }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      <Sep />

      {/* Row count */}
      <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
          {metadata.totalRows.toLocaleString()}
        </span>{' '}events
      </span>

      {/* Active column filters */}
      {activeFilterCount > 0 && (
        <>
          <Sep />
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--accent-blue)' }}>
            {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''}
          </span>
          <button
            onClick={clearAllFilters}
            className="text-xs underline-offset-2 hover:underline flex-shrink-0"
            style={{ color: 'var(--text-muted)' }}
          >
            clear
          </button>
        </>
      )}

      {/* Flag chips — clickable, cycles through flagged rows */}
      {totalFlagged > 0 && (
        <>
          <Sep />
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {(['suspicious', 'reviewed', 'noteworthy'] as FlagType[]).map(f =>
              flagCounts[f] > 0 ? (
                <button
                  key={f}
                  onClick={() => navigateToFlag(f)}
                  title={`Click to jump to next ${f} row`}
                  className="flex items-center gap-1 text-xs rounded px-1.5 py-0.5 transition-colors hover:bg-[var(--bg-row-hover)]"
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: FLAG_COLORS[f], display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ color: FLAG_COLORS[f] }}>{flagCounts[f]}</span>
                </button>
              ) : null
            )}
          </div>
        </>
      )}

      {/* Time range filter */}
      <Sep />
      <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
        <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>From</span>
        <input
          type="datetime-local"
          value={localFrom}
          onChange={e => setLocalFrom(e.target.value)}
          className="h-6 px-1.5 text-xs rounded border outline-none"
          style={{
            background: 'var(--bg-filter)',
            border: timeFrom ? '1px solid var(--accent-blue)' : '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
            width: 158,
          }}
        />
        <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>To</span>
        <input
          type="datetime-local"
          value={localTo}
          onChange={e => setLocalTo(e.target.value)}
          className="h-6 px-1.5 text-xs rounded border outline-none"
          style={{
            background: 'var(--bg-filter)',
            border: timeTo ? '1px solid var(--accent-blue)' : '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
            width: 158,
          }}
        />
        <button
          onClick={() => setTimeRange(localFrom, localTo)}
          disabled={!localFrom && !localTo}
          className="h-6 px-2 text-xs rounded border transition-colors disabled:opacity-40"
          style={{
            borderColor: (localFrom || localTo) ? 'var(--accent-blue)' : 'var(--border)',
            color: (localFrom || localTo) ? 'var(--accent-blue)' : 'var(--text-muted)',
            background: 'transparent',
          }}
        >
          OK
        </button>
        {hasTimeFilter && (
          <button
            onClick={() => { setLocalFrom(''); setLocalTo(''); clearTimeRange() }}
            className="text-xs underline-offset-2 hover:underline"
            style={{ color: 'var(--text-muted)' }}
          >
            clear
          </button>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1 min-w-0" />

      {/* Right-side controls */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Clear all filters shortcut */}
        {hasAnyFilter && (
          <button
            onClick={() => { clearAllFilters(); setGlobalSearch(''); clearTimeRange() }}
            className="text-xs px-2 py-1 rounded border transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            title="Clear all filters"
          >
            Clear all
          </button>
        )}

        {/* Columns visibility */}
        <div className="relative" ref={columnsMenuRef}>
          <button
            onClick={() => setShowColumnsMenu(v => !v)}
            className="text-xs px-2.5 py-1 rounded border transition-colors flex items-center gap-1"
            style={{
              borderColor: showColumnsMenu ? 'var(--accent-blue)' : 'var(--border)',
              color: showColumnsMenu ? 'var(--accent-blue)' : 'var(--text-secondary)',
              background: showColumnsMenu ? 'rgba(88,166,255,0.08)' : 'transparent',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Columns
          </button>

          {showColumnsMenu && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 40,
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', minWidth: 180, padding: '4px 0',
            }}>
              <div className="flex items-center justify-between px-3 py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>Columns</span>
                <button onClick={resetColumnVisibility} className="text-[10px] underline-offset-1 hover:underline" style={{ color: 'var(--accent-blue)' }}>Reset</button>
              </div>
              {dataColumns.map(col => {
                const visible = columnVisibility[col.id] !== false
                return (
                  <label key={col.id} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-[var(--bg-row-hover)]">
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={e => setColumnVisibility(col.id, e.target.checked)}
                      className="w-3.5 h-3.5 accent-[var(--accent-blue)]"
                    />
                    <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{col.label}</span>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {totalFlagged > 0 && (
          <button
            onClick={toggleShowFlaggedOnly}
            className="text-xs px-2.5 py-1 rounded border transition-colors"
            style={{
              borderColor: showFlaggedOnly ? 'var(--accent-blue)' : 'var(--border)',
              color: showFlaggedOnly ? 'var(--accent-blue)' : 'var(--text-secondary)',
              background: showFlaggedOnly ? 'rgba(88,166,255,0.1)' : 'transparent',
            }}
          >
            {showFlaggedOnly ? 'All events' : 'Flagged only'}
          </button>
        )}

        {totalFlagged > 0 && (
          <button
            onClick={exportFlagged}
            className="text-xs px-2.5 py-1 rounded border transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--flag-reviewed)'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--flag-reviewed)'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'
            }}
          >
            Export flagged
          </button>
        )}
      </div>
    </div>
  )
}

function Sep() {
  return <div className="h-4 w-px flex-shrink-0" style={{ background: 'var(--border)' }} />
}
