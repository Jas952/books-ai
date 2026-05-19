import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PdfHighlighter, Highlight } from 'react-pdf-highlighter';
// Use the same pdfjs-dist bundled by react-pdf-highlighter (avoids version mismatch)
import { GlobalWorkerOptions, getDocument } from 'react-pdf-highlighter/node_modules/pdfjs-dist';
import 'react-pdf-highlighter/dist/style.css';

import ErrorBoundary from './ErrorBoundary';
import SelectionPopup from './SelectionPopup';

GlobalWorkerOptions.workerSrc = './pdf.worker.min.js';

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
  const prevBufferRef = useRef(null);
  const highlighterRef = useRef(null);
  const containerRef = useRef(null);
  const scaleValueRef = useRef(pdfScaleValue);
  const rafIdRef = useRef(null);

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
    if (!container) return;

    let pending = false;
    const observer = new ResizeObserver(() => {
      if (pending) return;
      pending = true;
      rafIdRef.current = requestAnimationFrame(() => {
        pending = false;
        applyScale(scaleValueRef.current);
      });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
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
                onColorSelect={(color) => {
                  onColorHighlight({ ...newHighlight, color });
                  hideTipAndSelection();
                }}
                onAskAI={() => {
                  onAskAI(newHighlight);
                  hideTipAndSelection();
                }}
              />
            );
          }}
          highlightTransform={(highlight, index, setTip, hideTip, viewportToScaled, screenshot, isScrolledTo) => {
            if (highlight.id === '__nav__') return null;
            const color = HIGHLIGHT_COLORS[highlight.color] || HIGHLIGHT_COLORS.yellow;
            return (
              <Highlight
                key={highlight.id || index}
                isScrolledTo={isScrolledTo}
                position={highlight.position}
                comment={highlight.comment}
                style={{
                  background: color
                }}
              />
            );
          }}
          highlights={highlights}
        />
      </ErrorBoundary>
    </div>
  );
}
);

export default PdfViewer;
