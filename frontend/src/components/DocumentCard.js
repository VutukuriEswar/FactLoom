import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteDocument } from '../api/client';

const STATUS_LABELS = {
  done:       { label: 'Done',       cls: 'status-done' },
  processing: { label: 'Processing', cls: 'status-processing' },
  pending:    { label: 'Pending',    cls: 'status-pending' },
  failed:     { label: 'Failed',     cls: 'status-failed' },
};

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default function DocumentCard({ doc, onDeleted }) {
  const navigate = useNavigate();
  const { label, cls } = STATUS_LABELS[doc.status] || STATUS_LABELS.pending;
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${doc.filename}" and all its facts?`)) return;
    setDeleting(true);
    try {
      await deleteDocument(doc.id);
      if (onDeleted) onDeleted(doc.id);
    } catch (err) {
      alert('Delete failed: ' + (err?.response?.data?.detail || err.message));
      setDeleting(false);
    }
  };

  const isProcessing = doc.status === 'processing';

  return (
    <div
      id={`doc-card-${doc.id}`}
      className="card"
      style={{ cursor: 'pointer', opacity: deleting ? 0.5 : 1, transition: 'opacity 0.2s' }}
      onClick={() => !isProcessing && navigate(`/facts?doc_id=${doc.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && !isProcessing && navigate(`/facts?doc_id=${doc.id}`)}
      aria-label={`View facts for ${doc.filename}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`badge ${cls}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isProcessing && (
            <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: '0.7rem' }}>⟳</span>
          )}
          {label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="text-xs text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
            {doc.page_count} pg
          </span>
          <button
            id={`doc-delete-${doc.id}`}
            onClick={handleDelete}
            disabled={deleting}
            title="Delete document"
            style={{
              background: 'transparent',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent-red)',
              cursor: 'pointer',
              padding: '2px 7px',
              fontSize: '0.7rem',
              transition: 'all var(--transition)',
              opacity: deleting ? 0.5 : 1,
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.12)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            ✕
          </button>
        </div>
      </div>

      <p
        style={{
          fontWeight: 700, fontSize: '0.9rem', marginBottom: 8,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4,
        }}
        title={doc.filename}
      >
        {doc.filename}
      </p>

      <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
            {isProcessing ? <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>…</span> : doc.fact_count}
          </div>
          <div className="text-xs text-muted">Facts</div>
        </div>
        <div style={{ width: 1, height: 32, background: 'var(--border)' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            {doc.page_count}
          </div>
          <div className="text-xs text-muted">Pages</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">{fmtDate(doc.uploaded_at)}</span>
        {isProcessing ? (
          <span className="text-xs text-muted" style={{ fontStyle: 'italic' }}>Extracting…</span>
        ) : (
          <span className="text-xs" style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>
            View facts →
          </span>
        )}
      </div>

      {doc.error_message && (
        <div style={{
          marginTop: 10, padding: '6px 10px',
          background: 'rgba(239,68,68,0.1)', borderRadius: 'var(--radius-sm)',
          fontSize: '0.75rem', color: 'var(--accent-red)',
        }}>
          {doc.error_message}
        </div>
      )}
    </div>
  );
}
