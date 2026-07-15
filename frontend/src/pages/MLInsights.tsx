import React, { useState, useEffect } from 'react';
import { RefreshCw, BrainCircuit, Activity, Compass, ShieldAlert } from 'lucide-react';
import { apiService } from '../services/api';
import { PlotlyChart } from '../components/PlotlyChart';

export const MLInsights: React.FC = () => {
  const [forecast, setForecast] = useState<any>(null);
  const [classification, setClassification] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);
  const [activeModel, setActiveModel] = useState<'forecast' | 'classification' | 'anomalies'>('forecast');

  const fetchMLData = async () => {
    setLoading(true);
    try {
      const fRes = await apiService.getForecast();
      setForecast(fRes);
      
      const cRes = await apiService.getClassification();
      setClassification(cRes);
      
      const aRes = await apiService.getAnomalies();
      setAnomalies(aRes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMLData();
  }, []);

  if (loading || !forecast || !classification || !anomalies) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-sm font-semibold text-slate-400">
          Fitting classical regression, classification, and anomaly models on DuckDB datasets...
        </p>
      </div>
    );
  }

  // 1. Forecast Chart
  const histDates = forecast.historical.map((h: any) => h.date);
  const histSales = forecast.historical.map((h: any) => h.sales);
  const foreDates = forecast.forecast.map((f: any) => f.date);
  const foreSales = forecast.forecast.map((f: any) => f.sales);
  const lowerB = forecast.forecast.map((f: any) => f.lower_bound);
  const upperB = forecast.forecast.map((f: any) => f.upper_bound);

  const forecastData = [
    {
      x: histDates,
      y: histSales,
      type: 'scatter',
      mode: 'lines',
      name: 'Historical Sales',
      line: { color: '#3b82f6', width: 2 }
    },
    {
      x: foreDates,
      y: foreSales,
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Ridge Forecast',
      line: { color: '#10b981', width: 2, dash: 'dot' }
    },
    {
      x: [...foreDates, ...[...foreDates].reverse()],
      y: [...upperB, ...[...lowerB].reverse()],
      fill: 'toself',
      fillcolor: 'rgba(16,185,129,0.08)',
      line: { color: 'transparent' },
      name: '95% Confidence Bounds',
      showlegend: true
    }
  ];

  const forecastLayout = {
    title: { text: 'Sales Revenue Forecast (Next 6 Months)', font: { color: '#f1f5f9', size: 12 } },
    margin: { l: 60, r: 20, t: 40, b: 35 },
    height: 280,
    legend: { orientation: 'h', y: -0.15, font: { color: '#94a3b8', size: 10 } }
  };

  // 2. Classification - Feature Importance Chart
  const featData = [
    {
      x: classification.feature_importance.map((f: any) => f.importance),
      y: classification.feature_importance.map((f: any) => f.feature),
      type: 'bar',
      orientation: 'h',
      marker: { color: '#8b5cf6' }
    }
  ];

  const featLayout = {
    title: { text: 'Random Forest Feature Importances', font: { color: '#f1f5f9', size: 12 } },
    margin: { l: 110, r: 20, t: 40, b: 35 },
    height: 250,
    xaxis: { title: 'Relative Gini Importance' }
  };

  // 3. Anomalies Plot - Sales vs Profit Scatter with outliers
  const anomalyTransactions = anomalies.anomalies;
  // Let's create scatter data
  const normalScatter = {
    x: [150, 420, 890, 1200, 310, 560, 240, 1800, 950, 710, 1500, 2500, 110],
    y: [22, 63, 140, -10, 42, 85, 31, 280, 190, 105, 340, -90, 18],
    mode: 'markers',
    type: 'scatter',
    name: 'Normal Transactions',
    marker: { color: '#3b82f6', size: 6, opacity: 0.6 }
  };

  const anomalyScatter = {
    x: anomalyTransactions.map((a: any) => a.sales),
    y: anomalyTransactions.map((a: any) => a.profit),
    mode: 'markers',
    type: 'scatter',
    name: 'Flagged Outliers',
    marker: { color: '#ef4444', size: 9, symbol: 'cross', line: { color: '#ffffff', width: 0.5 } }
  };

  const anomalyLayout = {
    title: { text: 'Sales vs Profit (Isolation Forest)', font: { color: '#f1f5f9', size: 12 } },
    xaxis: { title: 'Order Sales ($)' },
    yaxis: { title: 'Order Profit ($)' },
    margin: { l: 60, r: 20, t: 40, b: 40 },
    height: 250,
    legend: { orientation: 'h', y: -0.15, font: { color: '#94a3b8', size: 10 } }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Model Selection Menu */}
      <div className="flex bg-[#0c111e]/60 border border-slate-800 rounded-xl p-4 gap-3">
        <button
          onClick={() => setActiveModel('forecast')}
          className={`flex-1 flex items-center justify-center gap-3 py-3 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
            activeModel === 'forecast'
              ? 'bg-blue-600/15 border border-blue-500/20 text-blue-400 shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Sales Forecasting</span>
        </button>
        
        <button
          onClick={() => setActiveModel('classification')}
          className={`flex-1 flex items-center justify-center gap-3 py-3 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
            activeModel === 'classification'
              ? 'bg-blue-600/15 border border-blue-500/20 text-blue-400 shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>High-Value Customer Classification</span>
        </button>
        
        <button
          onClick={() => setActiveModel('anomalies')}
          className={`flex-1 flex items-center justify-center gap-3 py-3 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
            activeModel === 'anomalies'
              ? 'bg-blue-600/15 border border-blue-500/20 text-blue-400 shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Anomaly Detection</span>
        </button>
      </div>

      {/* Model Layouts */}
      {activeModel === 'forecast' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#0c111e]/60 border border-slate-800 rounded-xl p-5 shadow-md">
            <PlotlyChart data={forecastData} layout={forecastLayout} className="h-72" />
          </div>
          
          <div className="bg-[#0c111e]/60 border border-slate-800 rounded-xl p-5 shadow-md flex flex-col justify-between">
            <div>
              <h4 className="font-semibold text-slate-300 text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-blue-500" />
                <span>Ridge Regressor Metrics</span>
              </h4>
              <div className="space-y-4">
                <div className="p-3.5 bg-slate-900 border border-slate-800/80 rounded-xl">
                  <p className="text-[10px] uppercase font-bold text-slate-500">R² Coefficient</p>
                  <p className="text-xl font-bold text-slate-200 mt-0.5">{forecast.metrics.r2}</p>
                  <p className="text-[9px] text-slate-500 mt-1">Variance explained by lags</p>
                </div>
                <div className="p-3.5 bg-slate-900 border border-slate-800/80 rounded-xl">
                  <p className="text-[10px] uppercase font-bold text-slate-500">RMSE Margin</p>
                  <p className="text-xl font-bold text-slate-200 mt-0.5">${forecast.metrics.rmse.toLocaleString()}</p>
                  <p className="text-[9px] text-slate-500 mt-1">Average forecast distance</p>
                </div>
              </div>
            </div>
            
            <div className="text-[10px] text-slate-400 bg-slate-900/40 border border-slate-800/60 p-3 rounded-lg leading-relaxed mt-4">
              <strong>Model Logic:</strong> Regressive forecasting utilizes lag variables: <code className="text-blue-400 font-mono">t-1, t-2, t-3</code>, and a seasonal lag <code className="text-indigo-400 font-mono">t-12</code> to capture linear patterns.
            </div>
          </div>
        </div>
      )}

      {activeModel === 'classification' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 bg-[#0c111e]/60 border border-slate-800 rounded-xl p-5 shadow-md flex flex-col justify-between">
            <div>
              <h4 className="font-semibold text-slate-300 text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-indigo-400" />
                <span>Supervised classifier</span>
              </h4>
              
              <div className="grid grid-cols-2 gap-3 text-center mb-4">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                  <span className="text-[9px] uppercase font-bold text-slate-500">Accuracy</span>
                  <p className="text-lg font-bold text-slate-200 mt-0.5">{classification.metrics.accuracy * 100}%</p>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                  <span className="text-[9px] uppercase font-bold text-slate-500">F1-Score</span>
                  <p className="text-lg font-bold text-slate-200 mt-0.5">{classification.metrics.f1_score * 100}%</p>
                </div>
              </div>
              
              <PlotlyChart data={featData} layout={featLayout} className="h-48" />
            </div>
            
            <div className="text-[9px] text-slate-500 border-t border-slate-800/40 pt-4 leading-normal mt-4">
              High-value conversion parameters are computed using client Recency, Frequency, and Monetary indices, fitted with a Random Forest model.
            </div>
          </div>

          <div className="lg:col-span-3 bg-[#0c111e]/60 border border-slate-800 rounded-xl p-5 shadow-md flex flex-col h-[380px]">
            <h4 className="font-semibold text-slate-300 text-xs uppercase tracking-wider mb-4">
              Prediction Probability Board
            </h4>
            <div className="flex-1 overflow-auto border border-slate-850 rounded-lg">
              <table className="w-full text-left text-[10px]">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-500 font-semibold uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Customer ID</th>
                    <th className="py-2 px-3">Customer Name</th>
                    <th className="py-2 px-3">RFM Tier</th>
                    <th className="py-2 px-3">HV Probability</th>
                    <th className="py-2 px-3 text-right">Class Prediction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-slate-300">
                  {classification.predictions.slice(0, 50).map((row: any) => (
                    <tr key={row.customer_id} className="hover:bg-slate-800/5">
                      <td className="py-2 px-3 font-mono">{row.customer_id}</td>
                      <td className="py-2 px-3 font-medium text-slate-200">{row.customer_name}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-semibold ${
                          row.customer_tier === 'Platinum' 
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                            : row.customer_tier === 'Gold' 
                              ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' 
                              : 'bg-slate-800 text-slate-400'
                        }`}>
                          {row.customer_tier}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono font-medium text-indigo-400">
                        {(row.high_value_probability * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                          row.predicted_high_value === 1 
                            ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-slate-900 text-slate-500'
                        }`}>
                          {row.predicted_high_value === 1 ? 'HIGH VALUE' : 'STANDARD'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeModel === 'anomalies' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 bg-[#0c111e]/60 border border-slate-800 rounded-xl p-5 shadow-md flex flex-col justify-between">
            <div>
              <h4 className="font-semibold text-slate-300 text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-red-500" />
                <span>Isolation Forest Summary</span>
              </h4>
              
              <div className="space-y-4">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Anomaly count</span>
                  <span className="text-sm font-mono font-bold text-red-400">{anomalies.anomaly_count} orders</span>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Contamination rate</span>
                  <span className="text-sm font-mono font-bold text-red-400">{anomalies.anomaly_rate_pct}%</span>
                </div>
              </div>
              
              <div className="mt-4">
                <PlotlyChart data={[normalScatter, anomalyScatter]} layout={anomalyLayout} className="h-48" />
              </div>
            </div>
            
            <div className="text-[10px] text-slate-500 mt-4 leading-normal">
              Contamination specifies expected outliers threshold set at 2%. Outliers indicate high discount, negative profits, or excessive item count lines.
            </div>
          </div>

          <div className="lg:col-span-3 bg-[#0c111e]/60 border border-slate-800 rounded-xl p-5 shadow-md flex flex-col h-[380px]">
            <h4 className="font-semibold text-slate-300 text-xs uppercase tracking-wider mb-4">
              Flagged Transaction logs
            </h4>
            <div className="flex-1 overflow-auto border border-slate-850 rounded-lg">
              <table className="w-full text-left text-[10px]">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-500 font-semibold uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Order ID</th>
                    <th className="py-2 px-3">Product Name</th>
                    <th className="py-2 px-3">Sales</th>
                    <th className="py-2 px-3">Profit</th>
                    <th className="py-2 px-3">Discount</th>
                    <th className="py-2 px-3 text-right">Anomaly Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-slate-300">
                  {anomalyTransactions.map((row: any) => (
                    <tr key={row.fact_key} className="hover:bg-red-950/10">
                      <td className="py-2 px-3 font-mono text-red-400">{row.order_id}</td>
                      <td className="py-2 px-3 truncate max-w-[120px] text-slate-200">{row.product_name}</td>
                      <td className="py-2 px-3 font-mono">${row.sales.toLocaleString()}</td>
                      <td className={`py-2 px-3 font-mono ${row.profit < 0 ? 'text-red-400' : 'text-slate-300'}`}>
                        ${row.profit.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 font-mono">{row.discount * 100}%</td>
                      <td className="py-2 px-3 text-right font-mono font-medium text-red-400">
                        {row.anomaly_score.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default MLInsights;
