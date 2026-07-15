import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiService = {
  // Data Import
  listDatasets: async () => {
    const res = await api.get('/import/datasets');
    return res.data;
  },
  
  uploadDataset: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/import/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },
  
  loadDataset: async (filename?: string) => {
    const params = filename ? { filename } : {};
    const res = await api.post('/import/load', null, { params });
    return res.data;
  },
  
  // Profiling
  profileTable: async (tableName: string) => {
    const res = await api.get('/profiling', {
      params: { table_name: tableName },
    });
    return res.data;
  },
  
  // Cleaning
  getRecommendations: async (tableName: string) => {
    const res = await api.get('/cleaning/recommendations', {
      params: { table_name: tableName },
    });
    return res.data;
  },
  
  previewClean: async (tableName: string, rules: any[]) => {
    const res = await api.post('/cleaning/preview', rules, {
      params: { table_name: tableName },
    });
    return res.data;
  },
  
  applyClean: async (tableName: string, rules: any[]) => {
    const res = await api.post('/cleaning/apply', rules, {
      params: { table_name: tableName },
    });
    return res.data;
  },
  
  getCleaningHistory: async (tableName: string) => {
    const res = await api.get('/cleaning/history', {
      params: { table_name: tableName },
    });
    return res.data;
  },
  
  // ETL
  runEtl: async (tableName: string) => {
    const res = await api.post('/etl/run', null, {
      params: { table_name: tableName },
    });
    return res.data;
  },
  
  getEtlLogs: async () => {
    const res = await api.get('/etl/logs');
    return res.data;
  },
  
  // Warehouse
  getWarehouseSummary: async () => {
    const res = await api.get('/warehouse/summary');
    return res.data;
  },
  
  // SQL Analytics Studio
  executeSql: async (sqlText: string) => {
    const res = await api.post('/analytics/query', null, {
      params: { sql_text: sqlText },
    });
    return res.data;
  },
  
  // Dashboard
  getKpis: async () => {
    const res = await api.get('/dashboard/kpis');
    return res.data;
  },
  
  getCharts: async () => {
    const res = await api.get('/dashboard/charts');
    return res.data;
  },
  
  getInsights: async () => {
    const res = await api.get('/dashboard/insights');
    return res.data;
  },
  
  // Machine Learning
  getForecast: async () => {
    const res = await api.get('/ml/forecast');
    return res.data;
  },
  
  getClassification: async () => {
    const res = await api.get('/ml/classification');
    return res.data;
  },
  
  getAnomalies: async () => {
    const res = await api.get('/ml/anomalies');
    return res.data;
  },
  
  // PDF Report download helper
  getReportBlob: async (tableName: string) => {
    const res = await api.get('/report/generate', {
      params: { table_name: tableName },
      responseType: 'blob',
    });
    return res.data;
  },
};
export default apiService;
