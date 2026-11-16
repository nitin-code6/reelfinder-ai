import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getHealth = () => api.get('/health');

export const getShows = () => api.get('/shows/');
export const createShow = (data) => api.post('/shows/', data);
export const getShow = (id) => api.get(`/shows/${id}`);
export const processAllEpisodes = (showId) => api.post(`/shows/${showId}/process-all`);

export const getEpisodes = (showId) => api.get(`/episodes/?show_id=${showId}`);
export const getEpisode = (id) => api.get(`/episodes/${id}`);
export const processEpisode = (id) => api.post(`/episodes/${id}/process`);
export const uploadScreenplay = (showId, file) => {
  const formData = new FormData();
  formData.append('show_id', showId);
  formData.append('file', file);
  return api.post('/episodes/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const getPromos = (params = {}) => api.get('/promos/', { params });
export const getPromo = (id) => api.get(`/promos/${id}`);
export const approvePromo = (id) => api.post(`/promos/${id}/approve`);
export const rejectPromo = (id) => api.post(`/promos/${id}/reject`);
export const submitFeedback = (id, data) => api.post(`/promos/${id}/feedback`, data);

export default api;
