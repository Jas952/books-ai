import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PdfHighlighter, Highlight } from 'react-pdf-highlighter';
// Use the same pdfjs-dist bundled by react-pdf-highlighter (avoids version mismatch)
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import 'react-pdf-highlighter/dist/style.css';

import ErrorBoundary from './ErrorBoundary';
import SelectionPopup from './SelectionPopup';

import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';
GlobalWorkerOptions.workerPort = new PdfWorker();

const HIGHLIGHT_COLORS = {
  yellow: 'rgba(255, 235, 59, 0.35)',
  green: 'rgba(76, 175, 80, 0.35)',
  blue: 'rgba(33, 150, 243, 0.35)',
  red: 'rgba(244, 67, 54, 0.30)',
  purple: 'rgba(156, 39, 176, 0.30)',
};

const PdfViewer = React.memo(function PdfViewer({
  pdfBuffer,
  highlights,
  selectedText,
  onColorHighlight,
  onAskAI,
  onClearVisualHighlight,
  toolMode,
  onPdfDocumentReady,
  scrollToDestRef,
  pdfScaleValue = 'auto'
}) {
  const [pdfDocument, setPdfDocument] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hoveredHighlightId, setHoveredHighlightId] = useState(null);
  const prevBufferRef = useRef(null);
  const highlighterRef = useRef(null);
  const previewLayerRef = useRef(null);
  const containerRef = useRef(null);
  const scaleValueRef = useRef(pdfScaleValue);
  const rafIdRef = useRef(null);
  const resizeCommitTimerRef = useRef(null);
  const resizeBaseWidthRef = useRef(0);

  useEffect(() => {
    if (!pdfBuffer) return;
    if (prevBufferRef.current === pdfBuffer) return;
    prevBufferRef.current = pdfBuffer;

    setLoading(true);
    setError(null);

    if (pdfDocument) {
      pdfDocument.destroy();
    }

    const loadingTask = getDocument({ data: pdfBuffer.slice() });
    loadingTask.promise
      .then((doc) => {
        setPdfDocument(doc);
        setLoading(false);
        if (onPdfDocumentReady) {
          onPdfDocumentReady(doc);
        }
      })
      .catch((err) => {
        console.error('[PdfViewer] PDF load error:', err);
        setError(err.message || 'Failed to load PDF');
        setLoading(false);
      });

    return () => {
      loadingTask.destroy();
    };
  }, [pdfBuffer]);

  useEffect(() => {
    scaleValueRef.current = pdfScaleValue;
  }, [pdfScaleValue]);

  // Apply scale directly — single call, no intermediate value
  const applyScale = useCallback((scaleVal) => {
    if (!highlighterRef.current || !highlighterRef.current.viewer) return;
    const viewer = highlighterRef.current.viewer;
    viewer.currentScaleValue = scaleVal;
  }, []);

  useEffect(() => {
    applyScale(pdfScaleValue);
  }, [pdfScaleValue, applyScale]);

  // rAF-throttled ResizeObserver for smooth rescaling during drag
  useEffect(() => {
    const container = containerRef.current;
    const previewLayer = previewLayerRef.current;
    if (!container || !previewLayer) return;

    let pending = false;
    const observer = new ResizeObserver(() => {
      if (pending) return;
      pending = true;
      rafIdRef.current = requestAnimationFrame(() => {
        pending = false;
        const width = container.clientWidth;
        if (!width) return;

        if (!resizeBaseWidthRef.current) {
          resizeBaseWidthRef.current = width;
        }

        // Lightweight visual preview while dragging to keep resize smooth.
        const previewScale = Math.max(0.5, Math.min(2, width / resizeBaseWidthRef.current));
        previewLayer.style.transform = `scale(${previewScale})`;
        previewLayer.classList.add('is-resizing');

        if (resizeCommitTimerRef.current) {
          clearTimeout(resizeCommitTimerRef.current);
        }

        resizeCommitTimerRef.current = setTimeout(() => {
          resizeBaseWidthRef.current = container.clientWidth || width;
          previewLayer.style.transform = 'scale(1)';
          previewLayer.classList.remove('is-resizing');
          applyScale(scaleValueRef.current);
        }, 110);
      });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (resizeCommitTimerRef.current) clearTimeout(resizeCommitTimerRef.current);
    };
  }, [pdfDocument, applyScale]);

  // TOC navigation
  useEffect(() => {
    if (!scrollToDestRef || !scrollToDestRef.current || !pdfDocument) return;

    const dest = scrollToDestRef.current;
    scrollToDestRef.current = null;

    const performScroll = (pageIndex) => {
      if (highlighterRef.current && highlighterRef.current.viewer) {
        // PDF.js pages are 1-indexed
        highlighterRef.current.viewer.scrollPageIntoView({ pageNumber: pageIndex + 1 });
      }
    };

    if (typeof dest === 'string') {
      pdfDocument.getDestination(dest).then(resolved => {
        if (resolved) {
          pdfDocument.getPageIndex(resolved[0]).then(performScroll);
        }
      });
    } else if (Array.isArray(dest)) {
      pdfDocument.getPageIndex(dest[0]).then(performScroll);
    }
  });

  // Double-click empty area → clear highlight
  const handleDoubleClick = useCallback((e) => {
    const target = e.target;
    const isTextLayer = target.closest('.textLayer');
    const isOnText = target.tagName === 'SPAN' && isTextLayer;

    if (!isOnText && onClearVisualHighlight) {
      onClearVisualHighlight();
    }
  }, [onClearVisualHighlight]);

  if (loading) {
    return (
      <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-light)' }}>
        Loading book...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-surface)', color: '#ef4444', padding: '20px', textAlign: 'center' }}>
        <div>
          <p style={{ fontWeight: 600, marginBottom: '8px' }}>Error loading PDF</p>
          <p style={{ fontSize: '13px', opacity: 0.8 }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!pdfDocument) return null;

  return (
    <div
      ref={containerRef}
      style={{ height: '100%', width: '100%', backgroundColor: 'var(--color-surface)', position: 'relative', overflow: 'hidden' }}
      onDoubleClick={handleDoubleClick}
    >
      <ErrorBoundary>
        <div ref={previewLayerRef} className="pdf-resize-preview-layer">
          <PdfHighlighter
            ref={highlighterRef}
            pdfDocument={pdfDocument}
            pdfScaleValue={pdfScaleValue}
            enableAreaSelection={event => toolMode === 'area'}
            onScrollChange={() => {}}
            onSelectionFinished={(position, content, hideTipAndSelection, transformSelection) => {
              const newHighlight = { position, content, id: String(Date.now()) };
              const hasExisting = !!selectedText;

              return (
                <SelectionPopup
                  content={content}
                  hasExisting={hasExisting}
                  onColorSelect={(color, commentText) => {
                    const highlightWithComment = { ...newHighlight, color };
                    if (commentText) {
                      highlightWithComment.comment = { text: commentText };
                    }
                    onColorHighlight(highlightWithComment);
                    hideTipAndSelection();
                  }}
                  onAskAI={(commentText) => {
                    const highlightWithComment = { ...newHighlight };
                    if (commentText) {
                      highlightWithComment.comment = { text: commentText };
                    }
                    onAskAI(highlightWithComment);
                    hideTipAndSelection();
                  }}
                />
              );
            }}
            highlightTransform={(highlight, index, setTip, hideTip, viewportToScaled, screenshot, isScrolledTo) => {
              if (highlight.id === '__nav__') return null;
              const color = HIGHLIGHT_COLORS[highlight.color] || HIGHLIGHT_COLORS.yellow;
              const isHovered = hoveredHighlightId === highlight.id;

              return (
                <div 
                  key={highlight.id || index}
                  style={{ '--highlight-bg': color }}
                  className="custom-highlight-wrapper"
                  onMouseEnter={() => {
                    if (highlight.comment?.text) {
                      setHoveredHighlightId(highlight.id);
                    }
                  }}
                  onMouseLeave={() => setHoveredHighlightId(null)}
                >
                  <Highlight
                    isScrolledTo={isScrolledTo}
                    position={highlight.position}
                  />
                  
                  {isHovered && highlight.comment?.text && (
                    <div 
                      style={{
                        position: 'absolute',
                        left: highlight.position.boundingRect.left,
                        top: Math.max(0, highlight.position.boundingRect.top - 45),
                        zIndex: 1000,
                        backgroundColor: 'var(--color-bg)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px',
                        padding: '6px 10px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        animation: 'fadeIn 0.15s ease'
                      }}
                    >
                      <span style={{ 
                        fontSize: '13px', 
                        color: 'var(--color-text)', 
                        maxWidth: '200px', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap',
                        fontWeight: 500
                      }}>
                        {highlight.comment.text}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAskAI(highlight);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          backgroundColor: 'var(--color-go-blue)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-go-blue-hover)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--color-go-blue)'}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                        Ask AI
                      </button>
                    </div>
                  )}
                </div>
              );
            }}
            highlights={highlights}
          />
        </div>
      </ErrorBoundary>
    </div>
  );
}
);

export default PdfViewer;
