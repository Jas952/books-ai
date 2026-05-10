import React from 'react';
import { Plus, Replace } from 'lucide-react';

export default function SelectionPopup({ content, onAdd, onReplace, hasExisting }) {
  return (
    <div style={{
      display: 'flex',
      gap: '6px',
      padding: '8px',
      backgroundColor: 'var(--color-bg)',
      borderRadius: '8px',
      border: '1px solid var(--color-border)',
      boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
      zIndex: 100,
      animation: 'fadeIn 0.15s ease'
    }}>
      {hasExisting && (
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            fontSize: '13px',
            fontWeight: 500,
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            cursor: 'pointer',
            color: 'var(--color-text)',
            transition: 'all 0.15s ease',
            fontFamily: 'inherit'
          }}
          onClick={onAdd}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--color-go-blue)';
            e.currentTarget.style.color = 'var(--color-go-blue)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--color-border)';
            e.currentTarget.style.color = 'var(--color-text)';
          }}
        >
          <Plus size={14} />
          Add to selection
        </button>
      )}
      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          fontSize: '13px',
          fontWeight: 500,
          backgroundColor: 'var(--color-go-blue)',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          color: 'white',
          transition: 'all 0.15s ease',
          fontFamily: 'inherit'
        }}
        onClick={onReplace}
        onMouseEnter={e => {
          e.currentTarget.style.backgroundColor = 'var(--color-go-blue-hover)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.backgroundColor = 'var(--color-go-blue)';
        }}
      >
        {hasExisting ? <Replace size={14} /> : null}
        {hasExisting ? 'Replace selection' : 'Select text'}
      </button>
    </div>
  );
}
