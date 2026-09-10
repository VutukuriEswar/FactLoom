import React from 'react';

const RELATION_META = {
  corroborates:          { label: 'Corroborates',          cls: 'relation-corroborates' },
  contradicts:           { label: 'Contradicts',           cls: 'relation-contradicts' },
  reconciled_by_context: { label: 'Reconciled by Context', cls: 'relation-reconciled_by_context' },
  unrelated:             { label: 'Unrelated',             cls: 'relation-unrelated' },
};

export default function ReasoningPanel({ relationship, factA, factB, onClose }) {
  if (!relationship) return null;
  const meta = RELATION_META[relationship.relation] || RELATION_META.unrelated;

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer" id="reasoning-panel" aria-label="Relationship reasoning">
        <div className="drawer-header">
          <div>
            <span className={`badge ${meta.cls}`}>{meta.label}</span>
            <div style={{ fontWeight: 700, marginTop: 6, fontSize: '0.95rem' }}>
              Relationship Analysis
            </div>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="drawer-body">
          <div className="mb-4">
            <div className="section-label">Confidence</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <div style={{ flex: 1, height: 6, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.round((relationship.confidence || 0) * 100)}%`,
                  background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-purple))',
                  borderRadius: 99,
                }} />
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 600 }}>
                {Math.round((relationship.confidence || 0) * 100)}%
              </span>
            </div>
          </div>

          <div className="mb-4">
            <div className="section-label">Claude's Reasoning</div>
            <div style={{
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius)',
              padding: '14px 16px',
              fontSize: '0.875rem',
              lineHeight: 1.7,
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              marginTop: 8,
              borderLeft: '3px solid var(--accent-purple)',
            }}>
              {relationship.reasoning}
            </div>
          </div>

          {relationship.reconciling_factors?.length > 0 && (
            <div className="mb-4">
              <div className="section-label">Reconciling Factors</div>
              <div className="flex gap-2 mt-2" style={{ flexWrap: 'wrap' }}>
                {relationship.reconciling_factors.map((f) => (
                  <span key={f} className="badge badge-amber">{f}</span>
                ))}
              </div>
            </div>
          )}

          <div className="divider" />

          <div className="mb-3">
            <div className="section-label">Fact A</div>
            <FactDetail fact={factA} accentColor="var(--accent-cyan)" />
          </div>

          <div>
            <div className="section-label">Fact B</div>
            <FactDetail fact={factB} accentColor="var(--accent-purple)" />
          </div>
        </div>
      </aside>
    </>
  );
}

function FactDetail({ fact, accentColor }) {
  if (!fact) return <p className="text-muted text-sm">Fact data unavailable.</p>;
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      borderRadius: 'var(--radius)',
      padding: '14px 16px',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${accentColor}`,
      marginTop: 8,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{fact.subject}</div>
      <div className="flex gap-2 mb-2" style={{ flexWrap: 'wrap' }}>
        <span className="badge badge-purple" style={{ fontFamily: 'var(--font-mono)' }}>{fact.type}</span>
        <span className="badge badge-cyan" style={{ fontFamily: 'var(--font-mono)' }}>
          {fact.value}{fact.unit ? ' ' + fact.unit : ''}
        </span>
        {fact.time_scope && <span className="badge badge-amber">{fact.time_scope}</span>}
      </div>
      <div className="evidence-block" style={{ marginTop: 8, fontSize: '0.78rem' }}>
        {fact.raw_text}
      </div>
      {fact.doc_filename && (
        <div className="text-xs text-muted mt-2">📄 {fact.doc_filename}</div>
      )}
    </div>
  );
}
