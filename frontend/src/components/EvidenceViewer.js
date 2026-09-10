import React from 'react';

export default function EvidenceViewer({ rawText, evidence }) {
  if (!rawText) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No source quote available.</p>;
  }

  return (
    <div>
      <div className="evidence-block">
        <span className="evidence-highlight">{rawText}</span>
      </div>
      {evidence && (
        <div style={{ marginTop: 6, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Page {evidence.page}
          {evidence.char_start != null && (
            <span style={{ fontFamily: 'var(--font-mono)', marginLeft: 8 }}>
              chars {evidence.char_start}–{evidence.char_end}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
