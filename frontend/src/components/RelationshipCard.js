import React from 'react';

const RELATION_META = {
  corroborates:          { label: 'Corroborates',          icon: '✓', cls: 'relation-corroborates', arrow: '↔' },
  contradicts:           { label: 'Contradicts',           icon: '✗', cls: 'relation-contradicts',  arrow: '⚡' },
  reconciled_by_context: { label: 'Reconciled by Context', icon: '~', cls: 'relation-reconciled_by_context', arrow: '⇌' },
  unrelated:             { label: 'Unrelated',             icon: '–', cls: 'relation-unrelated',    arrow: '·' },
};

export default function RelationshipCard({ rel, factA, factB, onClick }) {
  const meta = RELATION_META[rel.relation] || RELATION_META.unrelated;

  return (
    <div
      id={`rel-card-${rel.id}`}
      className="rel-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick && onClick()}
      aria-label={`Relationship: ${meta.label}`}
    >
      <div className="rel-card-header">
        <span className={`badge ${meta.cls}`}>
          {meta.icon} {meta.label}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {Math.round((rel.confidence || 0) * 100)}% conf.
        </span>
      </div>

      <div className="rel-facts-grid">
        <div className="fact-mini">
          <div className="fact-mini-subject">{factA?.subject || rel.fact_id_a}</div>
          <div className="fact-mini-value">
            {factA ? `${factA.type}: ${factA.value}${factA.unit ? ' ' + factA.unit : ''}` : rel.fact_id_a}
          </div>
          {factA?.doc_filename && (
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              📄 {factA.doc_filename}
            </div>
          )}
        </div>

        <div className="rel-arrow">
          <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{meta.arrow}</span>
        </div>

        <div className="fact-mini">
          <div className="fact-mini-subject">{factB?.subject || rel.fact_id_b}</div>
          <div className="fact-mini-value">
            {factB ? `${factB.type}: ${factB.value}${factB.unit ? ' ' + factB.unit : ''}` : rel.fact_id_b}
          </div>
          {factB?.doc_filename && (
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              📄 {factB.doc_filename}
            </div>
          )}
        </div>
      </div>

      {rel.reasoning && (
        <div className="rel-reasoning">
          💬 {rel.reasoning.length > 200 ? rel.reasoning.slice(0, 200) + '…' : rel.reasoning}
        </div>
      )}

      {rel.reconciling_factors?.length > 0 && (
        <div className="flex gap-2 mt-2" style={{ flexWrap: 'wrap' }}>
          {rel.reconciling_factors.map((f) => (
            <span key={f} className="badge badge-amber" style={{ fontSize: '0.68rem' }}>{f}</span>
          ))}
        </div>
      )}
    </div>
  );
}
