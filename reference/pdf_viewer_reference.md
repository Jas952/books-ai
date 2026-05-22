# PDF.js Viewer Architecture Reference

This reference documents the correct logic and setup for loading and rendering PDF files in the Books Agent application using Electron, React, Vite, and PDF.js.

## 1. Unified Dependency Versioning

To prevent duplication and conflicts between `pdfjs-dist` versions, ensure that the root `package.json` uses the exact version required by `react-pdf-highlighter`:

- **Target Version**: `pdfjs-dist: 4.4.168`
- **Reason**: `react-pdf-highlighter@8.0.0-rc.0` relies on API patterns from PDF.js v4. Using mismatched versions causes `npm` to install two different copies — one for the root and one nested inside `react-pdf-highlighter/node_modules/`. This results in separate `GlobalWorkerOptions` instances and the dreaded `No "GlobalWorkerOptions.workerSrc" specified` error.

### Import path

Currently we import from the root `pdfjs-dist` (which is deduplicated with `react-pdf-highlighter`'s copy since the versions match):

```javascript
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
```

If you ever see duplicate copies again, fall back to importing from:
```javascript
import { GlobalWorkerOptions, getDocument } from 'react-pdf-highlighter/node_modules/pdfjs-dist';
```

---

## 2. Worker Source Configuration

```javascript
GlobalWorkerOptions.workerSrc = './pdf.worker.min.js';
```

This relies on `pdf.worker.min.js` being available at the root serving path. In the Vite **production build**, the worker is copied to `dist/` via `vite.config.js`. In **dev mode**, Vite serves it from `public/`.

> **IMPORTANT**: Ensure `public/pdf.worker.min.js` exists OR that `vite.config.js` properly resolves the worker path. A missing worker file causes a silent fallback to a fake worker which is then destroyed, producing `Worker was destroyed` errors.

---

## 3. PDF Document Loading Lifecycle

### The React StrictMode Problem

React StrictMode (active in development) double-invokes `useEffect` — it runs the effect, immediately calls cleanup, then runs the effect again. The **old** pattern was:

```javascript
// ❌ BAD: cleanup destroys the loading task
useEffect(() => {
  const loadingTask = getDocument({ data: buffer });
  loadingTask.promise.then(doc => setPdfDocument(doc));
  return () => { loadingTask.destroy(); }; // Kills the task on StrictMode re-run!
}, [buffer]);
```

Combined with `prevBufferRef` deduplication, this meant:
1. First run: `loadingTask` created
2. StrictMode cleanup: `loadingTask.destroy()` — **kills** the worker
3. Second run: `prevBufferRef.current === pdfBuffer` → **early return**, no new task created
4. Result: PDF never loads, `Worker was destroyed` error

### The Correct Pattern

Use a `cancelled` flag instead of destroying the loading task:

```javascript
useEffect(() => {
  if (!pdfBuffer) return;

  let cancelled = false;

  async function loadPdf() {
    // Clean up previous document
    if (activeDocRef.current) {
      try { await activeDocRef.current.destroy(); } catch (_) {}
      activeDocRef.current = null;
    }

    const loadingTask = getDocument({ data: pdfBuffer.slice() });
    try {
      const doc = await loadingTask.promise;
      if (cancelled) {
        doc.destroy().catch(() => {});
        return;
      }
      activeDocRef.current = doc;
      setPdfDocument(doc);
    } catch (err) {
      if (cancelled) return;
      setError(err.message);
    }
  }

  loadPdf();
  return () => { cancelled = true; };
}, [pdfBuffer]);
```

Key points:
- **No `loadingTask.destroy()` in cleanup** — let it complete naturally
- **No `prevBufferRef` deduplication** — React's dependency array already handles this
- **`cancelled` flag** — prevents setting state on unmounted component
- **`activeDocRef`** — tracks the live document for sequential cleanup

---

## 4. TOC Navigation

### The Viewer Timing Problem

`PdfHighlighter` creates its internal `PDFViewer` **asynchronously** via:
```javascript
const pdfjs = await import('pdfjs-dist/web/pdf_viewer.js');
this.viewer = new pdfjs.PDFViewer({ ... });
```

This means `highlighterRef.current.viewer` is `undefined` for a few hundred milliseconds after `pdfDocument` is set and `PdfHighlighter` mounts.

### Solution: Retry with backoff

```javascript
useEffect(() => {
  if (!tocScrollDest?.dest || !pdfDocument) return;

  let retryTimer = null;
  let retries = 0;

  const performScroll = (pageIndex) => {
    const viewer = highlighterRef.current?.viewer;
    if (viewer) {
      viewer.scrollPageIntoView({ pageNumber: pageIndex + 1 });
    } else if (retries < 20) {
      retries++;
      retryTimer = setTimeout(() => performScroll(pageIndex), 100);
    }
  };

  // Resolve destination → page index → scroll
  if (typeof dest === 'string') {
    pdfDocument.getDestination(dest)
      .then(r => r && pdfDocument.getPageIndex(r[0]).then(performScroll));
  } else if (Array.isArray(dest)) {
    pdfDocument.getPageIndex(dest[0]).then(performScroll);
  }

  return () => { if (retryTimer) clearTimeout(retryTimer); };
}, [tocScrollDest, pdfDocument]);
```

### State vs Ref for navigation target

Use **reactive state** (`useState`) for `tocScrollDest`, NOT a ref:
- Refs don't trigger re-renders → `useEffect` won't fire
- Include a `timestamp` field to ensure repeated clicks on the same item still trigger:
  ```javascript
  setTocScrollDest({ dest, timestamp: Date.now() });
  ```

---

## 5. CSS Requirements

The wrapper element around `<PdfHighlighter>` must fill its container:

```css
.pdf-resize-preview-layer {
  height: 100%;
  width: 100%;
  transform-origin: top center;
  will-change: transform;
}
```

Without explicit `height: 100%`, the wrapper collapses to 0px and the PDF is invisible.
