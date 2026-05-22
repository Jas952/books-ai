import React, { useState, useEffect, useRef, useCallback } from 'react';

const THUMB_WIDTH = 150;

function ThumbnailItem({ pdfDocument, pageNum, isActive, onNavigate }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (!pdfDocument || rendered) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !rendered) {
          renderThumb();
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [pdfDocument, rendered]);

  const renderThumb = useCallback(async () => {
    if (!pdfDocument || !canvasRef.current) return;
    try {
      const page = await pdfDocument.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      const scale = THUMB_WIDTH / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      const canvas = canvasRef.current;
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      const ctx = canvas.getContext('2d');

      await page.render({
        canvasContext: ctx,
        viewport: scaledViewport,
      }).promise;

      setRendered(true);
    } catch (err) {
      console.error(`[ThumbnailPanel] Failed to render page ${pageNum}:`, err);
    }
  }, [pdfDocument, pageNum]);

  return (
    <div
      ref={containerRef}
      className={`thumbnail-item ${isActive ? 'active' : ''}`}
      onClick={() => onNavigate(pageNum)}
      title={`Page ${pageNum}`}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: `${THUMB_WIDTH}px`,
          backgroundColor: rendered ? 'transparent' : 'var(--color-surface)',
          minHeight: rendered ? 'auto' : `${THUMB_WIDTH * 1.4}px`,
        }}
      />
      <span className="thumbnail-page-label">{pageNum}</span>
    </div>
  );
}

const ThumbnailPanel = React.memo(function ThumbnailPanel({ pdfDocument, currentPage, onPageNavigate }) {
  const [numPages, setNumPages] = useState(0);

  useEffect(() => {
    if (pdfDocument) {
      setNumPages(pdfDocument.numPages);
    }
  }, [pdfDocument]);

  if (!pdfDocument || numPages === 0) {
    return (
      <div style={{ padding: '16px', color: 'var(--color-text-light)', fontSize: '13px', textAlign: 'center' }}>
        No pages to display.
      </div>
    );
  }

  const pages = Array.from({ length: numPages }, (_, i) => i + 1);

  return (
    <div className="thumbnail-panel">
      {pages.map(pageNum => (
        <ThumbnailItem
          key={pageNum}
          pdfDocument={pdfDocument}
          pageNum={pageNum}
          isActive={currentPage === pageNum}
          onNavigate={onPageNavigate}
        />
      ))}
    </div>
  );
});

export default ThumbnailPanel;
