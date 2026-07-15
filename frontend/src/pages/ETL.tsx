import React, { useState, useEffect } from 'react';
import { Wind, RefreshCw, CheckCircle, AlertTriangle, Database } from 'lucide-react';
import { apiService } from '../services/api';

interface ETLProps {
  tableName: string;
  onEtlCompleted: () => void;
}

export const ETL: React.FC<ETLProps> = ({ tableName, onEtlCompleted }) => {
  const [pipelineLogs, setPipelineLogs] = useState<any[]>([]);
  const [warehouseSummary, setWarehouseSummary] = useState<any>(null);
  
  const [running, setRunning] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const fetchLogsAndSummary = async () => {
    try {
      const logs = await apiService.getEtlLogs();
      if (logs.length > 0) {
        setPipelineLogs(logs[0].steps);
      }
      
      const summary = await apiService.getWarehouseSummary();
      setWarehouseSummary(summary);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchLogsAndSummary();
  }, []);

  const handleRunETL = async () => {
    setRunning(true);
    setStatusMsg("Executing pipeline: Ingesting -> Profiling -> Recommendations Clean -> Normalizing Star Schema...");
    try {
      const res = await apiService.runEtl(tableName);
      setPipelineLogs(res.pipeline_logs);
      
      // Reload warehouse summary
      const summary = await apiService.getWarehouseSummary();
      setWarehouseSummary(summary);
      
      onEtlCompleted();
      setStatusMsg(null);
    } catch (error: any) {
      const msg = error.response?.data?.detail || "ETL Execution failed.";
      setStatusMsg(`Error: ${msg}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Run trigger */}
      <div className="bg-[#0c111e]/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-slate-200">
            Star Schema ETL Pipeline
          </h3>
          <p className="text-sm text-slate-400 max-w-xl leading-relaxed">
            Execute the automated ETL flow. This will enforce auto-clean parameters, extract dimensional entities, compute Customer RFM tiers, map geography/time keys, and construct the fact table in PostgreSQL.
          </p>
        </div>
        
        <button
          onClick={handleRunETL}
          disabled={running}
          className="flex items-center justify-center gap-2.5 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-xs font-bold uppercase tracking-wider rounded-xl transition duration-200 shadow-lg shadow-blue-600/10 disabled:opacity-50 h-fit"
        >
          {running ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Wind className="w-4 h-4" />
          )}
          <span>{running ? 'Running ETL...' : 'Execute ETL Pipeline'}</span>
        </button>
      </div>

      {/* Progress Status message */}
      {statusMsg && (
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 text-xs text-slate-400 font-mono animate-pulse">
          {statusMsg}
        </div>
      )}

      {/* Pipeline Status Step Visualizer */}
      {pipelineLogs.length > 0 && (
        <div className="bg-[#0c111e]/60 border border-slate-800 rounded-2xl p-6 shadow-md">
          <h4 className="font-semibold text-slate-300 text-xs uppercase tracking-wider mb-6">
            ETL Progress logs
          </h4>
          
          <div className="space-y-6 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-800">
            {pipelineLogs.map((step, idx) => (
              <div key={idx} className="flex items-start gap-4 relative">
                {/* Dot */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border z-10 ${
                  step.status === 'COMPLETED'
                    ? 'bg-emerald-950 border-emerald-500/50 text-emerald-400'
                    : step.status === 'IN_PROGRESS'
                      ? 'bg-blue-950 border-blue-500/50 text-blue-400 animate-pulse'
                      : step.status === 'FAILED'
                        ? 'bg-rose-950 border-rose-500/50 text-rose-400'
                        : 'bg-slate-900 border-slate-800 text-slate-500'
                }`}>
                  {step.status === 'COMPLETED' ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : step.status === 'FAILED' ? (
                    <AlertTriangle className="w-4 h-4" />
                  ) : (
                    <span className="text-xs font-semibold">{idx + 1}</span>
                  )}
                </div>
                
                <div>
                  <h5 className="text-xs font-semibold text-slate-200 mt-1">{step.step}</h5>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Status: <span className={
                      step.status === 'COMPLETED' 
                        ? 'text-emerald-400 font-medium' 
                        : step.status === 'IN_PROGRESS'
                          ? 'text-blue-400 font-medium animate-pulse'
                          : 'text-slate-600'
                    }>{step.status}</span>
                  </p>
                  
                  {step.logs && step.logs.length > 0 && (
                    <div className="mt-2 pl-3 border-l border-slate-800 text-[10px] text-slate-400 font-mono space-y-1">
                      {step.logs.map((l: string, lIdx: number) => (
                        <p key={lIdx}>• {l}</p>
                      ))}
                    </div>
                  )}
                  {step.error && (
                    <p className="mt-2 text-[10px] font-mono text-rose-400 bg-rose-950/20 border border-rose-900/30 p-2 rounded">
                      [ERROR] {step.error}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warehouse Summary and Star Schema Diagram */}
      {warehouseSummary && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Table summary cards */}
          <div className="lg:col-span-2 bg-[#0c111e]/60 border border-slate-800 rounded-2xl p-6 shadow-md h-fit">
            <h4 className="font-semibold text-slate-300 text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-500" />
              <span>Data Warehouse Summary</span>
            </h4>
            
            <div className="space-y-4">
              {Object.entries(warehouseSummary.tables).map(([tblName, tbl]: any) => (
                <div key={tblName} className="p-3 bg-slate-900/40 border border-slate-800/60 rounded-xl flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-mono font-bold text-slate-200">{tblName}</h5>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {warehouseSummary.star_schema_role[tblName] || 'Warehouse table'}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    tblName.startsWith('fact') 
                      ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' 
                      : 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20'
                  }`}>
                    {tbl.exists ? `${tbl.row_count.toLocaleString()} rows` : 'Offline'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Star Schema Diagram */}
          <div className="lg:col-span-3 bg-[#0c111e]/60 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col items-center justify-center min-h-[350px]">
            <h4 className="font-semibold text-slate-300 text-xs uppercase tracking-wider self-start mb-6">
              DW Dimensional Architecture
            </h4>
            
            {/* Visual Diagram */}
            <div className="relative w-full h-[280px] flex items-center justify-center">
              {/* Fact Table (Center) */}
              <div className="absolute z-10 w-44 bg-blue-950/80 border-2 border-blue-500 rounded-xl p-3 shadow-lg shadow-blue-500/5 hover:scale-105 transition text-center font-mono">
                <span className="text-[9px] uppercase font-bold text-blue-400 tracking-wider">Fact Table</span>
                <h5 className="text-xs font-bold text-slate-200 mt-1">fact_sales</h5>
                <div className="mt-2 text-[8px] text-slate-400 text-left border-t border-slate-800 pt-1.5 space-y-0.5">
                  <p>• fact_key (PK)</p>
                  <p>• customer_key (FK)</p>
                  <p>• product_key (FK)</p>
                  <p>• geo_key (FK)</p>
                  <p>• date_key (FK)</p>
                  <p>• sales, profit, quantity</p>
                </div>
              </div>

              {/* Dim Customer (Top Left) */}
              <div className="absolute top-0 left-0 w-36 bg-slate-900 border border-slate-700/60 rounded-lg p-2.5 shadow hover:scale-105 transition font-mono">
                <span className="text-[8px] font-bold text-indigo-400 uppercase">Dim</span>
                <h5 className="text-[10px] font-bold text-slate-300 mt-0.5">dim_customers</h5>
                <div className="text-[7px] text-slate-500 mt-1 space-y-0.5">
                  <p>• customer_key (PK)</p>
                  <p>• customer_id</p>
                  <p>• customer_name</p>
                  <p>• rfm_score, tier</p>
                </div>
              </div>

              {/* Dim Product (Top Right) */}
              <div className="absolute top-0 right-0 w-36 bg-slate-900 border border-slate-700/60 rounded-lg p-2.5 shadow hover:scale-105 transition font-mono">
                <span className="text-[8px] font-bold text-indigo-400 uppercase">Dim</span>
                <h5 className="text-[10px] font-bold text-slate-300 mt-0.5">dim_products</h5>
                <div className="text-[7px] text-slate-500 mt-1 space-y-0.5">
                  <p>• product_key (PK)</p>
                  <p>• product_id</p>
                  <p>• product_name</p>
                  <p>• category, sub_category</p>
                </div>
              </div>

              {/* Dim Geo (Bottom Left) */}
              <div className="absolute bottom-0 left-0 w-36 bg-slate-900 border border-slate-700/60 rounded-lg p-2.5 shadow hover:scale-105 transition font-mono">
                <span className="text-[8px] font-bold text-indigo-400 uppercase">Dim</span>
                <h5 className="text-[10px] font-bold text-slate-300 mt-0.5">dim_geography</h5>
                <div className="text-[7px] text-slate-500 mt-1 space-y-0.5">
                  <p>• geo_key (PK)</p>
                  <p>• city, state</p>
                  <p>• region, country</p>
                </div>
              </div>

              {/* Dim Time (Bottom Right) */}
              <div className="absolute bottom-0 right-0 w-36 bg-slate-900 border border-slate-700/60 rounded-lg p-2.5 shadow hover:scale-105 transition font-mono">
                <span className="text-[8px] font-bold text-indigo-400 uppercase">Dim</span>
                <h5 className="text-[10px] font-bold text-slate-300 mt-0.5">dim_time</h5>
                <div className="text-[7px] text-slate-500 mt-1 space-y-0.5">
                  <p>• date_key (PK)</p>
                  <p>• full_date</p>
                  <p>• year, quarter, month</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ETL;
