import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

export const getStatus = () => api.get('/');

export const uploadAudio = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/audio/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const processAudio = (audioId, currentDepth, location) =>
  api.post(`/audio/process/${audioId}`, null, {
    params: { current_depth: currentDepth, location },
  });

export const getLogs = (limit = 100) => api.get('/logs', { params: { limit } });

export const getLog = (logId) => api.get(`/logs/${logId}`);

export const generateSummary = (logId) => api.post(`/logs/${logId}/summarize`);

export const transmitLog = (logId) => api.post(`/logs/${logId}/transmit`);

export const getDepthSeries = (logId = null, limit = 500) =>
  api.get('/depth-series', { params: { log_id: logId, limit } });

export const addDepthRecord = (record, logId = null) =>
  api.post('/depth-series', record, { params: { log_id: logId } });

export const getPendingTransmissions = () => api.get('/transmission/pending');

export const getTransmissionHistory = () => api.get('/transmission/history');

export const getSpeakerProfiles = () => api.get('/speaker/profiles');

export const resetSpeakerProfiles = () => api.post('/speaker/reset');

export default api;
