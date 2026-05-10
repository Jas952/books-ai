import React, { useState, useEffect } from 'react';
import { Type, SquareDashed, List, Moon, Sun, RefreshCw } from 'lucide-react';
import TocPanel from './TocPanel';

const electron = typeof window !== 'undefined' && window.require ? window.require('electron') : null;
const ipcRenderer = electron ? electron.ipcRenderer : null;

export default function Toolbar({ toolMode, setToolMode, tocOpen, setTocOpen, pdfDocument, onTocNavigate, theme, toggleTheme }) {
  const [appVersion, setAppVersion] = useState('');
  const [updateStatus, setUpdateStatus] = useState(null);

  useEffect(() => {
    if (!ipcRenderer) {
      setAppVersion(__APP_VERSION__ || 'dev');
      return;
    }
    ipcRenderer.invoke('get-app-version').then(v => setAppVersion(v));
    ipcRenderer.on('update-status', (_event, msg) => setUpdateStatus(msg));
    return () => ipcRenderer.removeAllListeners('update-status');
  }, []);

  return (
    <div style={{
      width: tocOpen ? '260px' : '48px',
      height: '100%',
      backgroundColor: 'var(--color-bg)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      transition: 'width 0.2s ease',
      overflow: 'hidden'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: tocOpen ? 'row' : 'column',
        alignItems: 'center',
        padding: tocOpen ? '8px 12px' : '16px 0 8px 0',
        gap: tocOpen ? '4px' : '12px',
        borderBottom: tocOpen ? '1px solid var(--color-border)' : 'none',
        flexShrink: 0
      }}>
        <button
          className="button-icon"
          style={{
            backgroundColor: toolMode === 'text' ? 'var(--color-surface)' : 'transparent',
            color: toolMode === 'text' ? 'var(--color-go-blue)' : 'var(--color-text-light)',
            padding: '8px'
          }}
          onClick={() => setToolMode('text')}
          title="Text Selection"
        >
          <Type size={20} />
        </button>

        <button
          className="button-icon"
          style={{
            backgroundColor: toolMode === 'area' ? 'var(--color-surface)' : 'transparent',
            color: toolMode === 'area' ? 'var(--color-go-blue)' : 'var(--color-text-light)',
            padding: '8px'
          }}
          onClick={() => setToolMode('area')}
          title="Area Selection"
        >
          <SquareDashed size={20} />
        </button>

        <div style={{
          width: tocOpen ? '1px' : '24px',
          height: tocOpen ? '24px' : '1px',
          backgroundColor: 'var(--color-border)',
          flexShrink: 0
        }} />

        <button
          className="button-icon"
          style={{
            backgroundColor: tocOpen ? 'var(--color-go-blue-light)' : 'transparent',
            color: tocOpen ? 'var(--color-go-blue)' : 'var(--color-text-light)',
            padding: '8px'
          }}
          onClick={() => setTocOpen(!tocOpen)}
          title="Table of Contents"
        >
          <List size={20} />
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {tocOpen && pdfDocument && (
          <TocPanel pdfDocument={pdfDocument} onNavigate={onTocNavigate} />
        )}
      </div>

      <div style={{
        padding: tocOpen ? '12px' : '12px 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        borderTop: '1px solid var(--color-border)'
      }}>
        {updateStatus && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '10px',
            color: 'var(--color-go-blue)',
            textAlign: 'center',
            padding: '0 4px',
            lineHeight: '1.3'
          }}>
            <RefreshCw size={12} style={{ flexShrink: 0, animation: 'spin 2s linear infinite' }} />
            {tocOpen && <span>{updateStatus}</span>}
          </div>
        )}

        <button
          className="button-icon"
          style={{ padding: '8px' }}
          onClick={toggleTheme}
          title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {appVersion && (
          <span style={{
            fontSize: '10px',
            color: 'var(--color-text-light)',
            opacity: 0.6,
            userSelect: 'none'
          }}>
            v{appVersion}
          </span>
        )}
      </div>
    </div>
  );
}
