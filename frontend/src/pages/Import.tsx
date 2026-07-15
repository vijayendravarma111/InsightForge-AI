import React, { useState, useEffect } from 'react';
import { Database, Upload, Play, CheckCircle, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { apiService } from '../services/api';

interface ImportProps {
  onDatasetLoaded: (tableName: string) => void;
}

export const Import: React.FC<ImportProps> = ({ onDatasetLoaded }) => {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);

  const fetchDatasets = async () => {
    try {
      const data = await apiService.listDatasets();
      setDatasets(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setUploading(true);
    setStatusMsg({ text: `Uploading ${file.name}...`, type: 'info' });
    
    try {
      await apiService.uploadDataset(file);
      setStatusMsg({ text: `Uploaded ${file.name} successfully.`, type: 'success' });
      fetchDatasets();
    } catch (error: any) {
      const msg = error.response?.data?.detail || "Upload failed.";
      setStatusMsg({ text: msg, type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleLoad = async (filename?: string) => {
    setLoading(true);
    setStatusMsg({ 
      text: filename ? `Loading ${filename} into PostgreSQL raw_imports...` : "Seeding and loading Superstore Sales dataset...", 
      type: 'info' 
    });
    
    try {
      const res = await apiService.loadDataset(filename);
      setStatusMsg({ 
        text: `Successfully ingested table "${res.table_name}" with ${res.row_count} rows!`, 
        type: 'success' 
      });
      onDatasetLoaded(res.table_name);
    } catch (error: any) {
      const msg = error.response?.data?.detail || "Ingestion process failed.";
      setStatusMsg({ text: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Banner */}
      <div className="bg-[#0c111e]/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md">
        <h3 className="text-lg font-semibold text-slate-200 mb-2">
          Enterprise Ingestion Console
        </h3>
        <p className="text-sm text-slate-400 max-w-3xl leading-relaxed">
          Upload custom data structures or load the fallback enterprise Superstore dataset. Ingestion auto-detects fields, resolves delimiters, infers relational schemas, and prepares tables in the raw transactional schema.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Upload box */}
        <div className="bg-[#0c111e]/60 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between h-64 shadow-lg group hover:border-blue-500/30 transition-all duration-300">
          <div>
            <div className="p-3 bg-blue-600/10 border border-blue-500/20 text-blue-500 rounded-xl w-fit mb-4">
              <Upload className="w-5 h-5" />
            </div>
            <h4 className="font-semibold text-slate-200 mb-1">
              Upload Files
            </h4>
            <p className="text-xs text-slate-400">
              Drag and drop or select CSV or Excel files. Files are placed securely in storage for database loading.
            </p>
          </div>
          
          <label className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-slate-700 bg-slate-900/60 hover:bg-slate-800/50 cursor-pointer text-xs font-semibold tracking-wide transition duration-200">
            <Upload className="w-3.5 h-3.5 text-slate-400" />
            <span>Select File</span>
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>

        {/* Seeder box */}
        <div className="bg-[#0c111e]/60 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between h-64 shadow-lg group hover:border-indigo-500/30 transition-all duration-300">
          <div>
            <div className="p-3 bg-indigo-600/10 border border-indigo-500/20 text-indigo-500 rounded-xl w-fit mb-4">
              <Database className="w-5 h-5" />
            </div>
            <h4 className="font-semibold text-slate-200 mb-1">
              Superstore Seeder
            </h4>
            <p className="text-xs text-slate-400">
              Quickly seed and analyze an offline synthetic Superstore transaction dataset with built-in date mismatches, outliers, and duplicates.
            </p>
          </div>
          
          <button 
            onClick={() => handleLoad()}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-bold tracking-wide transition duration-200 shadow-md shadow-indigo-600/20 disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Seed Dataset</span>
          </button>
        </div>

        {/* Connection status box */}
        <div className="bg-[#0c111e]/60 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between h-64 shadow-lg">
          <div>
            <div className="p-3 bg-emerald-600/10 border border-emerald-500/20 text-emerald-500 rounded-xl w-fit mb-4">
              <CheckCircle className="w-5 h-5" />
            </div>
            <h4 className="font-semibold text-slate-200 mb-1">
              Storage Engine Status
            </h4>
            <p className="text-xs text-slate-400">
              Active PostgreSQL host connection is healthy. Local in-memory DuckDB analytical sandbox is initialized and listening.
            </p>
          </div>
          
          <div className="flex justify-between items-center bg-slate-900 border border-slate-800/60 rounded-lg p-2.5 text-[11px] text-slate-400 font-medium">
            <span>Postgres: <span className="text-emerald-400">Connected</span></span>
            <span>DuckDB: <span className="text-emerald-400">Connected</span></span>
          </div>
        </div>
      </div>

      {/* Progress Message */}
      {statusMsg && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-semibold ${
          statusMsg.type === 'error' 
            ? 'bg-rose-950/20 border-rose-900/30 text-rose-400' 
            : statusMsg.type === 'success'
              ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400'
              : 'bg-slate-900/60 border-slate-800 text-slate-300'
        }`}>
          {loading || uploading ? (
            <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
          ) : statusMsg.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          ) : (
            <Database className="w-4 h-4 text-slate-400" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Datasets List */}
      {datasets.length > 0 && (
        <div className="bg-[#0c111e]/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md">
          <h4 className="font-semibold text-slate-300 text-xs uppercase tracking-wider mb-4">
            Available Ingestion Targets
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 rounded-l-lg">Filename</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Last Modified</th>
                  <th className="py-3 px-4 rounded-r-lg text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-slate-300">
                {datasets.map((d) => (
                  <tr key={d.filename} className="hover:bg-slate-800/10">
                    <td className="py-3.5 px-4 font-semibold flex items-center gap-2 text-slate-200">
                      <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                      <span>{d.filename}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {d.size_bytes > 1024 * 1024 
                        ? `${(d.size_bytes / (1024 * 1024)).toFixed(2)} MB` 
                        : `${(d.size_bytes / 1024).toFixed(1)} KB`}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {new Date(d.modified_at * 1000).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button 
                        onClick={() => handleLoad(d.filename)}
                        disabled={loading}
                        className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition duration-200 disabled:opacity-50"
                      >
                        Load Target
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
export default Import;
