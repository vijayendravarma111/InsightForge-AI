import React, { useState, useEffect } from 'react';
import { Sparkles, Play, RefreshCw, CheckCircle, Clock, History } from 'lucide-react';
import { apiService } from '../services/api';

interface CleaningProps {
  tableName: string;
}

export const Cleaning: React.FC<CleaningProps> = ({ tableName }) => {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewCols, setPreviewCols] = useState<string[]>([]);
  const [selectedRules, setSelectedRules] = useState<{ [key: string]: boolean }>({});
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'recommendations' | 'history'>('recommendations');

  const fetchData = async () => {
    setLoading(true);
    try {
      // Recommendations
      const recsRes = await apiService.getRecommendations(tableName);
      setRecommendations(recsRes.recommendations);
      
      // Initialize selected rules mapping
      const initialSelected: { [key: string]: boolean } = {};
      recsRes.recommendations.forEach((r: any, idx: number) => {
        initialSelected[`rule_${idx}`] = r.default_value;
      });
      setSelectedRules(initialSelected);
      
      // History
      const histRes = await apiService.getCleaningHistory(tableName);
      setHistory(histRes);
      
      // Initial Preview
      await handlePreview(recsRes.recommendations, initialSelected);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tableName) {
      fetchData();
    }
  }, [tableName]);

  const handleCheckboxChange = (ruleIdx: string) => {
    const updated = { ...selectedRules, [ruleIdx]: !selectedRules[ruleIdx] };
    setSelectedRules(updated);
    
    // Auto-update preview when checkbox updates
    handlePreview(recommendations, updated);
  };

  const handlePreview = async (allRecs: any[], currentSelection: { [key: string]: boolean }) => {
    const activeRules = allRecs.filter((_, idx) => currentSelection[`rule_${idx}`]);
    try {
      const res = await apiService.previewClean(tableName, activeRules);
      setPreviewData(res.preview);
      if (res.preview && res.preview.length > 0) {
        setPreviewCols(Object.keys(res.preview[0]));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleApply = async () => {
    setSubmitting(true);
    setLogs([]);
    const activeRules = recommendations.filter((_, idx) => selectedRules[`rule_${idx}`]);
    
    try {
      const res = await apiService.applyClean(tableName, activeRules);
      setLogs(res.logs);
      setPreviewData(res.preview);
      
      // Re-trigger reload of cleaning status
      const recsRes = await apiService.getRecommendations(tableName);
      setRecommendations(recsRes.recommendations);
      
      const initialSelected: { [key: string]: boolean } = {};
      recsRes.recommendations.forEach((r: any, idx: number) => {
        initialSelected[`rule_${idx}`] = r.default_value;
      });
      setSelectedRules(initialSelected);
      
      const histRes = await apiService.getCleaningHistory(tableName);
      setHistory(histRes);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-sm font-semibold text-slate-400">
          Running rules models to generate recommendations...
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl">
      {/* Sidebar: Recommendations & History tabs */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-[#0c111e]/60 border border-slate-800 rounded-xl p-4 flex gap-2">
          <button
            onClick={() => setActiveTab('recommendations')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold tracking-wide transition ${
              activeTab === 'recommendations'
                ? 'bg-blue-600/15 border border-blue-500/20 text-blue-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Recommendations</span>
          </button>
          
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold tracking-wide transition ${
              activeTab === 'history'
                ? 'bg-blue-600/15 border border-blue-500/20 text-blue-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History</span>
          </button>
        </div>

        {activeTab === 'recommendations' ? (
          <div className="bg-[#0c111e]/60 border border-slate-800 rounded-xl p-5 space-y-4 shadow-md">
            <h4 className="font-semibold text-slate-300 text-xs uppercase tracking-wider mb-2">
              Actionable Insights
            </h4>
            
            {recommendations.length > 0 ? (
              <div className="space-y-3.5">
                {recommendations.map((rec, idx) => (
                  <div 
                    key={idx} 
                    className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg flex items-start gap-3 hover:border-slate-700/50 transition"
                  >
                    <input 
                      type="checkbox"
                      id={`rule_${idx}`}
                      checked={selectedRules[`rule_${idx}`] || false}
                      onChange={() => handleCheckboxChange(`rule_${idx}`)}
                      className="mt-1 w-3.5 h-3.5 text-blue-600 border-slate-800 rounded focus:ring-blue-500 focus:ring-offset-slate-900 bg-slate-950"
                    />
                    
                    <div>
                      <p className="text-xs text-slate-200 font-medium leading-relaxed">
                        {rec.message}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`text-[9px] uppercase font-semibold px-2 py-0.5 rounded-full ${
                          rec.severity === 'high' 
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {rec.severity}
                        </span>
                        {rec.column && (
                          <span className="text-[9px] font-mono text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800/40">
                            {rec.column}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                <button
                  onClick={handleApply}
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-bold tracking-wide transition duration-200 shadow-md shadow-blue-600/10 disabled:opacity-50"
                >
                  {submitting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  <span>Apply Transformations</span>
                </button>
              </div>
            ) : (
              <div className="p-4 text-center border border-slate-800 rounded-lg">
                <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs text-slate-400 leading-normal">
                  All clean constraints met! No new anomalies detected.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[#0c111e]/60 border border-slate-800 rounded-xl p-5 space-y-4 shadow-md">
            <h4 className="font-semibold text-slate-300 text-xs uppercase tracking-wider mb-2">
              Auditing Trail Log
            </h4>
            
            {history.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {history.map((hist, idx) => (
                  <div key={idx} className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-[11px] space-y-2">
                    <div className="flex justify-between text-slate-500 font-mono">
                      <span>RUN #{history.length - idx}</span>
                      <span>{new Date(hist.applied_at).toLocaleTimeString()}</span>
                    </div>
                    <div className="space-y-1">
                      {hist.operations.map((op: any, oIdx: number) => (
                        <p key={oIdx} className="text-slate-300">
                          • Apply: <span className="font-mono text-blue-400">{op.type}</span> 
                          {op.column && <span> on <span className="font-mono text-indigo-400">{op.column}</span></span>}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 text-center py-6">
                No transformations have been saved yet.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Main Grid: Data preview and Console logging */}
      <div className="lg:col-span-2 space-y-6">
        {/* Console Execution Logs */}
        {logs.length > 0 && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[11px] text-emerald-400 space-y-1.5 shadow-inner">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800 text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              <span>Transformation logs: applied successfully</span>
            </div>
            {logs.map((log, idx) => (
              <p key={idx}>[INFO] {log}</p>
            ))}
          </div>
        )}

        {/* Data Preview */}
        <div className="bg-[#0c111e]/60 border border-slate-800 rounded-xl p-5 shadow-md flex flex-col h-[520px]">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-slate-300 text-xs uppercase tracking-wider">
              Data Sandbox Preview
            </h4>
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
              Showing first 50 rows
            </span>
          </div>

          <div className="flex-1 overflow-auto border border-slate-800/60 rounded-lg">
            {previewData.length > 0 ? (
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-900/80 border-b border-slate-850 text-slate-500 font-semibold uppercase tracking-wider sticky top-0">
                  <tr>
                    {previewCols.map((c) => (
                      <th key={c} className="py-2 px-3 whitespace-nowrap font-mono">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-slate-300">
                  {previewData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/5">
                      {previewCols.map((c) => (
                        <td key={c} className="py-2 px-3 whitespace-nowrap">
                          {row[c] === null || row[c] === undefined ? (
                            <span className="text-slate-600 bg-slate-950 border border-slate-800/30 px-1 py-0.5 rounded text-[9px] font-semibold">
                              NULL
                            </span>
                          ) : (
                            String(row[c])
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                <p className="text-xs">Select options and check the preview grid...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default Cleaning;
