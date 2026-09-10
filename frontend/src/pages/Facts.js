import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listFacts, listDocuments, listFactTypes } from '../api/client';
import FactTable from '../components/FactTable';
import FactDetailDrawer from '../components/FactDetailDrawer';

export default function Facts() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [facts, setFacts]           = useState([]);
  const [docs, setDocs]             = useState([]);
  const [factTypes, setFactTypes]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selectedFact, setSelected] = useState(null);

  const [docFilter, setDocFilter]   = useState(searchParams.get('doc_id') || '');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type')   || '');
  const [search, setSearch]         = useState(searchParams.get('search') || '');

  useEffect(() => {
    Promise.all([listDocuments(), listFactTypes()])
      .then(([d, t]) => { setDocs(d.data); setFactTypes(t.data); })
      .catch(console.error);
  }, []);

  const loadFacts = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (docFilter)  params.doc_id = docFilter;
      if (typeFilter) params.type   = typeFilter;
      if (search)     params.search = search;

      const { data } = await listFacts(params);
      setFacts(data);

      const next = {};
      if (docFilter)  next.doc_id = docFilter;
      if (typeFilter) next.type   = typeFilter;
      if (search)     next.search = search;
      setSearchParams(next, { replace: true });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [docFilter, typeFilter, search, setSearchParams]);

  useEffect(() => { loadFacts(); }, [loadFacts]);

  const currentDoc = docs.find((d) => d.id === docFilter);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <span>◆</span> Facts
          {currentDoc && (
            <span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 8 }}>
              — {currentDoc.filename}
            </span>
          )}
        </h1>
        <p className="page-subtitle">
          {loading ? 'Loading…' : `${facts.length} fact${facts.length !== 1 ? 's' : ''} found`}
        </p>
      </div>

      <div className="filter-bar">
        <select
          id="fact-doc-filter"
          className="select"
          style={{ minWidth: 220 }}
          value={docFilter}
          onChange={(e) => { setDocFilter(e.target.value); setSelected(null); }}
        >
          <option value="">All Documents</option>
          {docs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.filename} ({d.fact_count})
            </option>
          ))}
        </select>

        <select
          id="fact-type-filter"
          className="select"
          style={{ minWidth: 180 }}
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setSelected(null); }}
        >
          <option value="">All Types</option>
          {factTypes.map((t) => (
            <option key={t.id} value={t.type_name}>{t.type_name}</option>
          ))}
        </select>

        <input
          id="fact-search-input"
          className="input"
          style={{ maxWidth: 260 }}
          placeholder="Search subject, value, text…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadFacts()}
        />

        {(docFilter || typeFilter || search) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setDocFilter(''); setTypeFilter(''); setSearch(''); setSelected(null); }}
          >
            ✕ Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p className="mt-3 text-muted">Fetching facts…</p>
        </div>
      ) : facts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">◆</div>
          <h3 style={{ fontWeight: 600, marginBottom: 6 }}>No facts found</h3>
          <p className="text-muted text-sm">Try adjusting the filters or upload a document first.</p>
        </div>
      ) : (
        <FactTable
          facts={facts}
          onSelectFact={setSelected}
          selectedId={selectedFact?.id}
        />
      )}

      {selectedFact && (
        <FactDetailDrawer
          fact={selectedFact}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
