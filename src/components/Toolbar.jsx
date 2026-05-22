import React, { useState, useEffect } from 'react';
import { Type, SquareDashed, List, Moon, Sun, RefreshCw, ChevronUp, ChevronDown, LayoutGrid, Settings } from 'lucide-react';
import TocPanel from './TocPanel';
import ThumbnailPanel from './ThumbnailPanel';
import SettingsModal from './SettingsModal';

const electron = typeof window !== 'undefined' && window.require ? window.require('electron') : null;
const ipcRenderer = electron ? electron.ipcRenderer : null;

export default function Toolbar({
  toolMode, setToolMode,
  tocOpen, setTocOpen,
  thumbnailsOpen, setThumbnailsOpen,
  pdfDocument,
  onTocNavigate,
  onPageNavigate,
  currentPage,
  numPages,
  theme, toggleTheme,
  settings, onSettingsChange
}) {
  const [appVersion, setAppVersion] = useState('');
  const [updateStatus, setUpdateStatus] = useState(null);
  const [pageInput, setPageInput] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const panelOpen = tocOpen || thumbnailsOpen;

  useEffect(() => {
    if (!ipcRenderer) {
      setAppVersion(__APP_VERSION__ || 'dev');
      return;
    }
    ipcRenderer.invoke('get-app-version').then(v => setAppVersion(v));
    ipcRenderer.on('update-status', (_event, msg) => setUpdateStatus(msg));
    return () => ipcRenderer.removeAllListeners('update-status');
  }, []);

  // Sync page input display with current page
  useEffect(() => {
    if (currentPage) {
      setPageInput(String(currentPage));
    }
  }, [currentPage]);

  const handlePageInputSubmit = () => {
    const num = parseInt(pageInput, 10);
    if (num >= 1 && num <= numPages && onPageNavigate) {
      onPageNavigate(num);
    }
  };

  const handlePageUp = () => {
    if (currentPage > 1 && onPageNavigate) {
      onPageNavigate(currentPage - 1);
    }
  };

  const handlePageDown = () => {
    if (currentPage < numPages && onPageNavigate) {
      onPageNavigate(currentPage + 1);
    }
  };

  const handleTocToggle = () => {
    if (tocOpen) {
      setTocOpen(false);
    } else {
      setTocOpen(true);
      setThumbnailsOpen(false);
    }
  };

  const handleThumbnailsToggle = () => {
    if (thumbnailsOpen) {
      setThumbnailsOpen(false);
    } else {
      setThumbnailsOpen(true);
      setTocOpen(false);
    }
  };

  return (
    <div style={{
      width: panelOpen ? '260px' : '48px',
      height: '100%',
      backgroundColor: 'var(--color-bg)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      transition: 'width 0.2s ease',
      overflow: 'hidden'
    }}>
      {/* Top buttons row */}
      <div style={{
        display: 'flex',
        flexDirection: panelOpen ? 'row' : 'column',
        alignItems: 'center',
        padding: panelOpen ? '8px 12px' : '16px 0 8px 0',
        gap: panelOpen ? '4px' : '12px',
        borderBottom: panelOpen ? '1px solid var(--color-border)' : 'none',
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
          width: panelOpen ? '1px' : '24px',
          height: panelOpen ? '24px' : '1px',
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
          onClick={handleTocToggle}
          title="Table of Contents"
        >
          <List size={20} />
        </button>

        <button
          className="button-icon"
          style={{
            backgroundColor: thumbnailsOpen ? 'var(--color-go-blue-light)' : 'transparent',
            color: thumbnailsOpen ? 'var(--color-go-blue)' : 'var(--color-text-light)',
            padding: '8px'
          }}
          onClick={handleThumbnailsToggle}
          title="Page Thumbnails"
        >
          <LayoutGrid size={20} />
        </button>
      </div>

      {/* Page Navigation */}
      {numPages > 0 && (
        <div className={`page-nav-section ${panelOpen ? 'expanded' : ''}`}
          style={{ borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}
        >
          <button
            className="button-icon"
            style={{ padding: '4px' }}
            onClick={handlePageUp}
            disabled={currentPage <= 1}
            title="Previous Page"
          >
            <ChevronUp size={16} />
          </button>

          <input
            type="number"
            className="page-nav-input"
            value={pageInput}
            onChange={e => setPageInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handlePageInputSubmit(); }}
            onBlur={handlePageInputSubmit}
            min={1}
            max={numPages}
            title="Go to page"
          />

          <span className="page-nav-label">{numPages}</span>

          <button
            className="button-icon"
            style={{ padding: '4px' }}
            onClick={handlePageDown}
            disabled={currentPage >= numPages}
            title="Next Page"
          >
            <ChevronDown size={16} />
          </button>
        </div>
      )}

      {/* Panel content — TOC or Thumbnails */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {tocOpen && pdfDocument && (
          <TocPanel pdfDocument={pdfDocument} onNavigate={onTocNavigate} />
        )}
        {thumbnailsOpen && pdfDocument && (
          <ThumbnailPanel
            pdfDocument={pdfDocument}
            currentPage={currentPage}
            onPageNavigate={onPageNavigate}
          />
        )}
      </div>

      {/* Bottom — theme, version */}
      <div style={{
        padding: panelOpen ? '12px' : '12px 0',
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
            {panelOpen && <span>{updateStatus}</span>}
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

        <button
          className="button-icon"
          style={{ padding: '8px' }}
          onClick={() => setSettingsOpen(true)}
          title="Настройки"
        >
          <Settings size={20} />
        </button>

        <SettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onSettingsChange={onSettingsChange}
        />

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
