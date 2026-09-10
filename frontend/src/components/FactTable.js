import React from 'react';

function ConfidenceBar({ value }) {
  const pct = Math.round((value || 0) * 100);
  const color = pct >= 80 ? 'var(--accent-green)'
              : pct >= 60 ? 'var(--accent-amber)'
              :             'var(--accent-red)';
  return (
    <div className="confidence-bar-wrap">
      <div className="confidence-bar-track">
        <div className="confidence-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="confidence-val">{pct}%</span>
    </div>
  );
}

export default function FactTable({ facts, onSelectFact, selectedId }) {
  if (!facts || facts.length === 0) return null;

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Subject</th>
            <th>Value</th>
            <th>Unit</th>
            <th>Time Scope</th>
            <th>Confidence</th>
            <th>Page</th>
          </tr>
        </thead>
        <tbody>
          {facts.map((fact) => (
            <tr
              key={fact.id}
              id={`fact-row-${fact.id}`}
              onClick={() => onSelectFact && onSelectFact(fact)}
              style={{
                background: selectedId === fact.id
                  ? 'rgba(59,130,246,0.08)'
                  : undefined,
                borderLeft: selectedId === fact.id
                  ? '2px solid var(--accent-blue)'
                  : '2px solid transparent',
              }}
            >
              <td>
                <span className="badge badge-purple" style={{ fontFamily: 'var(--font-mono)' }}>
                  {fact.type}
                </span>
              </td>
              <td style={{ maxWidth: 180 }}>
                <span className="truncate" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem' }}>
                  {fact.subject}
                </span>
              </td>
              <td>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-cyan)' }}>
                  {fact.value}
                </span>
              </td>
              <td>
                <span className="text-muted text-xs">{fact.unit || '—'}</span>
              </td>
              <td>
                <span className="text-xs" style={{ color: 'var(--accent-amber)' }}>
                  {fact.time_scope || '—'}
                </span>
              </td>
              <td style={{ minWidth: 120 }}>
                <ConfidenceBar value={fact.confidence} />
              </td>
              <td>
                <span className="text-xs text-muted">p.{fact.evidence?.page}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
