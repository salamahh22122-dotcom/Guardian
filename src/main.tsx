import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class StartupErrorBoundary extends React.Component<React.PropsWithChildren, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', background: '#020617', color: '#e2e8f0', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: 520, margin: '12vh auto', background: '#0f172a', border: '1px solid #334155', borderRadius: 20, padding: 24 }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>GuardKids gagal dimulai</h1>
          <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6 }}>Aplikasi mengalami error saat memuat halaman. Tutup dan buka kembali aplikasi setelah pembaruan.</p>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#fca5a5', fontSize: 11, overflowWrap: 'anywhere' }}>{this.state.error.message}</pre>
        </div>
      </div>
    );
  }
}

const root = document.getElementById('root');
if (!root) throw new Error('Elemen root GuardKids tidak ditemukan.');
createRoot(root).render(<StartupErrorBoundary><App /></StartupErrorBoundary>);
