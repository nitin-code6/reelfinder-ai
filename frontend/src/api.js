import axios from 'axios';

const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

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
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map(item => item?.msg || (typeof item === 'object' ? JSON.stringify(item) : String(item))).join(', ');
  }
  if (detail && typeof detail === 'object') {
    return detail.msg || JSON.stringify(detail);
  }
  return err.response?.data?.message || err.message || fallback;
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
