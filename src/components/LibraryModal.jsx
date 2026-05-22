import React, { useState, useEffect } from 'react';
import { X, FileText, FolderOpen, Folder, FolderPlus, ChevronRight, ArrowLeft, MoreHorizontal } from 'lucide-react';

const electron = typeof window !== 'undefined' && window.require ? window.require('electron') : null;
const ipcRenderer = electron ? electron.ipcRenderer : null;

export default function LibraryModal({ isOpen, onClose, onSelectBook }) {
  const [items, setItems] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [pathStack, setPathStack] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [newFolderMode, setNewFolderMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [moveTarget, setMoveTarget] = useState(null);
  const [folders, setFolders] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [contextMenu, setContextMenu] = useState(null);

  const loadItems = async (relPath = '') => {
    if (!ipcRenderer) {
      setError('Library is only available in the desktop app.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await ipcRenderer.invoke('list-books', relPath);
      setItems(result);
      setCurrentPath(relPath);
      setSelectedIdx(-1);
      setContextMenu(null);
      setLoading(false);
    } catch (err) {
      setError('Error loading books: ' + err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setPathStack([]);
    setCurrentPath('');
    setMoveTarget(null);
    setNewFolderMode(false);
    setContextMenu(null);
    loadItems('');
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

  const navigateToFolder = (folderRelPath, folderName) => {
    setPathStack(prev => [...prev, { path: currentPath, name: folderName || 'Root' }]);
    loadItems(folderRelPath);
  };

  const navigateBack = () => {
    if (pathStack.length === 0) return;
    const prev = pathStack[pathStack.length - 1];
    setPathStack(ps => ps.slice(0, -1));
    loadItems(prev.path);
  };

  const navigateToBreadcrumb = (index) => {
    if (index < 0) {
      setPathStack([]);
      loadItems('');
      return;
    }
    const target = pathStack[index];
    setPathStack(ps => ps.slice(0, index));
    loadItems(target.path);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await ipcRenderer.invoke('create-folder', currentPath, newFolderName.trim());
      setNewFolderMode(false);
      setNewFolderName('');
      loadItems(currentPath);
    } catch (err) {
      alert('Failed to create folder: ' + err.message);
    }
  };

  const handleMoveBook = async (bookPath, targetFolderRelPath) => {
    try {
      await ipcRenderer.invoke('move-book', bookPath, targetFolderRelPath);
      setMoveTarget(null);
      setContextMenu(null);
      loadItems(currentPath);
    } catch (err) {
      alert('Failed to move book: ' + err.message);
    }
  };

  const handleDeleteFolder = async (folderRelPath) => {
    if (!confirm('Удалить папку? (Только пустые папки можно удалить)')) return;
    try {
      await ipcRenderer.invoke('delete-folder', folderRelPath);
      setContextMenu(null);
      loadItems(currentPath);
    } catch (err) {
      alert('Failed to delete folder: ' + err.message);
    }
  };

  const startMoveBook = async (book) => {
    try {
      const rootItems = await ipcRenderer.invoke('list-books', '');
      setFolders(rootItems.filter(i => i.type === 'folder'));
      setMoveTarget(book);
      setContextMenu(null);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const folderItems = items.filter(i => i.type === 'folder');
  const bookItems = items.filter(i => i.type === 'file');
  const allItems = [...folderItems, ...bookItems];

  const handleItemClick = (item, index) => {
    setSelectedIdx(index);
    setContextMenu(null);
  };

  const handleItemDoubleClick = (item) => {
    if (item.type === 'folder') {
      navigateToFolder(item.relPath, item.name);
    } else {
      handleSelect(item.path);
    }
  };

  const handleContextBtn = (e, item, index) => {
    e.stopPropagation();
    setSelectedIdx(index);
    if (contextMenu && contextMenu.index === index) {
      setContextMenu(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setContextMenu({ item, index, x: rect.left, y: rect.bottom + 4 });
    }
  };

  const currentFolderName = currentPath ? currentPath.split('/').pop() : 'Library';

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => { e.stopPropagation(); setContextMenu(null); }}>

        {/* Toolbar */}
        <div style={s.toolbar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {pathStack.length > 0 && (
              <button onClick={navigateBack} style={s.navBtn} title="Назад">
                <ArrowLeft size={16} />
              </button>
            )}
            <div style={s.breadcrumbBar}>
              <button onClick={() => navigateToBreadcrumb(-1)} style={s.crumbBtn}>
                Library
              </button>
              {pathStack.map((crumb, i) => (
                <React.Fragment key={i}>
                  <ChevronRight size={11} style={{ opacity: 0.35, flexShrink: 0 }} />
                  <button onClick={() => navigateToBreadcrumb(i)} style={s.crumbBtn}>
                    {crumb.name}
                  </button>
                </React.Fragment>
              ))}
              {currentPath && (
                <>
                  <ChevronRight size={11} style={{ opacity: 0.35, flexShrink: 0 }} />
                  <span style={{ ...s.crumbBtn, fontWeight: 600, cursor: 'default', color: 'var(--color-text)' }}>
                    {currentFolderName}
                  </span>
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <button onClick={() => setNewFolderMode(true)} style={s.toolBtn} title="Новая папка">
              <FolderPlus size={15} />
            </button>
            <button onClick={onClose} style={s.toolBtn} title="Закрыть">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* New folder input */}
        {newFolderMode && (
          <div style={s.newFolderBar}>
            <Folder size={14} style={{ color: 'var(--color-go-blue)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Имя папки..."
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') { setNewFolderMode(false); setNewFolderName(''); } }}
              autoFocus
              style={s.newFolderInput}
            />
            <button onClick={handleCreateFolder} style={{ ...s.toolBtn, color: 'var(--color-go-blue)' }}>
              Создать
            </button>
            <button onClick={() => { setNewFolderMode(false); setNewFolderName(''); }} style={s.toolBtn}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Move dialog */}
        {moveTarget && (
          <div style={s.moveBar}>
            <span style={{ fontSize: '12px' }}>
              Переместить «<strong>{moveTarget.name.replace('.pdf', '')}</strong>» в:
            </span>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
              {currentPath && (
                <button style={s.moveFolderBtn} onClick={() => handleMoveBook(moveTarget.path, '')}>
                  <ArrowLeft size={11} /> Root
                </button>
              )}
              {folders.map((f, i) => (
                <button key={i} style={s.moveFolderBtn} onClick={() => handleMoveBook(moveTarget.path, f.relPath)}>
                  <Folder size={11} /> {f.name}
                </button>
              ))}
            </div>
            <button onClick={() => setMoveTarget(null)} style={{ ...s.toolBtn, marginTop: '6px', fontSize: '11px', color: 'var(--color-text-light)' }}>
              Отмена
            </button>
          </div>
        )}

        {/* Column header */}
        <div style={s.columnHeader}>
          <span style={{ flex: 1 }}>Имя</span>
          <span style={{ width: '60px', textAlign: 'right' }}>Тип</span>
        </div>

        {/* Content list */}
        <div style={s.content}>
          {error && <div style={{ color: '#ef4444', padding: '12px 16px', fontSize: '12px' }}>{error}</div>}

          {loading ? (
            <div style={s.emptyState}>Загрузка...</div>
          ) : allItems.length === 0 && !error ? (
            <div style={s.emptyState}>
              <FolderOpen size={36} style={{ opacity: 0.2, marginBottom: '12px' }} />
              <p style={{ fontSize: '13px', fontWeight: 500 }}>Пусто</p>
              <p style={{ fontSize: '11px', marginTop: '6px', opacity: 0.5 }}>
                Добавьте PDF файлы в папку <code>books/</code>
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {allItems.map((item, i) => {
                const isSelected = selectedIdx === i;
                const isFolder = item.type === 'folder';
                return (
                  <div
                    key={`${item.type}-${i}`}
                    onClick={() => handleItemClick(item, i)}
                    onDoubleClick={() => handleItemDoubleClick(item)}
                    style={{
                      ...s.row,
                      backgroundColor: isSelected ? 'var(--color-go-blue)' : 'transparent',
                      color: isSelected ? '#fff' : 'var(--color-text)',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--color-surface)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                      {isFolder ? (
                        <Folder size={18} style={{ color: isSelected ? '#fff' : '#3B9EFF', flexShrink: 0 }} />
                      ) : (
                        <FileText size={18} style={{ color: isSelected ? '#fff' : 'var(--color-text-light)', flexShrink: 0 }} />
                      )}
                      <span style={{
                        fontSize: '13px',
                        fontWeight: isFolder ? 500 : 400,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {isFolder ? item.name : item.name.replace(/\.pdf$/i, '')}
                      </span>
                      {isFolder && (
                        <ChevronRight size={13} style={{ opacity: isSelected ? 0.7 : 0.3, flexShrink: 0 }} />
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', opacity: 0.5, width: '40px', textAlign: 'right' }}>
                        {isFolder ? 'Папка' : 'PDF'}
                      </span>
                      <button
                        onClick={(e) => handleContextBtn(e, item, i)}
                        style={{
                          ...s.toolBtn,
                          opacity: isSelected ? 0.8 : 0,
                          padding: '2px',
                          color: isSelected ? '#fff' : 'var(--color-text-light)',
                          transition: 'opacity 0.15s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; }}
                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.opacity = 0; }}
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Context menu dropdown */}
        {contextMenu && (
          <div
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              transform: 'translateX(-100%)',
              zIndex: 10001,
              backgroundColor: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
              padding: '4px',
              minWidth: '160px',
              animation: 'fadeIn 0.1s ease'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.item.type === 'folder' ? (
              <>
                <button style={s.menuItem} onClick={() => { navigateToFolder(contextMenu.item.relPath, contextMenu.item.name); }}>
                  <FolderOpen size={13} /> Открыть
                </button>
                <button style={{ ...s.menuItem, color: '#ef4444' }} onClick={() => handleDeleteFolder(contextMenu.item.relPath)}>
                  <X size={13} /> Удалить
                </button>
              </>
            ) : (
              <>
                <button style={s.menuItem} onClick={() => handleSelect(contextMenu.item.path)}>
                  <FileText size={13} /> Открыть
                </button>
                <button style={s.menuItem} onClick={() => startMoveBook(contextMenu.item)}>
                  <Folder size={13} /> Переместить...
                </button>
              </>
            )}
          </div>
        )}

        {/* Status bar */}
        <div style={s.statusBar}>
          <span>{allItems.length} объект{allItems.length !== 1 ? 'ов' : ''}</span>
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(8px)',
    animation: 'fadeIn 0.15s ease'
  },
  modal: {
    width: '580px',
    maxWidth: '92vw',
    maxHeight: '75vh',
    backgroundColor: 'var(--color-bg)',
    borderRadius: '10px',
    border: '1px solid var(--color-border)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative'
  },
  toolbar: {
    padding: '10px 12px',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--color-surface)',
    gap: '8px'
  },
  breadcrumbBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    overflow: 'hidden'
  },
  crumbBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-text-light)',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'inherit',
    padding: '2px 4px',
    borderRadius: '4px',
    whiteSpace: 'nowrap',
    transition: 'background-color 0.1s'
  },
  navBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text)',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'all 0.15s'
  },
  toolBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    color: 'var(--color-text)',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'inherit',
    padding: '4px 6px',
    borderRadius: '4px',
    transition: 'background-color 0.1s'
  },
  columnHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 16px',
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--color-text-light)',
    borderBottom: '1px solid var(--color-border)',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    userSelect: 'none'
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 16px',
    cursor: 'default',
    userSelect: 'none',
    borderBottom: '1px solid rgba(128,128,128,0.06)',
    transition: 'background-color 0.08s',
    gap: '8px'
  },
  emptyState: {
    padding: '48px 20px',
    textAlign: 'center',
    color: 'var(--color-text-light)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  statusBar: {
    padding: '6px 16px',
    borderTop: '1px solid var(--color-border)',
    fontSize: '11px',
    color: 'var(--color-text-light)',
    backgroundColor: 'var(--color-surface)',
    userSelect: 'none'
  },
  newFolderBar: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    padding: '8px 16px',
    borderBottom: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-surface)'
  },
  newFolderInput: {
    flex: 1,
    padding: '5px 8px',
    border: '1px solid var(--color-go-blue)',
    borderRadius: '5px',
    fontSize: '12px',
    fontFamily: 'inherit',
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-text)',
    outline: 'none'
  },
  moveBar: {
    padding: '10px 16px',
    borderBottom: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-surface)'
  },
  moveFolderBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    border: '1px solid var(--color-border)',
    borderRadius: '5px',
    fontSize: '11px',
    fontFamily: 'inherit',
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-text)',
    cursor: 'pointer',
    transition: 'border-color 0.15s'
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '7px 12px',
    border: 'none',
    background: 'none',
    color: 'var(--color-text)',
    fontSize: '12px',
    fontFamily: 'inherit',
    cursor: 'pointer',
    borderRadius: '5px',
    transition: 'background-color 0.1s',
    textAlign: 'left'
  }
};
