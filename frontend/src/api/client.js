import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000',
  timeout: 120000,
  headers: { 'Content-Type': 'application/json' },
});

export const uploadDocument = (file, onProgress) => {
  const form = new FormData();
  form.append('file', file);
  return API.post('/documents', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
    },
    timeout: 60000,
  });
};

export const listDocuments = () => API.get('/documents');
export const getDocument   = (id) => API.get(`/documents/${id}`);
export const deleteDocument = (id) => API.delete(`/documents/${id}`);

export const listFacts      = (params) => API.get('/facts', { params });
export const getFact        = (id) => API.get(`/facts/${id}`);
export const getFactEvidence = (id) => API.get(`/facts/${id}/evidence`);
export const listFactTypes  = () => API.get('/fact-types');
export const listExtractionRuns = (limit = 50) =>
  API.get('/extraction-runs', { params: { limit } });

export const listRelationships = (params) => API.get('/relationships', { params });
export const getRelationship   = (id) => API.get(`/relationships/${id}`);

export const healthCheck = () => API.get('/health');

export const pollDocumentUntilDone = (id, intervalMs = 3000, maxMs = 600000) =>
  new Promise((resolve, reject) => {
    const start = Date.now();
    const check = async () => {
      try {
        const { data } = await getDocument(id);
        if (data.status !== 'processing') {
          resolve(data);
          return;
        }
        if (Date.now() - start > maxMs) {
          reject(new Error('Processing timed out after 10 minutes.'));
          return;
        }
        setTimeout(check, intervalMs);
      } catch (err) {
        reject(err);
      }
    };
    check();
  });

export default API;
