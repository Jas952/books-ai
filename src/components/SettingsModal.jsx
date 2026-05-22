import React, { useEffect } from 'react';
import { X, Minus, Plus } from 'lucide-react';

const electron = typeof window !== 'undefined' && window.require ? window.require('electron') : null;
const webFrame = electron ? electron.webFrame : null;

const ZOOM_STEPS = [0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0, 1.05, 1.1, 1.15, 1.2, 1.3];

function applyZoom(zoom) {
  if (webFrame) {
    webFrame.setZoomFactor(zoom);
  }
}

export default function SettingsModal({ isOpen, onClose, settings, onSettingsChange }) {
  const { uiZoom = 1.0, chatFontSize = 14 } = settings;

  useEffect(() => {
    applyZoom(uiZoom);
  }, [uiZoom]);

  if (!isOpen) return null;

  const currentIdx = ZOOM_STEPS.indexOf(uiZoom) !== -1
    ? ZOOM_STEPS.indexOf(uiZoom)
    : ZOOM_STEPS.findIndex(s => s >= uiZoom);

  const handleZoomChange = (delta) => {
    const newIdx = Math.min(Math.max(currentIdx + delta, 0), ZOOM_STEPS.length - 1);
    const newZoom = ZOOM_STEPS[newIdx];
    onSettingsChange({ ...settings, uiZoom: newZoom });
  };

  const handleFontSizeChange = (delta) => {
    const newSize = Math.min(Math.max(chatFontSize + delta, 10), 20);
    onSettingsChange({ ...settings, chatFontSize: newSize });
  };

  const displayPercent = Math.round(uiZoom * 100);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.15s ease'
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          padding: '24px',
          width: '340px',
          maxWidth: '90vw',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          animation: 'fadeIn 0.2s ease'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>
            Настройки
          </h3>
          <button
            className="button-icon"
            onClick={onClose}
            style={{ padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* UI Scale */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--color-text)',
            marginBottom: '8px'
          }}>
            Масштаб интерфейса
          </label>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: 'var(--color-surface)',
            borderRadius: '8px',
            padding: '8px 12px',
            border: '1px solid var(--color-border)'
          }}>
            <button
              className="button-icon"
              onClick={() => handleZoomChange(-1)}
              disabled={currentIdx <= 0}
              style={{ padding: '4px' }}
              title="Уменьшить"
            >
              <Minus size={16} />
            </button>
            <span style={{
              flex: 1,
              textAlign: 'center',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--color-text)'
            }}>
              {displayPercent}%
            </span>
            <button
              className="button-icon"
              onClick={() => handleZoomChange(1)}
              disabled={currentIdx >= ZOOM_STEPS.length - 1}
              style={{ padding: '4px' }}
              title="Увеличить"
            >
              <Plus size={16} />
            </button>
          </div>
          <div style={{
            marginTop: '6px',
            fontSize: '11px',
            color: 'var(--color-text-light)',
            opacity: 0.7
          }}>
            Масштабирует весь интерфейс приложения (60%–130%)
          </div>
        </div>

        {/* Chat Font Size */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--color-text)',
            marginBottom: '8px'
          }}>
            Размер шрифта чата
          </label>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: 'var(--color-surface)',
            borderRadius: '8px',
            padding: '8px 12px',
            border: '1px solid var(--color-border)'
          }}>
            <button
              className="button-icon"
              onClick={() => handleFontSizeChange(-1)}
              disabled={chatFontSize <= 10}
              style={{ padding: '4px' }}
              title="Уменьшить"
            >
              <Minus size={16} />
            </button>
            <span style={{
              flex: 1,
              textAlign: 'center',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--color-text)'
            }}>
              {chatFontSize}px
            </span>
            <button
              className="button-icon"
              onClick={() => handleFontSizeChange(1)}
              disabled={chatFontSize >= 20}
              style={{ padding: '4px' }}
              title="Увеличить"
            >
              <Plus size={16} />
            </button>
          </div>
          <div style={{
            marginTop: '6px',
            fontSize: '11px',
            color: 'var(--color-text-light)',
            opacity: 0.7
          }}>
            Размер текста в сообщениях чата (10–20px)
          </div>
        </div>
      </div>
    </div>
  );
}
