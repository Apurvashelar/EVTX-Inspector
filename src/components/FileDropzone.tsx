import { useCallback, useState } from 'react'
import { loadFile, useAppStore } from '../store/useAppStore'

export function FileDropzone() {
  const [isDragging, setIsDragging] = useState(false)
  const { loadError } = useAppStore()

  const handleFile = useCallback((file: File) => {
    const ext = file.name.toLowerCase().split('.').pop()
    if (ext !== 'evtx' && ext !== 'csv') {
      useAppStore.getState().setLoadError('Unsupported file type. Please load an .evtx or .csv file.')
      return
    }
    loadFile(file)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback(() => setIsDragging(false), [])

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }, [handleFile])

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <label
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className="flex flex-col items-center justify-center w-[480px] h-64 rounded-xl cursor-pointer transition-colors duration-150"
        style={{
          border: isDragging
            ? '2px dashed var(--accent-blue)'
            : '2px dashed var(--border)',
          background: isDragging
            ? 'rgba(88,166,255,0.06)'
            : 'transparent',
        }}
        onMouseEnter={e => {
          if (!isDragging) (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)'
        }}
        onMouseLeave={e => {
          if (!isDragging) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
        }}
      >
        <input
          type="file"
          accept=".evtx,.csv"
          className="hidden"
          onChange={onInputChange}
        />
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
          className="mb-4 opacity-40"
          style={{ color: 'var(--text-primary)' }}
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="14 2 14 8 20 8"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="12" y1="12" x2="12" y2="18"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <polyline points="9 15 12 12 15 15"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Drop a file here</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>or click to browse</p>
        <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>Supports .evtx and .csv</p>
      </label>

      {loadError && (
        <div
          className="w-[480px] rounded-lg px-4 py-3 text-sm"
          style={{
            border: '1px solid var(--flag-suspicious)',
            background: 'rgba(248,81,73,0.08)',
            color: 'var(--flag-suspicious)',
          }}
        >
          {loadError}
        </div>
      )}

      <p className="text-xs text-center max-w-sm" style={{ color: 'var(--text-muted)' }}>
        All processing happens in your browser. No data is transmitted to any server.
      </p>
    </div>
  )
}
