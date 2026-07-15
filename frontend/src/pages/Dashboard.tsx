import React, { useState, useEffect } from 'react';
import { RefreshCw, DollarSign, TrendingUp, ShoppingBag, Percent, AlertTriangle, Lightbulb, Compass, Award } from 'lucide-react';
import { apiService } from '../services/api';
import { MetricCard } from '../components/MetricCard';
import { PlotlyChart } from '../components/PlotlyChart';

export const Dashboard: React.FC = () => {
  const [kpis, setKpis] = useState<any>(null);
  const [charts, setCharts] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const kpiRes = await apiService.getKpis();
      setKpis(kpiRes);
      
      const chartRes = await apiService.getCharts();
      setCharts(chartRes);
      
      const insightRes = await apiService.getInsights();
      setInsights(insightRes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading || !kpis || !charts) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-sm font-semibold text-slate-400">
          Aggregating warehouse star schemas for dashboard rendering...
        </p>
      </div>
    );
  }

  // 1. Line Plot: Revenue & Profit Trend
  const trendData = [
    {
      x: charts.trends.map((t: any) => t.period),
      y: charts.trends.map((t: any) => t.sales),
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Revenue',
      line: { color: '#3b82f6', width: 2.5 },
      marker: { size: 5 }
    },
    {
      x: charts.trends.map((t: any) => t.period),
      y: charts.trends.map((t: any) => t.profit),
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Profit',
      line: { color: '#10b981', width: 2.5 },
      marker: { size: 5 }
    }
  ];

  const trendLayout = {
    title: { text: 'Monthly Revenue & Profit Trends', font: { color: '#f1f5f9', size: 12 } },
    margin: { l: 60, r: 20, t: 40, b: 35 },
    height: 250,
    legend: { orientation: 'h', y: -0.15, font: { color: '#94a3b8', size: 10 } }
  };

  // 2. Bar Plot: Category Performance
  const categoryData = [
    {
      x: charts.categories.map((c: any) => c.category),
      y: charts.categories.map((c: any) => c.sales),
      type: 'bar',
      name: 'Revenue',
      marker: { color: '#3b82f6' }
    },
    {
      x: charts.categories.map((c: any) => c.category),
      y: charts.categories.map((c: any) => c.profit),
      type: 'bar',
      name: 'Profit',
      marker: { color: '#10b981' }
    }
  ];

  const categoryLayout = {
    title: { text: 'Category Sales & Net Profit', font: { color: '#f1f5f9', size: 12 } },
    margin: { l: 65, r: 20, t: 40, b: 35 },
    height: 250,
    barmode: 'group',
    legend: { orientation: 'h', y: -0.15, font: { color: '#94a3b8', size: 10 } }
  };

  // 3. Pie Plot: Regional Sales
  const regionalData = [
    {
      values: charts.regions.map((r: any) => r.sales),
      labels: charts.regions.map((r: any) => r.region),
      type: 'pie',
      hole: 0.45,
      marker: { colors: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'] },
      textinfo: 'percent+label',
      hoverinfo: 'label+value'
    }
  ];

  const regionalLayout = {
    title: { text: 'Regional Revenue Contribution', font: { color: '#f1f5f9', size: 12 } },
    margin: { l: 30, r: 30, t: 40, b: 20 },
    height: 230,
    showlegend: false
  };

  // 4. Bar Plot: Top Products
  const productsData = [
    {
      x: charts.products.map((p: any) => p.sales),
      y: charts.products.map((p: any) => p.product_name),
      type: 'bar',
      orientation: 'h',
      marker: { color: '#6366f1' }
    }
  ];

  const productsLayout = {
    title: { text: 'Top 10 Product Sales volume', font: { color: '#f1f5f9', size: 12 } },
    margin: { l: 150, r: 20, t: 40, b: 35 },
    height: 230,
    yaxis: { autorange: 'reversed' }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <MetricCard
          title="Total Revenue"
          value={`$${kpis.total_revenue.toLocaleString()}`}
          subtitle="Net Sales completed"
          icon={DollarSign}
        />
        <MetricCard
          title="Total Profit"
          value={`$${kpis.total_profit.toLocaleString()}`}
          subtitle="Gross Profit margins"
          icon={TrendingUp}
        />
        <MetricCard
          title="Profit Margin"
          value={`${kpis.profit_margin}%`}
          subtitle="Return on Sales index"
          icon={Percent}
        />
        <MetricCard
          title="Orders Count"
          value={kpis.total_orders.toLocaleString()}
          subtitle="Transactions completed"
          icon={ShoppingBag}
        />
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#0c111e]/60 border border-slate-800 rounded-xl p-5 shadow-md">
          {charts.trends.length > 0 ? (
            <PlotlyChart data={trendData} layout={trendLayout} className="h-64" />
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-500 text-xs">No trend logs found.</div>
          )}
        </div>
        
        <div className="bg-[#0c111e]/60 border border-slate-800 rounded-xl p-5 shadow-md">
          {charts.categories.length > 0 ? (
            <PlotlyChart data={categoryData} layout={categoryLayout} className="h-64" />
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-500 text-xs">No category logs found.</div>
          )}
        </div>
      </div>

      {/* Secondary Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 bg-[#0c111e]/60 border border-slate-800 rounded-xl p-5 shadow-md">
          {charts.regions.length > 0 ? (
            <PlotlyChart data={regionalData} layout={regionalLayout} className="h-60" />
          ) : (
            <div className="h-60 flex items-center justify-center text-slate-500 text-xs">No region logs found.</div>
          )}
        </div>
        
        <div className="lg:col-span-3 bg-[#0c111e]/60 border border-slate-800 rounded-xl p-5 shadow-md">
          {charts.products.length > 0 ? (
            <PlotlyChart data={productsData} layout={productsLayout} className="h-60" />
          ) : (
            <div className="h-60 flex items-center justify-center text-slate-500 text-xs">No product logs found.</div>
          )}
        </div>
      </div>

      {/* Statistical Insight Engine Panel */}
      {insights && (
        <div className="bg-[#0c111e]/60 border border-slate-800 rounded-2xl p-6 shadow-md">
          <h4 className="font-semibold text-slate-300 text-xs uppercase tracking-wider mb-6 flex items-center gap-2">
            <Award className="w-4 h-4 text-blue-500" />
            <span>Rule-Based Statistical Insights</span>
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Key Findings */}
            <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-slate-200">
                <Compass className="w-4 h-4 text-blue-400" />
                <h5 className="text-xs font-bold uppercase tracking-wider">Key Findings</h5>
              </div>
              <ul className="space-y-2 text-xs text-slate-400">
                {insights.key_findings.map((f: string, i: number) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-blue-500 font-bold">•</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Business Risks */}
            <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-slate-200">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <h5 className="text-xs font-bold uppercase tracking-wider text-rose-400">Business Risks</h5>
              </div>
              <ul className="space-y-2 text-xs text-slate-400">
                {insights.business_risks.map((r: string, i: number) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-rose-500 font-bold">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Growth Opportunities */}
            <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-slate-200">
                <Lightbulb className="w-4 h-4 text-indigo-400" />
                <h5 className="text-xs font-bold uppercase tracking-wider">Growth Opportunities</h5>
              </div>
              <ul className="space-y-2 text-xs text-slate-400">
                {insights.growth_opportunities.map((o: string, i: number) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-indigo-500 font-bold">•</span>
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommended Actions */}
            <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-slate-200">
                <Compass className="w-4 h-4 text-emerald-400" />
                <h5 className="text-xs font-bold uppercase tracking-wider">Recommended Actions</h5>
              </div>
              <ul className="space-y-2 text-xs text-slate-400">
                {insights.recommended_actions.map((a: string, i: number) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Dashboard;
