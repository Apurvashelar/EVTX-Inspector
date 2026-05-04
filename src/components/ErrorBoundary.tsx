import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', gap: 16,
          fontFamily: 'ui-monospace, monospace',
          background: '#0d1117', color: '#e6edf3',
        }}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ color: '#f85149' }}>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
          <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="12" cy="16" r="1" fill="currentColor"/>
        </svg>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#f85149', margin: 0 }}>
          An unexpected error occurred
        </p>
        <pre style={{ fontSize: 11, color: '#8b949e', maxWidth: 540, whiteSpace: 'pre-wrap', textAlign: 'center', margin: 0 }}>
          {error.message}
        </pre>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 8, padding: '7px 18px',
            background: '#21262d', border: '1px solid #30363d',
            color: '#e6edf3', borderRadius: 6, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12,
          }}
        >
          Reload
        </button>
      </div>
    )
  }
}
