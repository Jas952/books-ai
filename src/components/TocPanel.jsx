import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, FileText } from 'lucide-react';

function TocItem({ item, depth, onNavigate }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = item.items && item.items.length > 0;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '6px 8px',
          paddingLeft: `${12 + depth * 16}px`,
          cursor: 'pointer',
          fontSize: '13px',
          color: 'var(--color-text)',
          borderRadius: '4px',
          transition: 'background-color 0.15s ease',
          lineHeight: '1.4',
          userSelect: 'none'
        }}
        onClick={() => {
          if (item.dest) {
            onNavigate(item.dest);
          }
        }}
        onMouseEnter={e => {
          e.currentTarget.style.backgroundColor = 'var(--color-go-blue-light)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        {hasChildren ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        ) : (
          <FileText size={12} style={{ flexShrink: 0, opacity: 0.4 }} />
        )}
        <span style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {item.title}
        </span>
      </div>
      {hasChildren && expanded && (
        <div>
          {item.items.map((child, i) => (
            <TocItem key={i} item={child} depth={depth + 1} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

const TocPanel = React.memo(function TocPanel({ pdfDocument, onNavigate }) {
  const [outline, setOutline] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pdfDocument) return;

    setLoading(true);
    pdfDocument.getOutline()
      .then((result) => {
        setOutline(result);
        setLoading(false);
      })
      .catch(() => {
        setOutline(null);
        setLoading(false);
      });
  }, [pdfDocument]);

  if (loading) {
    return (
      <div style={{ padding: '16px', color: 'var(--color-text-light)', fontSize: '13px' }}>
        Loading table of contents...
      </div>
    );
  }

  if (!outline || outline.length === 0) {
    return (
      <div style={{ padding: '16px', color: 'var(--color-text-light)', fontSize: '13px', textAlign: 'center' }}>
        <FileText size={24} style={{ marginBottom: '8px', opacity: 0.4 }} />
        <p>No table of contents available for this book.</p>
      </div>
    );
  }

  return (
    <div style={{
      overflowY: 'auto',
      overflowX: 'hidden',
      height: '100%',
      paddingTop: '8px',
      paddingBottom: '8px'
    }}>
      {outline.map((item, i) => (
        <TocItem key={i} item={item} depth={0} onNavigate={onNavigate} />
      ))}
    </div>
  );
});

export default TocPanel;
