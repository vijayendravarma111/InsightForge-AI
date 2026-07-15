import React from 'react';
import { 
  Database, 
  BarChart3, 
  Sparkles, 
  Wind, 
  Terminal, 
  PieChart, 
  BrainCircuit, 
  FileText, 
  Activity
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  tableName: string | null;
  etlRun: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  setActiveTab, 
  tableName,
  etlRun
}) => {
  const menuItems = [
    { id: 'import', name: 'Data Ingestion', icon: Database },
    { id: 'profiler', name: 'Data Profiling', icon: BarChart3, disabled: !tableName },
    { id: 'cleaning', name: 'Data Cleaning', icon: Sparkles, disabled: !tableName },
    { id: 'etl', name: 'ETL & Warehouse', icon: Wind, disabled: !tableName },
    { id: 'sql', name: 'SQL Analytics Studio', icon: Terminal, disabled: !etlRun },
    { id: 'dashboard', name: 'Business Dashboard', icon: PieChart, disabled: !etlRun },
    { id: 'ml', name: 'Machine Learning', icon: BrainCircuit, disabled: !etlRun },
    { id: 'reports', name: 'Executive Reports', icon: FileText, disabled: !etlRun }
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#070b13] text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-[#0c111e]/90 flex flex-col justify-between backdrop-blur-md">
        <div>
          {/* Brand header */}
          <div className="h-16 flex items-center px-6 border-b border-slate-800/80 gap-3">
            <div className="p-2 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.1)]">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-wide bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                InsightForge AI
              </h1>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                Enterprise Analytics
              </p>
            </div>
          </div>

          {/* Table Active Status */}
          <div className="px-6 py-4 border-b border-slate-800/60 bg-[#0d1527]/30">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span>Active Dataset:</span>
              <span className="flex items-center gap-1">
                <Activity className={`w-3 h-3 ${tableName ? 'text-emerald-500' : 'text-slate-600 animate-pulse'}`} />
                <span className={tableName ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
                  {tableName ? 'Online' : 'None'}
                </span>
              </span>
            </div>
            <p className="text-xs truncate font-mono bg-slate-900/60 border border-slate-800/40 rounded px-2 py-1 text-slate-300">
              {tableName || 'Select dataset to start...'}
            </p>
          </div>

          {/* Navigation menu */}
          <nav className="p-4 space-y-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              return (
                <button
                  key={item.id}
                  disabled={item.disabled}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive 
                      ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.08)]' 
                      : item.disabled
                        ? 'text-slate-600 cursor-not-allowed opacity-40'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/20 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Warehouse Connected</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#070b13]">
        {/* Header bar */}
        <header className="h-16 border-b border-slate-800/80 bg-[#0c111e]/30 flex items-center justify-between px-8 backdrop-blur-sm z-10">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-wide text-slate-200 capitalise">
              {activeTab === 'etl' ? 'ETL Pipeline & Data Warehouse' : activeTab.replace('-', ' ')}
            </h2>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-800 px-3 py-1 rounded-full text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Warehouse:</span>
              <span className="text-blue-400">PostgreSQL</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-800 px-3 py-1 rounded-full text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Engine:</span>
              <span className="text-indigo-400">DuckDB</span>
            </div>
          </div>
        </header>

        {/* Dynamic page container */}
        <div className="flex-1 overflow-y-auto p-8 relative">
          {children}
        </div>
      </main>
    </div>
  );
};
export default Layout;
