import React, { useEffect, useState, useCallback } from 'react';
import { listRelationships, getRelationship, getFact } from '../api/client';
import RelationshipCard from '../components/RelationshipCard';
import ReasoningPanel from '../components/ReasoningPanel';

const RELATION_TYPES = [
  { value: '',                      label: 'All Relations' },
  { value: 'corroborates',          label: '✓  Corroborates' },
  { value: 'contradicts',           label: '✗  Contradicts' },
  { value: 'reconciled_by_context', label: '⇌  Reconciled by Context' },
  { value: 'unrelated',             label: '–  Unrelated' },
];

const RELATION_META = {
  corroborates:          { cls: 'relation-corroborates' },
  contradicts:           { cls: 'relation-contradicts' },
  reconciled_by_context: { cls: 'relation-reconciled_by_context' },
  unrelated:             { cls: 'relation-unrelated' },
};

export default function Relationships() {
  const [rels, setRels]           = useState([]);
  const [factsMap, setFactsMap]   = useState({});
  const [filter, setFilter]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const counts = rels.reduce((acc, r) => {
    acc[r.relation] = (acc[r.relation] || 0) + 1;
    return acc;
  }, {});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (filter) params.relation = filter;
      const { data } = await listRelationships(params);
      setRels(data);

      const ids = new Set();
      data.forEach((r) => { ids.add(r.fact_id_a); ids.add(r.fact_id_b); });

      const uncached = [...ids].filter((id) => !factsMap[id]);
      if (uncached.length > 0) {
        const results = await Promise.allSettled(uncached.map((id) => getFact(id)));
        const newEntries = {};
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') newEntries[uncached[i]] = r.value.data;
        });
        setFactsMap((prev) => ({ ...prev, ...newEntries }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (rel) => {
    setLoadingDetail(true);
    try {
      const { data } = await getRelationship(rel.id);
      setSelected(data);
    } catch {
      setSelected({ relationship: rel, fact_a: factsMap[rel.fact_id_a] || null, fact_b: factsMap[rel.fact_id_b] || null });
    } finally {
      setLoadingDetail(false);
    }
  };

  const displayed = filter ? rels.filter((r) => r.relation === filter) : rels;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><span>⇌</span> Relationships</h1>
        <p className="page-subtitle">Cross-document fact relationships detected by the LLM</p>
      </div>

      {!loading && rels.length > 0 && (
        <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
          {Object.entries(counts).map(([rel, cnt]) => (
            <button
              key={rel}
              id={`rel-filter-${rel}`}
              className={`badge ${RELATION_META[rel]?.cls || ''}`}
              style={{ cursor: 'pointer', padding: '6px 14px', fontSize: '0.8rem', border: filter === rel ? '2px solid currentColor' : undefined }}
              onClick={() => setFilter(filter === rel ? '' : rel)}
            >
              {rel.replace(/_/g, ' ')} · {cnt}
            </button>
          ))}
          {filter && (
            <button className="badge badge-gray" style={{ cursor: 'pointer' }} onClick={() => setFilter('')}>
              Show all
            </button>
          )}
        </div>
      )}

      <div className="filter-bar">
        <select
          id="rel-type-filter"
          className="select"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ minWidth: 220 }}
        >
          {RELATION_TYPES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <span className="text-sm text-muted">
          {displayed.length} relationship{displayed.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p className="mt-3 text-muted">Loading relationships…</p>
        </div>
      ) : displayed.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">⇌</div>
          <h3 style={{ fontWeight: 600, marginBottom: 6 }}>No relationships yet</h3>
          <p className="text-muted text-sm">
            Upload at least two documents — relationships are detected automatically.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {displayed.map((rel) => (
            <RelationshipCard
              key={rel.id}
              rel={rel}
              factA={factsMap[rel.fact_id_a] || null}
              factB={factsMap[rel.fact_id_b] || null}
              onClick={() => openDetail(rel)}
            />
          ))}
        </div>
      )}

      {loadingDetail && (
        <div className="drawer-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" />
        </div>
      )}

      {selected && !loadingDetail && (
        <ReasoningPanel
          relationship={selected.relationship}
          factA={selected.fact_a}
          factB={selected.fact_b}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
