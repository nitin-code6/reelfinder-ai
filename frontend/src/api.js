import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const downloadExport = (format, params = {}) => 
  api.get(`/api/export/${format}`, { params, responseType: 'blob' });

export const getHealth = () => api.get('/api/health');

export const getShows = () => api.get('/api/shows/');
export const createShow = (data) => api.post('/api/shows/', data);
export const getShow = (id) => api.get(`/api/shows/${id}`);
export const deleteShow = (id) => api.delete(`/api/shows/${id}`);
export const clearShow = (id) => api.post(`/api/shows/${id}/clear`);
export const resetAllData = () => api.post('/api/shows/reset-all-data');
export const processAllEpisodes = (showId) => api.post(`/api/shows/${showId}/process-all`);

export const getEpisodes = (showId) => api.get(`/api/episodes/?show_id=${showId}`);
export const getEpisode = (id) => api.get(`/api/episodes/${id}`);
export const inspectEpisode = (id) => api.get(`/api/episodes/${id}/inspection`);
export const processEpisode = (id) => api.post(`/api/episodes/${id}/process`);

export function getErrorMessage(err, fallback = 'An unexpected error occurred') {
  if (!err) return fallback;
  const detail = err.response?.data?.detail;
  let rawMsg = '';
  if (typeof detail === 'string') {
    rawMsg = detail;
  } else if (Array.isArray(detail)) {
    rawMsg = detail.map(item => item?.msg || (typeof item === 'object' ? JSON.stringify(item) : String(item))).join(', ');
  } else if (detail && typeof detail === 'object') {
    rawMsg = detail.msg || JSON.stringify(detail);
  } else {
    rawMsg = err.response?.data?.message || err.message || fallback;
  }

  // Detect rate limits, token exhaustion, or missing API keys and format friendly message
  const lower = rawMsg.toLowerCase();
  if (
    lower.includes('rate limit') ||
    lower.includes('429') ||
    lower.includes('tokens per minute') ||
    lower.includes('quota') ||
    lower.includes('exhausted')
  ) {
    return 'API tokens ended or rate-limit reached. Please try again after cooldown or add an additional API key.';
  }

  if (
    lower.includes('api key not configured') ||
    lower.includes('api_key is not configured') ||
    lower.includes('no gemini_api_key') ||
    lower.includes('not available')
  ) {
    return 'AI API key not available. Please configure your API key in settings or .env.';
  }

  return rawMsg;
}

export const uploadScreenplay = (showId, fileOrFiles) => {
  const formData = new FormData();
  formData.append('show_id', showId);
  if (Array.isArray(fileOrFiles)) {
    fileOrFiles.forEach((f) => {
      formData.append('files', f);
    });
    if (fileOrFiles.length > 0) {
      formData.append('file', fileOrFiles[0]);
    }
  } else if (fileOrFiles) {
    formData.append('file', fileOrFiles);
  }
  return api.post('/api/episodes/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const getPromos = (params = {}) => api.get('/api/promos/', { params });
export const getPromo = (id) => api.get(`/api/promos/${id}`);
export const approvePromo = (id) => api.post('/api/promos/' + id + '/approve');
export const rejectPromo = (id) => api.post('/api/promos/' + id + '/reject');
export const submitFeedback = (id, data) => api.post('/api/promos/' + id + '/feedback', data);

export default api;
