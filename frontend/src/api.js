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
export const processAllEpisodes = (showId) => api.post(`/api/shows/${showId}/process-all`);

export const getEpisodes = (showId) => api.get(`/api/episodes/?show_id=${showId}`);
export const getEpisode = (id) => api.get(`/api/episodes/${id}`);
export const processEpisode = (id) => api.post(`/api/episodes/${id}/process`);
export const uploadScreenplay = (showId, file) => {
  const formData = new FormData();
  formData.append('show_id', showId);
  formData.append('file', file);
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
