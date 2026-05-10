import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import PdfViewer from './components/PdfViewer';
import Sidebar from './components/Sidebar';
import Toolbar from './components/Toolbar';
import { Upload, Library, ZoomIn, ZoomOut, Maximize, Columns } from 'lucide-react';
import LibraryModal from './components/LibraryModal';

const electron = typeof window !== 'undefined' && window.require ? window.require('electron') : null;
const ipcRenderer = electron ? electron.ipcRenderer : null;

function App() {
  const [highlights, setHighlights] = useState([]);
  const [selectedText, setSelectedText] = useState('');
  const [pdfBuffer, setPdfBuffer] = useState(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [toolMode, setToolMode] = useState('text');
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [theme, setTheme] = useState('light');
  const [pdfScale, setPdfScale] = useState('auto');
  const [isIdle, setIsIdle] = useState(false);
  const [sidebarMinSize, setSidebarMinSize] = useState(20);
  const fileInputRef = useRef(null);
  const scrollToDestRef = useRef(null);
  const idleTimeoutRef = useRef(null);
  const isHoveringRef = useRef(false);
  const sidebarRef = useRef(null);

  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('theme-dark');
    } else {
      document.body.classList.remove('theme-dark');
    }
  }, [theme]);

  // Auto-hide overlay panels after 2.5s idle
  const resetIdleTimer = useCallback(() => {
    setIsIdle(false);
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    idleTimeoutRef.current = setTimeout(() => {
      if (!isHoveringRef.current) {
        setIsIdle(true);
      }
    }, 2500);
  }, []);

  useEffect(() => {
    resetIdleTimer();
    return () => clearTimeout(idleTimeoutRef.current);
  }, [resetIdleTimer]);

  // Sidebar min 320px (computed as %)
  useEffect(() => {
    const handleResize = () => {
      const minPercentage = (320 / window.innerWidth) * 100;
      setSidebarMinSize(Math.max(20, minPercentage));
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    async function loadDefault() {
      if (!ipcRenderer) return;
      try {
        const books = await ipcRenderer.invoke('list-books');
        if (books.length > 0) {
          const buffer = await ipcRenderer.invoke('read-pdf', books[0].path);
          setPdfBuffer(new Uint8Array(buffer));
        }
      } catch (e) {
        console.error('Could not load default book:', e);
      }
    }
    loadDefault();
  }, []);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') return;

    try {
      if (ipcRenderer && file.path) {
        const buffer = await ipcRenderer.invoke('read-pdf', file.path);
        setPdfBuffer(new Uint8Array(buffer));
      } else {
        const reader = new FileReader();
        reader.onload = function () {
          setPdfBuffer(new Uint8Array(this.result));
        };
        reader.readAsArrayBuffer(file);
      }
      setHighlights([]);
      setSelectedText('');
    } catch (err) {
      alert('Failed to load file: ' + err.message);
    }
  };

  // Color highlight — save to persistent array
  const handleColorHighlight = useCallback((highlight) => {
    setHighlights(prev => [...prev, highlight]);
  }, []);

  // Ask AI — set selected text and focus chat
  const handleAskAI = useCallback((highlight) => {
    const text = highlight.content?.text || '';
    setSelectedText(text);
    // Also add as a blue highlight for visual reference
    setHighlights(prev => [...prev, { ...highlight, color: 'blue' }]);
  }, []);

  const handleClearVisualHighlight = useCallback(() => {
    // Double-click clears only selection, not persistent highlights
  }, []);

  const handleClearSelectedText = useCallback(() => {
    setSelectedText('');
  }, []);

  const handleTocNavigate = useCallback((dest) => {
    scrollToDestRef.current = dest;
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  const handleZoomIn = useCallback(() => {
    setPdfScale(prev => {
      const current = prev === 'auto' || prev === 'page-width' || prev === 'page-fit' ? 1.0 : parseFloat(prev);
      return Math.min(current + 0.25, 3.0).toString();
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setPdfScale(prev => {
      const current = prev === 'auto' || prev === 'page-width' || prev === 'page-fit' ? 1.0 : parseFloat(prev);
      return Math.max(current - 0.25, 0.5).toString();
    });
  }, []);

  return (
    <div className="app-container">
      <Group orientation="horizontal">

        <Toolbar
          toolMode={toolMode}
          setToolMode={setToolMode}
          tocOpen={tocOpen}
          setTocOpen={setTocOpen}
          pdfDocument={pdfDocument}
          onTocNavigate={handleTocNavigate}
          theme={theme}
          toggleTheme={toggleTheme}
        />

        <Panel defaultSize={65} minSize={30}>
          <div className="pdf-pane" onMouseMove={resetIdleTimer} onMouseLeave={() => setIsIdle(true)}>
            <div
              className={`overlay-panel ${!isIdle ? 'visible' : ''}`}
              style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 10, display: 'flex', gap: '8px' }}
              onMouseEnter={() => { isHoveringRef.current = true; if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current); setIsIdle(false); }}
              onMouseLeave={() => { isHoveringRef.current = false; resetIdleTimer(); }}
            >
              <button
                className="button-primary"
                style={{ boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                onClick={() => setIsLibraryOpen(true)}
              >
                <Library size={18} />
                <span>Library</span>
              </button>

              <button
                className="button-primary"
                style={{ boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={18} />
                <span>Upload PDF</span>
              </button>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                ref={fileInputRef}
              />
            </div>

            {pdfBuffer && (
              <div
                className={`overlay-panel ${!isIdle ? 'visible' : ''}`}
                style={{
                  position: 'absolute',
                  bottom: '24px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px',
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
                onMouseEnter={() => { isHoveringRef.current = true; if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current); setIsIdle(false); }}
                onMouseLeave={() => { isHoveringRef.current = false; resetIdleTimer(); }}
              >
                <button className="button-icon" onClick={handleZoomOut} title="Zoom Out">
                  <ZoomOut size={18} />
                </button>
                <button
                  className="button-icon"
                  style={{ backgroundColor: pdfScale === 'auto' ? 'var(--color-go-blue-light)' : 'transparent' }}
                  onClick={() => setPdfScale('auto')}
                  title="Auto Fit"
                >
                  <Maximize size={18} />
                </button>
                <button
                  className="button-icon"
                  style={{ backgroundColor: pdfScale === 'page-width' ? 'var(--color-go-blue-light)' : 'transparent' }}
                  onClick={() => setPdfScale('page-width')}
                  title="Fit to Width"
                >
                  <Columns size={18} />
                </button>
                <button className="button-icon" onClick={handleZoomIn} title="Zoom In">
                  <ZoomIn size={18} />
                </button>
                <div style={{ padding: '0 8px', fontSize: '13px', fontWeight: 500, minWidth: '48px', textAlign: 'center' }}>
                  {pdfScale === 'auto' ? 'Auto' : pdfScale === 'page-width' ? 'Width' : pdfScale === 'page-fit' ? 'Page' : `${Math.round(parseFloat(pdfScale) * 100)}%`}
                </div>
              </div>
            )}

            <LibraryModal
              isOpen={isLibraryOpen}
              onClose={() => setIsLibraryOpen(false)}
              onSelectBook={(buffer) => {
                setPdfBuffer(buffer);
                setHighlights([]);
                setSelectedText('');
              }}
            />

            {pdfBuffer ? (
              <PdfViewer
                pdfBuffer={pdfBuffer}
                highlights={highlights}
                selectedText={selectedText}
                onColorHighlight={handleColorHighlight}
                onAskAI={handleAskAI}
                onClearVisualHighlight={handleClearVisualHighlight}
                toolMode={toolMode}
                onPdfDocumentReady={setPdfDocument}
                scrollToDestRef={scrollToDestRef}
                pdfScaleValue={pdfScale}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-light)' }}>
                Please select a book to start reading
              </div>
            )}
          </div>
        </Panel>

        <Separator className="resize-handle" />

        <Panel defaultSize={35} minSize={sidebarMinSize}>
          <Sidebar
            ref={sidebarRef}
            selectedText={selectedText}
            onClearSelectedText={handleClearSelectedText}
          />
        </Panel>

      </Group>
    </div>
  );
}

export default App;
