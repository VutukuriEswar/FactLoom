import React, { useEffect, useState } from 'react';
import EvidenceViewer from './EvidenceViewer';
import { getFactEvidence } from '../api/client';

export default function FactDetailDrawer({ fact, onClose }) {
  const [evidence, setEvidence] = useState(null);
  const [loadingEvidence, setLoadingEvidence] = useState(false);

  useEffect(() => {
    if (!fact) return;
    setEvidence(null);
    setLoadingEvidence(true);
    getFactEvidence(fact.id)
      .then((r) => setEvidence(r.data))
      .catch(() => setEvidence(null))
      .finally(() => setLoadingEvidence(false));
  }, [fact]);

  if (!fact) return null;

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer" id="fact-detail-drawer" aria-label="Fact detail">
        <div className="drawer-header">
          <div>
            <span className="badge badge-purple" style={{ fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
              {fact.type}
            </span>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: 6 }}>{fact.subject}</div>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Close detail panel">✕</button>
        </div>

        <div className="drawer-body">
          <div className="card-glass mb-4" style={{ padding: '14px 16px' }}>
            <div className="section-label">Extracted Value</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
              {fact.value}
              {fact.unit && <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginLeft: 8 }}>{fact.unit}</span>}
            </div>
            {fact.time_scope && (
              <div className="text-xs text-muted mt-1">
                📅 {fact.time_scope}
              </div>
            )}
          </div>

          <div className="mb-4">
            <div className="section-label">Confidence</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <div style={{ flex: 1, height: 6, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.round(fact.confidence * 100)}%`,
                  background: 'linear-gradient(90deg, var(--accent-green), var(--accent-cyan))',
                  borderRadius: 99,
                }} />
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 600 }}>
                {Math.round(fact.confidence * 100)}%
              </span>
            </div>
          </div>

          <div className="mb-4">
            <div className="section-label">Evidence Location</div>
            <div className="flex gap-2 mt-1" style={{ flexWrap: 'wrap' }}>
              <span className="badge badge-blue">Page {fact.evidence?.page}</span>
              <span className="badge badge-gray" style={{ fontFamily: 'var(--font-mono)' }}>
                chars {fact.evidence?.char_start}–{fact.evidence?.char_end}
              </span>
            </div>
          </div>

          <div className="mb-4">
            <div className="section-label">Source Quote</div>
            <div className="mt-1">
              {loadingEvidence ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '12px 0' }}>
                  Loading evidence…
                </div>
              ) : (
                <EvidenceViewer rawText={fact.raw_text} evidence={evidence} />
              )}
            </div>
          </div>

          <div>
            <div className="section-label">Fact ID</div>
            <code style={{
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              wordBreak: 'break-all',
            }}>
              {fact.id}
            </code>
          </div>
        </div>
      </aside>
    </>
  );
}
