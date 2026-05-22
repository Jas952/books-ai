import React, { useState } from 'react';
import { Bot, Check } from 'lucide-react';

const COLORS = [
  { name: 'yellow', hex: '#FFEB3B' },
  { name: 'green', hex: '#4CAF50' },
  { name: 'blue', hex: '#2196F3' },
  { name: 'red', hex: '#F44336' },
  { name: 'purple', hex: '#9C27B0' },
];

export default function SelectionPopup({ content, onColorSelect, onAskAI, hasExisting }) {
  const [commentText, setCommentText] = useState('');

  return (
    <div 
      onMouseDown={e => e.stopPropagation()}
      onMouseUp={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '8px 10px',
        backgroundColor: 'var(--color-bg)',
        borderRadius: '10px',
        border: '1px solid var(--color-border)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        zIndex: 100,
        animation: 'fadeIn 0.15s ease',
        maxWidth: '300px'
      }}
    >
      {/* Action Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Color circles */}
        {COLORS.map(c => (
          <button
            key={c.name}
            title={`Highlight ${c.name}`}
            onClick={() => onColorSelect(c.name, commentText)}
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              backgroundColor: c.hex,
              border: '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              flexShrink: 0,
              padding: 0
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'scale(1.25)';
              e.currentTarget.style.borderColor = 'var(--color-text)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.borderColor = 'transparent';
            }}
          />
        ))}

        {/* Divider */}
        <div style={{
          width: '1px',
          height: '20px',
          backgroundColor: 'var(--color-border)',
          flexShrink: 0
        }} />

        {/* Ask AI button */}
        <button
          onClick={() => onAskAI(commentText)}
          title="Ask AI about this text"
          style={{
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-go-blue)',
            border: 'none',
            cursor: 'pointer',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
            flexShrink: 0,
            padding: 0
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.25)';
            e.currentTarget.style.backgroundColor = 'var(--color-go-blue-hover)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.backgroundColor = 'var(--color-go-blue)';
          }}
        >
          <Bot size={13} />
        </button>
      </div>

      {/* Comment Input + Save Button */}
      <div className="comment-input-row">
        <input
          type="text"
          placeholder="Add a comment..."
          value={commentText}
          onChange={e => setCommentText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              onColorSelect('yellow', commentText);
            }
          }}
          style={{
            padding: '6px 8px',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            fontSize: '12px',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text)',
            outline: 'none',
          }}
        />
        <button
          className="comment-save-btn"
          onClick={() => onColorSelect('yellow', commentText)}
          title="Save highlight with comment"
        >
          <Check size={14} />
        </button>
      </div>
    </div>
  );
}
