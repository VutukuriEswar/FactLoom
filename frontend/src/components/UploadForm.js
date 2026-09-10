import React, { useCallback, useRef, useState } from 'react';
import { uploadDocument, pollDocumentUntilDone } from '../api/client';

export default function UploadForm({ onSuccess }) {
  const [dragging, setDragging]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [status, setStatus]       = useState('');
  const [error, setError]         = useState('');
  const fileRef  = useRef(null);
  const tickerRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.name.endsWith('.pdf')) {
      setError('Only PDF files are supported.');
      return;
    }

    setError('');
    setUploading(true);
    setProgress(5);
    setStatus(`Uploading ${file.name}…`);

    let fake = 10;
    tickerRef.current = setInterval(() => {
      fake = Math.min(85, fake + 1.5);
      setProgress(Math.round(fake));
    }, 800);

    try {
      setProgress(10);
      const { data: doc } = await uploadDocument(file, (pct) => {
        setProgress(Math.max(10, Math.min(25, 10 + pct * 0.15)));
      });

      setStatus(`File uploaded — extracting facts from "${doc.filename}"…`);
      setProgress(30);

      const finalDoc = await pollDocumentUntilDone(doc.id, 3000, 600000);

      clearInterval(tickerRef.current);
      tickerRef.current = null;
      setProgress(100);

      if (finalDoc.status === 'failed') {
        setError(`Extraction failed: ${finalDoc.error_message || 'Unknown error'}`);
        setStatus('');
      } else {
        setStatus(`Done! Extracted ${finalDoc.fact_count} facts from "${finalDoc.filename}".`);
        if (onSuccess) onSuccess(finalDoc);
      }
    } catch (err) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
      setProgress(0);
      const msg = err?.response?.data?.detail || err.message || 'Upload failed.';
      setError(msg);
      setStatus('');
    } finally {
      setUploading(false);
    }
  }, [onSuccess]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const onFileChange = (e) => handleFile(e.target.files[0]);

  return (
    <div>
      <div
        id="upload-drop-zone"
        className={`upload-zone ${dragging ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
        onClick={() => !uploading && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        aria-label="Drop PDF here or click to browse"
        onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={onFileChange}
          id="pdf-file-input"
        />

        <div className="upload-icon">
          {uploading
            ? <span style={{ fontSize: '1.4rem', animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
            : <span style={{ fontSize: '1.4rem' }}>⬆</span>
          }
        </div>

        {uploading ? (
          <div>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>{status}</p>
            <p className="text-xs text-muted">
              {progress < 30
                ? 'Uploading file to server…'
                : 'LLM extracting facts — this takes 1–5 minutes for large PDFs.'}
            </p>
          </div>
        ) : (
          <div>
            <p style={{ fontWeight: 600 }}>Drop a PDF here or click to browse</p>
            <p className="text-xs text-muted mt-1">Supports PDFs up to 50 MB · text-based only</p>
          </div>
        )}

        {uploading && (
          <div className="progress-bar" style={{ marginTop: 16, width: '100%' }}>
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      {error && (
        <div style={{
          marginTop: 12, padding: '10px 14px',
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 'var(--radius)', color: 'var(--accent-red)', fontSize: '0.85rem',
        }}>
          ⚠ {error}
        </div>
      )}

      {!uploading && status && !error && (
        <div style={{
          marginTop: 12, padding: '10px 14px',
          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
          borderRadius: 'var(--radius)', color: 'var(--accent-green)', fontSize: '0.85rem',
        }}>
          ✓ {status}
        </div>
      )}
    </div>
  );
}
