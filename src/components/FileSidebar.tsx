import { useRef, useCallback } from 'react'
import { useAppStore, useFlagStore, loadFile } from '../store/useAppStore'
import { SAMPLE_FILE_ENTRY } from '../data/sampleData'
import type { FlagType } from '../types'

const FLAG_COLORS: Record<FlagType, string> = {
  suspicious: 'var(--flag-suspicious)',
  reviewed: 'var(--flag-reviewed)',
  noteworthy: 'var(--flag-noteworthy)',
}

export function FileSidebar() {
  const { files, activeFileId, sidebarCollapsed, switchFile, removeFile, toggleSidebar } = useAppStore()
  const { getFlags } = useFlagStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    const ext = file.name.toLowerCase().split('.').pop()
    if (ext !== 'evtx' && ext !== 'csv') {
      useAppStore.getState().setLoadError('Unsupported file type. Please drop an .evtx or .csv file.')
      return
    }
    loadFile(file)
  }, [])

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }, [handleFile])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onDragOver = useCallback((e: React.DragEvent) => e.preventDefault(), [])

  const fileEntries = Object.values(files).filter(f => f.metadata.type !== 'sample')

  if (sidebarCollapsed) {
    return (
      <div
        className="flex flex-col items-center py-2 gap-2 border-r border-[var(--border)] flex-shrink-0"
        style={{ width: 40, background: 'var(--bg-sidebar)' }}
      >
        {/* Expand button */}
        <button
          onClick={toggleSidebar}
          title="Expand sidebar"
          className="p-1.5 rounded hover:bg-[var(--bg-sidebar-item-hover)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {/* Load file button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Load file"
          className="p-1.5 rounded hover:bg-[var(--bg-sidebar-item-hover)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {/* File indicators */}
        {fileEntries.map(f => (
          <button
            key={f.id}
            onClick={() => switchFile(f.id)}
            title={f.metadata.name}
            className="w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold transition-colors"
            style={{
              background: activeFileId === f.id
                ? 'var(--bg-sidebar-item-active)'
                : 'var(--bg-sidebar-item-hover)',
              color: f.metadata.type === 'evtx'
                ? 'var(--accent-blue)'
                : 'var(--flag-reviewed)',
            }}
          >
            {f.metadata.type.toUpperCase().slice(0, 1)}
          </button>
        ))}
        {activeFileId === '__sample__' && (
          <div
            className="w-6 h-6 rounded flex items-center justify-center text-[8px] font-bold"
            style={{ background: 'var(--sample-banner-bg)', color: 'var(--flag-noteworthy)' }}
            title="Sample data active"
          >
            S
          </div>
        )}
        <input ref={fileInputRef} type="file" accept=".evtx,.csv" className="hidden" onChange={onInputChange} />
      </div>
    )
  }

  return (
    <div
      className="flex flex-col border-r border-[var(--border)] flex-shrink-0 min-h-0"
      style={{ width: 220, background: 'var(--bg-sidebar)' }}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] flex-shrink-0"
        style={{ background: 'var(--bg-surface)' }}
      >
        <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Files</span>
        <div className="flex items-center gap-1">
          {/* Load file button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Load file (.evtx or .csv)"
            className="p-1 rounded hover:bg-[var(--bg-sidebar-item-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {/* Collapse button */}
          <button
            onClick={toggleSidebar}
            title="Collapse sidebar"
            className="p-1 rounded hover:bg-[var(--bg-sidebar-item-hover)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto py-1">
        {/* Sample entry — always available */}
        <SidebarItem
          id="__sample__"
          name="sample_security_events.evtx"
          type="sample"
          rowCount={SAMPLE_FILE_ENTRY.metadata.totalRows}
          flags={getFlags('__sample__')}
          isActive={activeFileId === '__sample__'}
          onSelect={() => switchFile('__sample__')}
          onRemove={null}
        />

        {fileEntries.map(f => (
          <SidebarItem
            key={f.id}
            id={f.id}
            name={f.metadata.name}
            type={f.metadata.type}
            rowCount={f.metadata.totalRows}
            flags={getFlags(f.metadata.hash)}
            isActive={activeFileId === f.id}
            onSelect={() => switchFile(f.id)}
            onRemove={() => removeFile(f.id)}
          />
        ))}

        {fileEntries.length === 0 && (
          <div className="px-3 py-6 text-center text-[11px] text-[var(--text-muted)]">
            No files loaded.<br />Click + or drop a file here.
          </div>
        )}
      </div>

      {/* Drop hint at bottom */}
      <div
        className="flex-shrink-0 border-t border-[var(--border)] px-3 py-2 text-[10px] text-[var(--text-muted)] text-center"
        style={{ background: 'var(--bg-surface)' }}
      >
        Drop .evtx or .csv anywhere
      </div>

      <input ref={fileInputRef} type="file" accept=".evtx,.csv" className="hidden" onChange={onInputChange} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Individual sidebar item
// ---------------------------------------------------------------------------

interface SidebarItemProps {
  id: string
  name: string
  type: string
  rowCount: number
  flags: Record<string, string>
  isActive: boolean
  onSelect: () => void
  onRemove: (() => void) | null
}

function SidebarItem({ name, type, rowCount, flags, isActive, onSelect, onRemove }: SidebarItemProps) {
  const flagCounts = Object.values(flags).reduce<Record<string, number>>(
    (acc, f) => { acc[f] = (acc[f] ?? 0) + 1; return acc },
    {}
  )
  const totalFlagged = Object.values(flagCounts).reduce((a, b) => a + b, 0)

  const isSampleType = type === 'sample'
  const badgeColor = isSampleType
    ? { bg: 'var(--sample-banner-bg)', text: 'var(--flag-noteworthy)' }
    : type === 'evtx'
      ? { bg: 'rgba(88,166,255,0.15)', text: 'var(--accent-blue)' }
      : { bg: 'rgba(63,185,80,0.15)', text: 'var(--flag-reviewed)' }

  const truncName = name.length > 22 ? name.slice(0, 19) + '…' : name

  return (
    <div
      onClick={onSelect}
      className="group relative flex flex-col gap-0.5 px-2.5 py-2 cursor-pointer transition-colors"
      style={{
        background: isActive ? 'var(--bg-sidebar-item-active)' : 'transparent',
        borderLeft: isActive ? '2px solid var(--accent-blue)' : '2px solid transparent',
      }}
      onMouseEnter={e => {
        if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-sidebar-item-hover)'
      }}
      onMouseLeave={e => {
        if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
    >
      {/* File type badge + name */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className="text-[9px] font-bold uppercase px-1 py-0.5 rounded flex-shrink-0"
          style={{ background: badgeColor.bg, color: badgeColor.text }}
        >
          {isSampleType ? 'SMPL' : type.toUpperCase()}
        </span>
        <span
          className="text-[11px] text-[var(--text-primary)] truncate flex-1 min-w-0"
          title={name}
        >
          {truncName}
        </span>
        {/* Remove button */}
        {onRemove && (
          <button
            onClick={e => { e.stopPropagation(); onRemove() }}
            className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--flag-suspicious)] transition-all flex-shrink-0 ml-1"
            title="Remove file"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* Row count + flag summary */}
      <div className="flex items-center gap-1.5 pl-0.5">
        <span className="text-[10px] text-[var(--text-muted)]">
          {rowCount.toLocaleString()} events
        </span>
        {totalFlagged > 0 && (
          <>
            <span className="text-[var(--border)] text-[10px]">·</span>
            <div className="flex items-center gap-1">
              {(['suspicious', 'reviewed', 'noteworthy'] as FlagType[]).map(f =>
                flagCounts[f] ? (
                  <span key={f} className="flex items-center gap-0.5">
                    <span
                      style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: FLAG_COLORS[f], display: 'inline-block' }}
                    />
                    <span className="text-[10px]" style={{ color: FLAG_COLORS[f] }}>{flagCounts[f]}</span>
                  </span>
                ) : null
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
