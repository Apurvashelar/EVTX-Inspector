import { useState, useEffect } from 'react'
import { useAppStore, useActiveFile } from './store/useAppStore'
import { FileSidebar } from './components/FileSidebar'
import { EventTable } from './components/EventTable'
import { Toolbar } from './components/Toolbar'
import { FileDropzone } from './components/FileDropzone'

function useTheme() {
  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    const stored = localStorage.getItem('evtx-theme')
    if (stored === 'dark' || stored === 'light') return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('evtx-theme', theme)
  }, [theme])

  const toggleTheme = () => setThemeState(t => t === 'dark' ? 'light' : 'dark')
  return { theme, toggleTheme }
}

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const { isLoading, loadError } = useAppStore()
  const activeFile = useActiveFile()
  const hasActiveFile = !!activeFile

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* App header */}
      <header
        className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] flex-shrink-0"
        style={{ background: 'var(--bg-surface)' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--accent-blue)', flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8"/>
          <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
        <span className="font-semibold text-sm tracking-tight">EVTX Inspector</span>

        <div className="flex-1" />

        <span className="text-[10px] hidden sm:block" style={{ color: 'var(--text-muted)' }}>
          All processing is local — no data leaves your browser
        </span>

        {/* Dark / Light mode toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-1.5 rounded hover:bg-[var(--bg-row-hover)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors ml-2"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </header>

      {/* Body: sidebar + main */}
      <div className="flex flex-1 min-h-0">
        <FileSidebar />

        <div className="flex flex-col flex-1 min-h-0 min-w-0">
          {/* Load error banner */}
          {loadError && (
            <div
              className="flex items-center gap-2 px-4 py-1.5 text-xs flex-shrink-0"
              style={{
                background: 'rgba(248,81,73,0.1)',
                borderBottom: '1px solid rgba(248,81,73,0.3)',
                color: 'var(--flag-suspicious)',
              }}
            >
              <span>{loadError}</span>
              <button
                onClick={() => useAppStore.getState().setLoadError('')}
                className="ml-auto text-[var(--text-muted)] hover:text-[var(--flag-suspicious)]"
              >
                ×
              </button>
            </div>
          )}

          {/* Toolbar */}
          {(hasActiveFile || isLoading) && <Toolbar />}

          {/* Main content */}
          <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {isLoading ? (
              <LoadingOverlay />
            ) : hasActiveFile ? (
              <EventTable />
            ) : (
              <FileDropzone />
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

function LoadingOverlay() {
  const { loadProgress } = useAppStore()
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6">
      <div className="w-80 text-center">
        <div className="text-[var(--text-secondary)] mb-3 text-sm">Parsing file…</div>
        <div
          className="w-full rounded-full h-2 overflow-hidden"
          style={{ background: 'var(--bg-row)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-200"
            style={{ width: `${loadProgress}%`, background: 'var(--accent-blue)' }}
          />
        </div>
        <div className="text-[var(--text-muted)] text-xs mt-2">{loadProgress}%</div>
      </div>
    </div>
  )
}
