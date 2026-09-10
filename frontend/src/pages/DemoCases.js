import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listRelationships, getFact } from '../api/client';

const STATIC_CASES = [
  {
    id: 1,
    title: 'Revenue Corroboration',
    relation: 'corroborates',
    relClass: 'relation-corroborates',
    glow: 'rgba(16,185,129,0.08)',
    description:
      'Two documents report the same revenue figure for the same fiscal year. ' +
      'The LLM identifies the pair as corroborating — both agree on ₹7,225 Cr for FY24.',
    tags: ['revenue', 'FY24', 'agreement'],
    factA: { subject: 'Delhivery Ltd',     type: 'revenue',         value: '7,225', unit: 'INR Cr',   scope: 'FY24' },
    factB: { subject: 'Delhivery Limited', type: 'annual_revenue',  value: '7,225', unit: 'Cr INR',   scope: 'FY2024' },
    reasoning:
      "Both facts report the same entity's revenue for the same fiscal year. " +
      'Minor label differences ("Ltd" vs "Limited", "Cr INR" vs "INR Cr") do not change the underlying claim.',
  },
  {
    id: 2,
    title: 'GDP Growth Contradiction',
    relation: 'contradicts',
    relClass: 'relation-contradicts',
    glow: 'rgba(239,68,68,0.08)',
    description:
      'The Economic Survey projects 6.5 % GDP growth for FY25, while the IMF Article IV projects 6.2 %. ' +
      'The LLM flags this as a genuine contradiction requiring analyst attention.',
    tags: ['GDP', 'growth', 'forecast', 'conflict'],
    factA: { subject: 'India', type: 'gdp_growth_forecast', value: '6.5', unit: '%', scope: 'FY2025' },
    factB: { subject: 'India', type: 'real_gdp_growth',     value: '6.2', unit: '%', scope: 'FY2025' },
    reasoning:
      'Both sources forecast Indian GDP growth for the same period but arrive at different figures ' +
      '(6.5 % vs 6.2 %). Methodological differences between MoF India and IMF do not fully ' +
      'reconcile a 30-basis-point gap in annual growth projections.',
  },
  {
    id: 3,
    title: 'Inflation Reconciled by Time Scope',
    relation: 'reconciled_by_context',
    relClass: 'relation-reconciled_by_context',
    glow: 'rgba(245,158,11,0.08)',
    description:
      'CPI inflation appears as 5.1 % in one document and 4.75 % in another. ' +
      'The LLM reconciles: the first is the FY24 annual average, the second is a point-in-time March 2025 reading.',
    tags: ['CPI', 'inflation', 'time_period', 'reconciled'],
    factA: { subject: 'India', type: 'cpi_inflation', value: '5.1',  unit: '%', scope: 'FY2024 avg' },
    factB: { subject: 'India', type: 'cpi_inflation', value: '4.75', unit: '%', scope: 'March 2025' },
    reasoning:
      'The apparent conflict dissolves when time scope is examined. The 5.1 % figure is the full-year ' +
      'FY24 average, while 4.75 % is the March 2025 point-in-time reading, reflecting disinflation ' +
      'over the intervening period.',
    reconciling: ['time_period', 'measurement_type'],
  },
  {
    id: 4,
    title: 'Extraction Failure — Evidence Span Not Found',
    relation: null,
    relClass: 'badge-gray',
    glow: 'rgba(107,114,128,0.08)',
    description:
      'Some extracted facts have char_start = 0 (fallback span). This happens when the LLM quotes a ' +
      'sentence that does not appear verbatim in the page text — e.g. it paraphrases or merges two sentences.',
    tags: ['failure', 'evidence_location', 'fallback'],
    factA: { subject: 'Delhivery', type: 'delivery_partner_network', value: '~96,000', unit: 'partners', scope: 'FY22 IPO' },
    factB: null,
    reasoning:
      'Handling: the fact is kept with a fallback span (char 0) so the value and raw_text are still ' +
      'searchable and displayable, but the highlight in the Evidence Viewer may not point to the exact ' +
      'location in the page. Next step: apply fuzzy matching (e.g. RapidFuzz) on the first 80 characters ' +
      'of the raw_text to improve span accuracy.',
  },
];

const RELATION_META = {
  corroborates:          { label: 'Corroborates', icon: '✓' },
  contradicts:           { label: 'Contradicts',  icon: '✗' },
  reconciled_by_context: { label: 'Reconciled',   icon: '⇌' },
};

function FactMini({ fact }) {
  if (!fact) return null;
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '10px 12px', fontSize: '0.8rem',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>{fact.subject}</div>
      <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 600 }}>
        {fact.value} {fact.unit}
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
        <span className="badge badge-purple" style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)' }}>{fact.type}</span>
        {fact.scope && <span className="badge badge-amber" style={{ fontSize: '0.68rem' }}>{fact.scope}</span>}
      </div>
    </div>
  );
}

function StaticCaseCard({ c, expanded, onToggle }) {
  const meta = c.relation ? RELATION_META[c.relation] : null;
  return (
    <div
      className="demo-card"
      style={{ '--demo-glow': c.glow, cursor: 'pointer' }}
      id={`demo-case-${c.id}`}
      onClick={onToggle}
    >
      <div className="demo-card-number">Case {String(c.id).padStart(2, '0')}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h3 className="demo-card-title" style={{ margin: 0 }}>{c.title}</h3>
        {meta ? (
          <span className={`badge ${c.relClass}`} style={{ flexShrink: 0, marginLeft: 8 }}>
            {meta.icon} {meta.label}
          </span>
        ) : (
          <span className={`badge ${c.relClass}`} style={{ flexShrink: 0, marginLeft: 8 }}>⚠ Failure</span>
        )}
      </div>

      <p className="demo-card-desc">{c.description}</p>
      <div className="demo-tag-list" style={{ marginBottom: 16 }}>
        {c.tags.map((t) => <span key={t} className="badge badge-gray" style={{ fontSize: '0.68rem' }}>{t}</span>)}
      </div>

      {expanded && (
        <div onClick={(e) => e.stopPropagation()}>
          <div className="divider" />
          {c.factB ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <FactMini fact={c.factA} />
              <div style={{ textAlign: 'center', fontSize: '1.2rem', color: 'var(--text-muted)' }}>⇌</div>
              <FactMini fact={c.factB} />
            </div>
          ) : (
            <div style={{ marginBottom: 14 }}>
              <FactMini fact={c.factA} />
            </div>
          )}
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderLeft: '3px solid var(--accent-purple)', borderRadius: 'var(--radius)',
            padding: '12px 14px', fontSize: '0.82rem', color: 'var(--text-secondary)',
            lineHeight: 1.7, marginBottom: 12,
          }}>
            💬 {c.reasoning}
          </div>
          {c.reconciling && (
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              {c.reconciling.map((f) => (
                <span key={f} className="badge badge-amber" style={{ fontSize: '0.7rem' }}>⚙ {f}</span>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--accent-blue)', fontWeight: 600, textAlign: 'right' }}>
        {expanded ? 'Collapse ↑' : 'Expand ↓'}
      </div>
    </div>
  );
}

function LiveRelCard({ rel, factA, factB }) {
  const [open, setOpen] = useState(false);
  const meta = RELATION_META[rel.relation];
  const relClass = {
    corroborates: 'relation-corroborates',
    contradicts: 'relation-contradicts',
    reconciled_by_context: 'relation-reconciled_by_context',
  }[rel.relation] || 'badge-gray';

  return (
    <div
      className="demo-card"
      style={{ cursor: 'pointer' }}
      onClick={() => setOpen((v) => !v)}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span className={`badge ${relClass}`}>{meta?.icon} {meta?.label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {Math.round((rel.confidence || 0) * 100)}% conf.
        </span>
      </div>

      <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>
        {factA?.subject || rel.fact_id_a}
        <span style={{ color: 'var(--text-muted)', fontWeight: 400, margin: '0 8px' }}>↔</span>
        {factB?.subject || rel.fact_id_b}
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>
        {rel.reasoning?.slice(0, 180)}{rel.reasoning?.length > 180 ? '…' : ''}
      </p>

      {open && (
        <div onClick={(e) => e.stopPropagation()}>
          <div className="divider" />
          {factA && factB && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 12px', fontSize: '0.8rem' }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{factA.subject}</div>
                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{factA.value} {factA.unit}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>{factA.type} · {factA.time_scope || '—'}</div>
              </div>
              <div style={{ textAlign: 'center', fontSize: '1.2rem', color: 'var(--text-muted)' }}>⇌</div>
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 12px', fontSize: '0.8rem' }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{factB.subject}</div>
                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{factB.value} {factB.unit}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>{factB.type} · {factB.time_scope || '—'}</div>
              </div>
            </div>
          )}
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderLeft: '3px solid var(--accent-purple)', borderRadius: 'var(--radius)',
            padding: '12px 14px', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.7,
          }}>
            💬 {rel.reasoning}
          </div>
          {rel.reconciling_factors?.length > 0 && (
            <div className="flex gap-2 mt-2" style={{ flexWrap: 'wrap' }}>
              {rel.reconciling_factors.map((f) => (
                <span key={f} className="badge badge-amber" style={{ fontSize: '0.7rem' }}>⚙ {f}</span>
              ))}
            </div>
          )}
          {(factA?.raw_text || factB?.raw_text) && (
            <div style={{ marginTop: 12 }}>
              {factA?.raw_text && (
                <div style={{ background: 'var(--bg-elevated)', borderLeft: '3px solid var(--accent-cyan)', borderRadius: '0 var(--radius) var(--radius) 0', padding: '8px 12px', fontSize: '0.76rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
                  📄 A: "{factA.raw_text}"
                </div>
              )}
              {factB?.raw_text && (
                <div style={{ background: 'var(--bg-elevated)', borderLeft: '3px solid var(--accent-purple)', borderRadius: '0 var(--radius) var(--radius) 0', padding: '8px 12px', fontSize: '0.76rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  📄 B: "{factB.raw_text}"
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--accent-blue)', fontWeight: 600, textAlign: 'right' }}>
        {open ? 'Collapse ↑' : 'Expand ↓'}
      </div>
    </div>
  );
}

function LiveTab() {
  const [rels, setRels]       = useState({});
  const [factsMap, setFactsMap] = useState({});
  const [loading, setLoading]  = useState(true);
  const [error, setError]      = useState('');

  useEffect(() => {
    (async () => {
      try {
        const types = ['corroborates', 'contradicts', 'reconciled_by_context'];
        const results = await Promise.all(
          types.map((t) => listRelationships({ relation: t, limit: 10 }))
        );
        const grouped = {};
        const ids = new Set();
        types.forEach((t, i) => {
          grouped[t] = results[i].data;
          results[i].data.forEach((r) => { ids.add(r.fact_id_a); ids.add(r.fact_id_b); });
        });
        setRels(grouped);

        if (ids.size > 0) {
          const fetched = await Promise.allSettled([...ids].map((id) => getFact(id)));
          const fm = {};
          fetched.forEach((r, i) => {
            if (r.status === 'fulfilled') fm[[...ids][i]] = r.value.data;
          });
          setFactsMap(fm);
        }
      } catch (e) {
        setError('Could not load live data. Upload PDFs to generate relationships.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="loading-state"><div className="spinner" /><p className="mt-3 text-muted">Loading live relationships…</p></div>;

  if (error || Object.values(rels).every((arr) => arr.length === 0)) {
    return (
      <div className="empty-state">
        <div className="empty-icon">⇌</div>
        <h3 style={{ fontWeight: 600, marginBottom: 6 }}>No live data yet</h3>
        <p className="text-muted text-sm">Upload the starter dataset PDFs and the system will populate this view automatically.</p>
        <Link to="/documents" className="btn btn-primary mt-3" style={{ display: 'inline-flex', marginTop: 12 }}>Go to Documents →</Link>
      </div>
    );
  }

  const SECTIONS = [
    { key: 'corroborates',          label: '✓ Corroborating Facts',         cls: 'relation-corroborates' },
    { key: 'contradicts',           label: '✗ Contradictions',               cls: 'relation-contradicts' },
    { key: 'reconciled_by_context', label: '⇌ Reconciled by Context',       cls: 'relation-reconciled_by_context' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {SECTIONS.map(({ key, label, cls }) => (
        rels[key]?.length > 0 && (
          <div key={key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span className={`badge ${cls}`} style={{ fontSize: '0.8rem', padding: '5px 14px' }}>{label}</span>
              <span className="text-xs text-muted">{rels[key].length} found</span>
            </div>
            <div className="demo-grid">
              {rels[key].map((rel) => (
                <LiveRelCard
                  key={rel.id}
                  rel={rel}
                  factA={factsMap[rel.fact_id_a] || null}
                  factB={factsMap[rel.fact_id_b] || null}
                />
              ))}
            </div>
          </div>
        )
      ))}
    </div>
  );
}

export default function DemoCases() {
  const [tab, setTab]         = useState('static');
  const [expanded, setExpanded] = useState(null);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><span>◉</span> Demo Cases</h1>
        <p className="page-subtitle">
          Four required scenarios — plus a Live Data view of real extracted relationships.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {[
          { key: 'static', label: '📋 Reference Cases' },
          { key: 'live',   label: '⚡ Live Data' },
        ].map(({ key, label }) => (
          <button
            key={key}
            id={`demo-tab-${key}`}
            onClick={() => setTab(key)}
            style={{
              padding: '8px 18px', borderRadius: 'var(--radius)',
              border: tab === key ? '1px solid var(--accent-blue)' : '1px solid var(--border)',
              background: tab === key ? 'rgba(59,130,246,0.12)' : 'var(--bg-elevated)',
              color: tab === key ? 'var(--accent-blue)' : 'var(--text-secondary)',
              fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
              transition: 'all var(--transition)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'static' ? (
        <>
          <div style={{
            background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 'var(--radius-lg)', padding: '14px 18px', marginBottom: 28,
            display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.875rem',
          }}>
            <span style={{ fontSize: '1.2rem' }}>💡</span>
            <div>
              <strong>Try it live:</strong> Upload the PDFs from <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: 4 }}>starter-datasets/</code> then
              switch to the <strong>Live Data</strong> tab to see these exact patterns in real extracted data.
            </div>
          </div>
          <div className="demo-grid">
            {STATIC_CASES.map((c) => (
              <StaticCaseCard
                key={c.id}
                c={c}
                expanded={expanded === c.id}
                onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
              />
            ))}
          </div>
        </>
      ) : (
        <LiveTab />
      )}
    </div>
  );
}
