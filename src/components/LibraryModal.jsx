import React, { useState, useEffect } from 'react';
import { X, Book, FolderOpen } from 'lucide-react';

const electron = typeof window !== 'undefined' && window.require ? window.require('electron') : null;
const ipcRenderer = electron ? electron.ipcRenderer : null;

export default function LibraryModal({ isOpen, onClose, onSelectBook }) {
  const [books, setBooks] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (!ipcRenderer) {
      setError('Library is only available in the desktop app.');
      return;
    }

    setLoading(true);
    setError(null);

    ipcRenderer.invoke('list-books')
      .then((bookList) => {
        setBooks(bookList);
        setLoading(false);
      })
      .catch((err) => {
        setError('Error loading books: ' + err.message);
        setLoading(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelect = async (bookPath) => {
    try {
      const buffer = await ipcRenderer.invoke('read-pdf', bookPath);
      onSelectBook(new Uint8Array(buffer));
      onClose();
    } catch (err) {
      alert('Failed to load book: ' + err.message);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderOpen size={20} color="var(--color-go-blue)" />
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Local Library</h2>
          </div>
          <button onClick={onClose} className="button-icon">
            <X size={20} />
          </button>
        </div>

        <div style={styles.content}>
          {error && <div style={{ color: '#ef4444', marginBottom: '16px' }}>{error}</div>}
          
          {loading ? (
            <div style={styles.emptyState}>Loading...</div>
          ) : books.length === 0 && !error ? (
            <div style={styles.emptyState}>
              <Book size={40} color="var(--color-text-light)" style={{ marginBottom: '12px', opacity: 0.5 }} />
              <p>No PDF files found.</p>
              <p style={{ fontSize: '12px', marginTop: '8px', opacity: 0.7 }}>
                Place PDF files in the <code>books/</code> folder.
              </p>
            </div>
          ) : (
            <div style={styles.grid}>
              {books.map((book, i) => (
                <div 
                  key={i} 
                  style={styles.card} 
                  onClick={() => handleSelect(book.path)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-go-blue)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <Book size={32} color="var(--color-go-blue)" style={{ marginBottom: '12px', opacity: 0.7 }} />
                  <div style={styles.bookTitle} title={book.name}>
                    {book.name.replace('.pdf', '').replace('.PDF', '')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)'
  },
  modal: {
    width: '600px',
    maxWidth: '90%',
    maxHeight: '80vh',
    backgroundColor: 'var(--color-bg)',
    borderRadius: '12px',
    border: '1px solid var(--color-border)',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--color-surface)'
  },
  content: {
    padding: '20px',
    overflowY: 'auto',
    flex: 1
  },
  emptyState: {
    padding: '40px 20px',
    textAlign: 'center',
    color: 'var(--color-text-light)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '16px'
  },
  card: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '10px',
    padding: '20px 16px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    transition: 'all 0.2s ease'
  },
  bookTitle: {
    fontSize: '13px',
    fontWeight: 500,
    wordBreak: 'break-word',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden'
  }
};
