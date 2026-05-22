import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PdfHighlighter, Highlight } from 'react-pdf-highlighter';
// Use the same pdfjs-dist bundled by react-pdf-highlighter (avoids version mismatch)
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import 'react-pdf-highlighter/dist/style.css';

import ErrorBoundary from './ErrorBoundary';
import SelectionPopup from './SelectionPopup';

// pdfjs-dist 4.x ships .mjs workers
const isDev = window.location.protocol === 'http:';
GlobalWorkerOptions.workerSrc = isDev
  ? new URL('/pdf.worker.min.mjs', window.location.origin).href
  : './pdf.worker.min.mjs';

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
  tocScrollDest,
  zoomMultiplier = 1.0,
  zoomMode = 'width',
  pageNavigateDest,
  onPageChange,
  onHighlightClick
}) {
  const [pdfDocument, setPdfDocument] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hoveredHighlightId, setHoveredHighlightId] = useState(null);
  const highlighterRef = useRef(null);
  const previewLayerRef = useRef(null);
  const containerRef = useRef(null);
  const scaleValueRef = useRef(zoomMultiplier);
  const rafIdRef = useRef(null);
  const resizeCommitTimerRef = useRef(null);
  const resizeBaseWidthRef = useRef(0);

  useEffect(() => {
    if (!pdfBuffer) return;

    setLoading(true);
    setError(null);

    let isCancelled = false;
    const loadingTask = getDocument({ data: pdfBuffer.slice() });

    loadingTask.promise
      .then((doc) => {
        if (isCancelled) {
          doc.destroy().catch(() => {});
          return;
        }
        setPdfDocument(doc);
        setLoading(false);
        if (onPdfDocumentReady) {
          onPdfDocumentReady(doc);
        }
      })
      .catch((err) => {
        if (isCancelled) return;
        console.error('[PdfViewer] PDF load error:', err);
        setError(err.message || 'Failed to load PDF');
        setLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [pdfBuffer]);

  useEffect(() => {
    scaleValueRef.current = zoomMultiplier;
  }, [zoomMultiplier]);

  // Apply zoom based on multiplier and mode
  const applyZoom = useCallback(() => {
    if (!highlighterRef.current || !highlighterRef.current.viewer) return;
    const viewer = highlighterRef.current.viewer;
    if (zoomMode === 'width') {
      // First set to page-width, then apply multiplier
      viewer.currentScaleValue = 'page-width';
      if (zoomMultiplier !== 1.0) {
        requestAnimationFrame(() => {
          const baseScale = viewer.currentScale;
          viewer.currentScale = baseScale * zoomMultiplier;
        });
      }
    } else {
      viewer.currentScale = zoomMultiplier;
    }
  }, [zoomMultiplier, zoomMode]);

  useEffect(() => {
    applyZoom();
  }, [zoomMultiplier, zoomMode, applyZoom]);

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
          applyZoom();
        }, 110);
      });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (resizeCommitTimerRef.current) clearTimeout(resizeCommitTimerRef.current);
    };
  }, [pdfDocument, applyZoom]);

  // TOC navigation
  useEffect(() => {
    if (!tocScrollDest || !tocScrollDest.dest || !pdfDocument) return;

    const dest = tocScrollDest.dest;

    const performScroll = (pageIndex) => {
      if (highlighterRef.current && highlighterRef.current.viewer) {
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
  }, [tocScrollDest, pdfDocument]);

  // Page navigation
  useEffect(() => {
    if (!pageNavigateDest || !pdfDocument) return;
    if (highlighterRef.current && highlighterRef.current.viewer) {
      highlighterRef.current.viewer.scrollPageIntoView({ pageNumber: pageNavigateDest.page });
    }
  }, [pageNavigateDest, pdfDocument]);

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
        <div ref={previewLayerRef} className="pdf-resize-preview-layer" style={{ height: '100%', width: '100%', transformOrigin: 'top center' }}>
          <PdfHighlighter
            ref={highlighterRef}
            pdfDocument={pdfDocument}
            pdfScaleValue={zoomMode === 'width' ? 'page-width' : String(zoomMultiplier)}
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
                  onClick={() => {
                    if (highlight.comment?.text && onHighlightClick) {
                      onHighlightClick(highlight);
                    }
                  }}
                >
                  <Highlight
                    isScrolledTo={isScrolledTo}
                    position={highlight.position}
                  />
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
