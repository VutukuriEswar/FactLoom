import React, { useEffect, useState } from 'react';
import { listDocuments } from '../api/client';
import DocumentCard from '../components/DocumentCard';
import UploadForm from '../components/UploadForm';

export default function Documents() {
  const [docs, setDocs]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await listDocuments();
      setDocs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const anyProcessing = docs.some((d) => d.status === 'processing');
    if (!anyProcessing) return;
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [docs]);

  const handleDeleted = (id) => setDocs((prev) => prev.filter((d) => d.id !== id));
  const handleUploadSuccess = () => { load(); setShowUpload(false); };

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title"><span>⬡</span> Documents</h1>
          <p className="page-subtitle">{docs.length} document{docs.length !== 1 ? 's' : ''} ingested</p>
        </div>
        <button
          id="toggle-upload-btn"
          className="btn btn-primary"
          onClick={() => setShowUpload((v) => !v)}
        >
          {showUpload ? '✕ Cancel' : '+ Upload PDF'}
        </button>
      </div>

      {showUpload && (
        <div className="card mb-4">
          <h2 style={{ fontWeight: 700, marginBottom: 16, fontSize: '0.95rem' }}>New Document</h2>
          <UploadForm onSuccess={handleUploadSuccess} />
        </div>
      )}

      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p className="mt-3 text-muted">Loading documents…</p>
        </div>
      ) : docs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">⬡</div>
          <h3 style={{ fontWeight: 600, marginBottom: 6 }}>No documents yet</h3>
          <p className="text-muted text-sm">Upload a PDF to extract facts and discover relationships.</p>
          <button className="btn btn-primary mt-3" onClick={() => setShowUpload(true)}>
            Upload your first PDF
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {docs.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} onDeleted={handleDeleted} />
          ))}
        </div>
      )}
    </div>
  );
}
