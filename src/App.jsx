import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import PdfViewer from './components/PdfViewer';
import Sidebar from './components/Sidebar';
import Toolbar from './components/Toolbar';
import { Upload, Library, ZoomIn, ZoomOut, AlignCenter, MessageSquare, Bot } from 'lucide-react';
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
  const [thumbnailsOpen, setThumbnailsOpen] = useState(false);
  const [theme, setTheme] = useState('light');
  const [zoomMultiplier, setZoomMultiplier] = useState(1.0);
  const [zoomMode, setZoomMode] = useState('width');
  const [isIdle, setIsIdle] = useState(false);
  const sidebarMinSize = 360;
  const [tocScrollDest, setTocScrollDest] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageNavigateDest, setPageNavigateDest] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeCommentHighlight, setActiveCommentHighlight] = useState(null);
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('books-agent-settings');
      return saved ? JSON.parse(saved) : { uiZoom: 1.0 };
    } catch { return { uiZoom: 1.0 }; }
  });

  const handleSettingsChange = useCallback((newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('books-agent-settings', JSON.stringify(newSettings));
  }, []);
  const fileInputRef = useRef(null);
  const idleTimeoutRef = useRef(null);
  const isHoveringRef = useRef(false);

  const numPages = pdfDocument ? pdfDocument.numPages : 0;

  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('theme-dark');
    } else {
      document.body.classList.remove('theme-dark');
    }
  }, [theme]);

  useEffect(() => {
    const webFrame = electron ? electron.webFrame : null;
    if (webFrame && settings.uiZoom) {
      webFrame.setZoomFactor(settings.uiZoom);
    }
  }, []);

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


  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  useEffect(() => {
    async function loadDefault() {
      if (!ipcRenderer) return;
      try {
        const books = await ipcRenderer.invoke('list-books', '');
        const pdfFiles = books.filter(b => b.type === 'file');
        if (pdfFiles.length > 0) {
          const buffer = await ipcRenderer.invoke('read-pdf', pdfFiles[0].path);
          setPdfBuffer(new Uint8Array(buffer));
          setTocScrollDest(null);
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
      setTocScrollDest(null);
      setCurrentPage(1);
    } catch (err) {
      alert('Failed to load file: ' + err.message);
    }
  };

  // Color highlight — save to persistent array
  const handleColorHighlight = useCallback((highlight) => {
    setHighlights(prev => [...prev, highlight]);
  }, []);

  // Ask AI — set selected text and remove the highlight
  const handleAskAI = useCallback((highlight) => {
    let text = highlight.content?.text || '';
    if (highlight.comment && highlight.comment.text) {
      text = `[Comment: ${highlight.comment.text}]\n${text}`;
    }
    setSelectedText(text);
    // Remove this highlight after sending to AI
    if (highlight.id) {
      setHighlights(prev => prev.filter(h => h.id !== highlight.id));
    }
  }, []);

  // Undo highlight (Cmd+Z or Ctrl+Z)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeElement = document.activeElement;
      const isInput = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable);
      
      if (!isInput && (e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        setHighlights(prev => {
          if (prev.length === 0) return prev;
          return prev.slice(0, -1);
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClearVisualHighlight = useCallback(() => {
    // Double-click clears only selection, not persistent highlights
  }, []);

  const handleClearSelectedText = useCallback(() => {
    setSelectedText('');
  }, []);

  const handleTocNavigate = useCallback((dest) => {
    setTocScrollDest({ dest, timestamp: Date.now() });
  }, []);

  const handlePageNavigate = useCallback((pageNum) => {
    setPageNavigateDest({ page: pageNum, timestamp: Date.now() });
    setCurrentPage(pageNum);
  }, []);

  const handlePageChange = useCallback((pageNum) => {
    setCurrentPage(pageNum);
  }, []);

  const handleHighlightClick = useCallback((highlight) => {
    if (highlight.comment?.text) {
      setActiveCommentHighlight(highlight);
    }
  }, []);

  const handleAskAIFromComment = useCallback(() => {
    if (!activeCommentHighlight) return;
    handleAskAI(activeCommentHighlight);
    setActiveCommentHighlight(null);
  }, [activeCommentHighlight, handleAskAI]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoomMode('width');
    setZoomMultiplier(prev => Math.min(prev + 0.1, 3.0));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomMode('width');
    setZoomMultiplier(prev => Math.max(prev - 0.1, 0.3));
  }, []);

  return (
    <>
      <div className="titlebar">
        <div className="titlebar-spacer-left" />
        <span style={{ flex: 1, textAlign: 'center' }}>Books Agent</span>
        <div style={{ width: '70px', display: 'flex', justifyContent: 'flex-end', paddingRight: '12px', WebkitAppRegion: 'no-drag' }}>
          <button 
             className="button-icon" 
             style={{ padding: '4px', opacity: isSidebarOpen ? 1 : 0.5 }} 
             onClick={toggleSidebar}
             title="Toggle AI Assistant"
          >
             <MessageSquare size={16} />
          </button>
        </div>
      </div>
      <div className="app-container">
        <Group orientation="horizontal">

        <Toolbar
          toolMode={toolMode}
          setToolMode={setToolMode}
          tocOpen={tocOpen}
          setTocOpen={setTocOpen}
          thumbnailsOpen={thumbnailsOpen}
          setThumbnailsOpen={setThumbnailsOpen}
          pdfDocument={pdfDocument}
          onTocNavigate={handleTocNavigate}
          onPageNavigate={handlePageNavigate}
          currentPage={currentPage}
          numPages={numPages}
          theme={theme}
          toggleTheme={toggleTheme}
          settings={settings}
          onSettingsChange={handleSettingsChange}
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
                  onClick={() => { setZoomMode('width'); setZoomMultiplier(1.0); }}
                  title="Fit to Width"
                >
                  <AlignCenter size={18} />
                </button>
                <button className="button-icon" onClick={handleZoomIn} title="Zoom In">
                  <ZoomIn size={18} />
                </button>
                <div style={{ padding: '0 8px', fontSize: '13px', fontWeight: 500, minWidth: '48px', textAlign: 'center' }}>
                  {`${Math.round(zoomMultiplier * 100)}%`}
                </div>

                {activeCommentHighlight && (
                  <>
                    <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-border)', flexShrink: 0 }} />
                    <button
                      onClick={handleAskAIFromComment}
                      title={`Ask AI: ${activeCommentHighlight.comment?.text}`}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--color-go-blue)',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease',
                        padding: 0,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        animation: 'fadeIn 0.15s ease'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'scale(1.15)';
                        e.currentTarget.style.backgroundColor = 'var(--color-go-blue-hover)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.backgroundColor = 'var(--color-go-blue)';
                      }}
                    >
                      <Bot size={16} />
                    </button>
                  </>
                )}
              </div>
            )}

            <LibraryModal
              isOpen={isLibraryOpen}
              onClose={() => setIsLibraryOpen(false)}
              onSelectBook={(buffer) => {
                setPdfBuffer(buffer);
                setHighlights([]);
                setSelectedText('');
                setTocScrollDest(null);
                setCurrentPage(1);
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
                tocScrollDest={tocScrollDest}
                zoomMultiplier={zoomMultiplier}
                zoomMode={zoomMode}
                pageNavigateDest={pageNavigateDest}
                onPageChange={handlePageChange}
                onHighlightClick={handleHighlightClick}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-light)' }}>
                Please select a book to start reading
              </div>
            )}
          </div>
        </Panel>

        {isSidebarOpen && (
          <>
            <Separator className="resize-handle" />
            <Panel 
              id="sidebar-panel"
              defaultSize={sidebarMinSize} 
              minSize={sidebarMinSize}
              collapsible={true}
              collapsedSize={0}
              onCollapse={() => setIsSidebarOpen(false)}
            >
              <Sidebar
                selectedText={selectedText}
                onClearSelectedText={() => setSelectedText('')}
                onSetSelectedText={setSelectedText}
                settings={settings}
              />
            </Panel>
          </>
        )}

      </Group>
      </div>
    </>
  );
}

export default App;
