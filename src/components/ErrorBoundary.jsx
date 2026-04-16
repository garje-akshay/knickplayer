import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('KnickPlayer Error Boundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', background: '#2b2b2b',
          color: '#ccc', fontFamily: 'sans-serif', gap: 16,
        }}>
          <div style={{ fontSize: 48 }}>&#9888;</div>
          <h2 style={{ margin: 0, color: '#6C5CE7' }}>Something went wrong</h2>
          <p style={{ maxWidth: 400, textAlign: 'center', lineHeight: 1.5, fontSize: 13 }}>
            KnickPlayer encountered an unexpected error. Try refreshing the page.
          </p>
          <pre style={{
            background: '#1a1a1a', padding: '10px 16px', borderRadius: 4,
            fontSize: 11, maxWidth: 500, overflow: 'auto', color: '#e57373',
          }}>
            {this.state.error?.message || 'Unknown error'}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 24px', background: 'linear-gradient(135deg, #6C5CE7, #00CEFF)', color: '#fff',
              border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13,
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
