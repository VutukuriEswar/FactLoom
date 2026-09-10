import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listDocuments, listFacts, listRelationships, listExtractionRuns } from '../api/client';
import UploadForm from '../components/UploadForm';

function StatCard({ label, value, accent, icon }) {
  return (
    <div className="stat-card" style={{ '--stat-accent': accent }}>
      <div className="stat-card-icon" style={{ background: `${accent.split(',')[0].replace('linear-gradient(135deg', '').trim()}22` }}>
        <span style={{ fontSize: '1.2rem' }}>{icon}</span>
      </div>
      <div className="stat-card-value">{value ?? '—'}</div>
      <div className="stat-card-label">{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats]       = useState(null);
  const [docs, setDocs]         = useState([]);
  const [runs, setRuns]         = useState([]);
  const [loading, setLoading]   = useState(true);

  const load = async () => {
    try {
      const [docsRes, runsRes, allFacts, allRels] = await Promise.all([
        listDocuments(),
        listExtractionRuns(5),
        listFacts({}),
        listRelationships({ limit: 200 }),
      ]);
      setDocs(docsRes.data.slice(0, 4));
      setRuns(runsRes.data);
      setStats({
        documents: docsRes.data.length,
        facts: allFacts.data.length,
        relationships: allRels.data.length,
        contradictions: allRels.data.filter((r) => r.relation === 'contradicts').length,
      });
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const anyProcessing = docs.some((d) => d.status === 'processing');
    if (!anyProcessing) return;
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [docs]);

  const handleUploadSuccess = () => { load(); };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-dots">
          <div className="loading-dot" /><div className="loading-dot" /><div className="loading-dot" />
        </div>
        <p>Loading FactLoom…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <span>◈</span> Dashboard
        </h1>
        <p className="page-subtitle">
          Ingest documents, extract grounded facts, and analyse cross-document relationships.
        </p>
      </div>

      <div className="stat-grid">
        <StatCard label="Documents"     value={stats?.documents}     icon="⬡" accent="linear-gradient(135deg,#3b82f6,#06b6d4)" />
        <StatCard label="Facts"         value={stats?.facts}         icon="◆" accent="linear-gradient(135deg,#8b5cf6,#6366f1)" />
        <StatCard label="Relationships" value={stats?.relationships} icon="⇌" accent="linear-gradient(135deg,#10b981,#06b6d4)" />
        <StatCard label="Contradictions" value={stats?.contradictions} icon="⚡" accent="linear-gradient(135deg,#ef4444,#f59e0b)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        <div>
          <div className="card mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 style={{ fontWeight: 700, fontSize: '1rem' }}>Recent Documents</h2>
              <Link to="/documents" className="text-xs" style={{ color: 'var(--accent-blue)' }}>View all →</Link>
            </div>
            {docs.length === 0 ? (
              <p className="text-muted text-sm">No documents yet — upload your first PDF.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {docs.map((doc) => (
                  <div key={doc.id} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '10px 14px',
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {doc.filename}
                      </div>
                      <div className="text-xs text-muted mt-1">
                        {doc.fact_count} facts · {doc.page_count} pages
                      </div>
                    </div>
                    <span className={`badge status-${doc.status}`}>{doc.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {runs.length > 0 && (
            <div className="card">
              <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 12 }}>Recent Extraction Runs</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {runs.map((run) => (
                  <div key={run.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    fontSize: '0.82rem',
                  }}>
                    <div>
                      <span style={{ fontWeight: 600, display: 'block', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 300 }}>
                        {run.doc_filename}
                      </span>
                      <span className="text-muted text-xs">
                        {run.facts_extracted} facts · {run.relationships_created} relations
                      </span>
                    </div>
                    <span className={`badge status-${run.status}`}>{run.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card" style={{ position: 'sticky', top: 72 }}>
          <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 16 }}>Upload Document</h2>
          <UploadForm onSuccess={handleUploadSuccess} />

          <div className="divider" />

          <div className="section-label" style={{ marginBottom: 8 }}>Quick Navigation</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { to: '/documents',     label: 'All Documents',    desc: 'Browse uploaded PDFs' },
              { to: '/facts',         label: 'Facts Explorer',   desc: 'Search & filter facts' },
              { to: '/relationships', label: 'Relationships',    desc: 'View cross-doc links' },
              { to: '/demo',          label: 'Demo Cases',       desc: 'Example scenarios' },
            ].map(({ to, label, desc }) => (
              <Link key={to} to={to} style={{
                display: 'block',
                padding: '8px 12px',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                textDecoration: 'none',
                transition: 'all var(--transition)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-blue)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{label}</div>
                <div className="text-xs text-muted">{desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
