import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, ShieldCheck, HelpCircle } from 'lucide-react';
import { apiService } from '../services/api';
import { PlotlyChart } from '../components/PlotlyChart';

interface ProfilerProps {
  tableName: string;
}

export const Profiler: React.FC<ProfilerProps> = ({ tableName }) => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedColumn, setSelectedColumn] = useState<string>('');

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const data = await apiService.profileTable(tableName);
      setProfile(data);
      // Select first numeric/histogram column automatically if available
      const numericCols = Object.keys(data.columns).filter(
        (key) => data.columns[key].histogram !== undefined
      );
      if (numericCols.length > 0) {
        setSelectedColumn(numericCols[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tableName) {
      fetchProfile();
    }
  }, [tableName]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-sm font-semibold text-slate-400">
          Running DuckDB analytical sandboxes to profile database schema...
        </p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
        <p className="text-sm text-slate-400">Failed to load dataset profile.</p>
      </div>
    );
  }

  const { quality_dimensions } = profile;
  
  // Data Quality Plot data
  const qualityBarData = [
    {
      type: 'bar',
      x: [
        quality_dimensions.completeness,
        quality_dimensions.consistency,
        quality_dimensions.validity,
        quality_dimensions.uniqueness,
        quality_dimensions.accuracy,
      ],
      y: ['Completeness', 'Consistency', 'Validity', 'Uniqueness', 'Accuracy'],
      orientation: 'h',
      marker: {
        color: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'],
        width: 0.6
      }
    }
  ];

  const qualityBarLayout = {
    title: { text: 'Enterprise Data Quality Dimensions (%)', font: { size: 12, color: '#f1f5f9' } },
    xaxis: { range: [0, 105] },
    margin: { l: 90, r: 20, t: 40, b: 30 },
    height: 200
  };

  // Correlation Matrix Plot data
  const corrCols = Object.keys(profile.correlation_matrix);
  const corrValues: number[][] = [];
  
  corrCols.forEach((rowKey) => {
    const row: number[] = [];
    corrCols.forEach((colKey) => {
      row.push(profile.correlation_matrix[rowKey][colKey] ?? 1.0);
    });
    corrValues.push(row);
  });

  const correlationData = [
    {
      z: corrValues,
      x: corrCols,
      y: corrCols,
      type: 'heatmap',
      colorscale: 'RdBu',
      zmin: -1,
      zmax: 1
    }
  ];

  const correlationLayout = {
    title: { text: 'Pearson Correlation Matrix', font: { size: 12, color: '#f1f5f9' } },
    margin: { l: 80, r: 20, t: 40, b: 40 },
    height: 300,
    xaxis: { tickangle: 25 }
  };

  // Selected column histogram data
  const colDetails = profile.columns[selectedColumn];
  const histData = colDetails?.histogram 
    ? [
        {
          x: colDetails.histogram.map((h: any) => `${h.bin_start} - ${h.bin_end}`),
          y: colDetails.histogram.map((h: any) => h.count),
          type: 'bar',
          marker: { color: '#6366f1' }
        }
      ]
    : [];

  const histLayout = {
    title: { text: `Distribution of ${selectedColumn}`, font: { size: 12, color: '#f1f5f9' } },
    margin: { l: 50, r: 20, t: 40, b: 40 },
    height: 220
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Summary KPI section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-[#0c111e]/60 border border-slate-800 rounded-xl p-5 shadow-md">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Row Count</span>
          <h3 className="text-2xl font-bold text-slate-200 mt-1">{profile.row_count.toLocaleString()}</h3>
          <p className="text-[11px] text-slate-500 mt-1">Processed in-memory</p>
        </div>
        <div className="bg-[#0c111e]/60 border border-slate-800 rounded-xl p-5 shadow-md">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Column Count</span>
          <h3 className="text-2xl font-bold text-slate-200 mt-1">{profile.col_count}</h3>
          <p className="text-[11px] text-slate-500 mt-1">Relational schema features</p>
        </div>
        <div className="bg-[#0c111e]/60 border border-slate-800 rounded-xl p-5 shadow-md">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Duplicate Rows</span>
          <h3 className={`text-2xl font-bold mt-1 ${profile.duplicate_rows > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
            {profile.duplicate_rows}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">Identical row fingerprints</p>
        </div>
        <div className="bg-[#0c111e]/60 border border-slate-800 rounded-xl p-5 shadow-md flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Overall Quality</span>
            <h3 className="text-2xl font-bold text-blue-400 mt-1">{quality_dimensions.overall}%</h3>
          </div>
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-xl">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main visualization grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Data Quality card */}
        <div className="bg-[#0c111e]/60 border border-slate-800 rounded-xl p-5 shadow-md">
          <PlotlyChart data={qualityBarData} layout={qualityBarLayout} className="h-48" />
          
          {/* Legend and definitions */}
          <div className="mt-4 grid grid-cols-5 gap-2 text-[10px] text-center border-t border-slate-800/40 pt-4 text-slate-400">
            <div>
              <p className="font-semibold text-slate-300">Completeness</p>
              <p className="text-[9px] text-slate-500">No null values</p>
            </div>
            <div>
              <p className="font-semibold text-slate-300">Consistency</p>
              <p className="text-[9px] text-slate-500">Type formatting</p>
            </div>
            <div>
              <p className="font-semibold text-slate-300">Validity</p>
              <p className="text-[9px] text-slate-500">Logical ranges</p>
            </div>
            <div>
              <p className="font-semibold text-slate-300">Uniqueness</p>
              <p className="text-[9px] text-slate-500">No duplications</p>
            </div>
            <div>
              <p className="font-semibold text-slate-300">Accuracy</p>
              <p className="text-[9px] text-slate-500">Low outlier rate</p>
            </div>
          </div>
        </div>

        {/* Correlation matrix */}
        <div className="bg-[#0c111e]/60 border border-slate-800 rounded-xl p-5 shadow-md">
          {corrCols.length > 0 ? (
            <PlotlyChart data={correlationData} layout={correlationLayout} className="h-72" />
          ) : (
            <div className="flex flex-col items-center justify-center h-72 text-slate-500">
              <HelpCircle className="w-8 h-8 mb-2" />
              <p className="text-xs">No numeric columns available to compute correlations.</p>
            </div>
          )}
        </div>
      </div>

      {/* Schema Detail Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Table column lists */}
        <div className="bg-[#0c111e]/60 border border-slate-800 rounded-xl p-5 shadow-md md:col-span-2">
          <h4 className="font-semibold text-slate-300 text-xs uppercase tracking-wider mb-4">
            Relational Schema Analysis
          </h4>
          <div className="overflow-y-auto max-h-96 pr-2">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-500 font-semibold uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Column Name</th>
                  <th className="py-2.5 px-3">Datatype</th>
                  <th className="py-2.5 px-3">Nulls (%)</th>
                  <th className="py-2.5 px-3">Unique Values</th>
                  <th className="py-2.5 px-3">Outliers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-slate-300">
                {Object.entries(profile.columns).map(([colName, col]: any) => (
                  <tr 
                    key={colName} 
                    onClick={() => {
                      if (col.histogram) setSelectedColumn(colName);
                    }}
                    className={`hover:bg-slate-800/10 cursor-pointer transition ${
                      selectedColumn === colName ? 'bg-slate-800/20' : ''
                    }`}
                  >
                    <td className="py-3 px-3 font-semibold font-mono text-slate-200">{colName}</td>
                    <td className="py-3 px-3 text-slate-500">{col.type}</td>
                    <td className="py-3 px-3 text-slate-400">
                      {col.null_count} ({col.null_percentage}%)
                    </td>
                    <td className="py-3 px-3 text-slate-400">{col.unique_count}</td>
                    <td className="py-3 px-3 text-slate-400">
                      {col.outlier_count !== undefined ? (
                        <span className={col.outlier_count > 0 ? 'text-amber-500 font-semibold' : 'text-slate-500'}>
                          {col.outlier_count}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Column statistics & plot */}
        <div className="bg-[#0c111e]/60 border border-slate-800 rounded-xl p-5 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-slate-300 text-xs uppercase tracking-wider">
                Distribution Profile
              </h4>
              <span className="text-[10px] font-mono bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-blue-400">
                {selectedColumn || 'Select column'}
              </span>
            </div>
            
            {selectedColumn && colDetails ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-center text-xs">
                  <div className="bg-slate-900/60 border border-slate-800/60 p-2.5 rounded-lg">
                    <p className="text-[9px] uppercase font-bold text-slate-500">Min</p>
                    <p className="font-semibold text-slate-300 mt-0.5">{colDetails.min ?? 'N/A'}</p>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-800/60 p-2.5 rounded-lg">
                    <p className="text-[9px] uppercase font-bold text-slate-500">Max</p>
                    <p className="font-semibold text-slate-300 mt-0.5">{colDetails.max ?? 'N/A'}</p>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-800/60 p-2.5 rounded-lg">
                    <p className="text-[9px] uppercase font-bold text-slate-500">Mean</p>
                    <p className="font-semibold text-slate-300 mt-0.5">{colDetails.mean ?? 'N/A'}</p>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-800/60 p-2.5 rounded-lg">
                    <p className="text-[9px] uppercase font-bold text-slate-500">Median</p>
                    <p className="font-semibold text-slate-300 mt-0.5">{colDetails.median ?? 'N/A'}</p>
                  </div>
                </div>
                
                {colDetails.histogram ? (
                  <PlotlyChart data={histData} layout={histLayout} className="h-56" />
                ) : (
                  <p className="text-xs text-slate-500 text-center py-6">
                    Distribution plotting is only supported for numeric features.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 text-center py-12">
                Click a column row in the table to display distribution statistics.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default Profiler;
