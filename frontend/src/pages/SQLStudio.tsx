import React, { useState, useEffect } from 'react';
import { Play, RefreshCw, CheckCircle, AlertCircle, FileDown, Database } from 'lucide-react';
import { apiService } from '../services/api';

export const SQLStudio: React.FC = () => {
  const [query, setQuery] = useState<string>("SELECT * FROM warehouse.fact_sales LIMIT 10;");
  const [columns, setColumns] = useState<string[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ execution_time_ms: number; row_count: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Table schema navigation sidebar
  const [schemaTree, setSchemaTree] = useState<any>(null);

  const fetchSchemaTree = async () => {
    try {
      const summary = await apiService.getWarehouseSummary();
      setSchemaTree(summary);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSchemaTree();
  }, []);

  const handleRunQuery = async () => {
    setLoading(true);
    setErrorMsg(null);
    setStats(null);
    
    try {
      const res = await apiService.executeSql(query);
      setColumns(res.columns);
      setData(res.data);
      setStats({
        execution_time_ms: res.execution_time_ms,
        row_count: res.row_count
      });
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : detail?.error || "Execution query failed.";
      const errTime = typeof detail === 'object' ? detail?.execution_time_ms : null;
      
      setErrorMsg(msg);
      if (errTime) {
        setStats({ execution_time_ms: errTime, row_count: 0 });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (data.length === 0) return;
    
    // Header
    const csvRows = [columns.join(',')];
    
    // Rows
    for (const row of data) {
      const values = columns.map(col => {
        const val = row[col];
        const escaped = ('' + val).replace(/"/g, '\\"');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }
    
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sql_results.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const quickQueries = [
    {
      name: "Get High-Value Customers",
      sql: "SELECT customer_id, customer_name, monetary_value, customer_tier\nFROM warehouse.dim_customers\nWHERE customer_tier = 'Platinum'\nORDER BY monetary_value DESC;"
    },
    {
      name: "Revenue by Product Category",
      sql: "SELECT p.category, SUM(f.sales) as total_sales, SUM(f.profit) as total_profit\nFROM warehouse.fact_sales f\nJOIN warehouse.dim_products p ON f.product_key = p.product_key\nGROUP BY p.category\nORDER BY total_sales DESC;"
    },
    {
      name: "Top Cities by Sales Volume",
      sql: "SELECT g.city, g.state, SUM(f.sales) as city_sales\nFROM warehouse.fact_sales f\nJOIN warehouse.dim_geography g ON f.geo_key = g.geo_key\nGROUP BY g.city, g.state\nORDER BY city_sales DESC\nLIMIT 15;"
    }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 max-w-6xl">
      {/* Sidebar Schema Helper */}
      <div className="lg:col-span-1 space-y-5">
        <div className="bg-[#0c111e]/60 border border-slate-800 rounded-xl p-4 shadow-md">
          <h4 className="font-semibold text-slate-300 text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-blue-500" />
            <span>Schema Explorer</span>
          </h4>
          
          {schemaTree ? (
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1 text-[11px] font-mono text-slate-400">
              {Object.keys(schemaTree.tables).map((tbl) => (
                <div key={tbl} className="space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    <span>{tbl}</span>
                  </div>
                  <div className="pl-3.5 border-l border-slate-800 text-[9px] text-slate-500">
                    {tbl === 'fact_sales' ? (
                      <>
                        <p>order_id (varchar)</p>
                        <p>customer_key (int)</p>
                        <p>product_key (int)</p>
                        <p>geo_key (int)</p>
                        <p>sales, profit, quantity</p>
                      </>
                    ) : tbl === 'dim_customers' ? (
                      <>
                        <p>customer_id (varchar)</p>
                        <p>customer_name (varchar)</p>
                        <p>rfm_score, customer_tier</p>
                      </>
                    ) : tbl === 'dim_products' ? (
                      <>
                        <p>product_id (varchar)</p>
                        <p>product_name (varchar)</p>
                        <p>category, sub_category</p>
                      </>
                    ) : (
                      <p>View table keys</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-600">Awaiting schema load...</p>
          )}
        </div>

        {/* Quick SQL queries */}
        <div className="bg-[#0c111e]/60 border border-slate-800 rounded-xl p-4 shadow-md space-y-2">
          <h4 className="font-semibold text-slate-300 text-xs uppercase tracking-wider mb-2">
            Analytics Templates
          </h4>
          {quickQueries.map((q, idx) => (
            <button
              key={idx}
              onClick={() => setQuery(q.sql)}
              className="w-full text-left p-2 rounded bg-slate-900/60 border border-slate-800/80 hover:border-blue-500/20 text-[10px] text-slate-300 hover:text-blue-400 font-semibold transition"
            >
              {q.name}
            </button>
          ))}
        </div>
      </div>

      {/* Query Studio Panel */}
      <div className="lg:col-span-3 space-y-6">
        {/* SQL Editor Area */}
        <div className="bg-[#0c111e]/60 border border-slate-800 rounded-xl p-5 shadow-md flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
              SQL SELECT Query Sandbox
            </span>
            <button
              onClick={handleRunQuery}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-xs font-bold uppercase tracking-wider rounded-lg transition disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              <span>Run Query</span>
            </button>
          </div>

          {/* Text Area */}
          <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/80 font-mono text-xs">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={6}
              className="w-full bg-transparent border-0 focus:ring-0 p-4 text-slate-300 focus:outline-none resize-none leading-relaxed"
            />
          </div>
        </div>

        {/* Query Status Console */}
        {stats && (
          <div className="flex items-center justify-between p-3.5 bg-slate-900 border border-slate-800 rounded-xl text-xs">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1 text-slate-400">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                <span>Query successfully completed</span>
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">Execution time: <strong className="text-blue-400">{stats.execution_time_ms} ms</strong></span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">Rows returned: <strong className="text-indigo-400">{stats.row_count}</strong></span>
            </div>
            
            {data.length > 0 && (
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-semibold"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            )}
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="p-4 rounded-xl border border-rose-900/30 bg-rose-950/15 text-xs text-rose-400 flex items-start gap-2.5 font-mono">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Query execution failed</p>
              <p className="mt-1 text-[11px] text-rose-300/80 leading-normal">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Results grid */}
        {data.length > 0 && !errorMsg && (
          <div className="bg-[#0c111e]/60 border border-slate-800 rounded-xl p-5 shadow-md flex flex-col h-[380px]">
            <h4 className="font-semibold text-slate-300 text-xs uppercase tracking-wider mb-4">
              Output Table
            </h4>
            
            <div className="flex-1 overflow-auto border border-slate-850 rounded-lg">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-500 font-semibold uppercase tracking-wider sticky top-0">
                  <tr>
                    {columns.map((col) => (
                      <th key={col} className="py-2 px-3 whitespace-nowrap font-mono">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-slate-300 font-mono">
                  {data.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/5">
                      {columns.map((col) => (
                        <td key={col} className="py-2 px-3 whitespace-nowrap">
                          {row[col] === null || row[col] === undefined ? 'NULL' : String(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default SQLStudio;
