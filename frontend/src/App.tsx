import { useState } from 'react';
import { Layout } from './components/Layout';
import { Import } from './pages/Import';
import { Profiler } from './pages/Profiler';
import { Cleaning } from './pages/Cleaning';
import { ETL } from './pages/ETL';
import { SQLStudio } from './pages/SQLStudio';
import { Dashboard } from './pages/Dashboard';
import { MLInsights } from './pages/MLInsights';
import { Reports } from './pages/Reports';

function App() {
  const [activeTab, setActiveTab] = useState<string>('import');
  const [tableName, setTableName] = useState<string | null>(null);
  const [etlRun, setEtlRun] = useState<boolean>(false);

  const handleDatasetLoaded = (name: string) => {
    setTableName(name);
    setEtlRun(false); // Reset ETL run flag when a new dataset is loaded
    setActiveTab('profiler'); // Auto-switch tab to profiler
  };

  const handleEtlCompleted = () => {
    setEtlRun(true);
    setActiveTab('dashboard'); // Auto-switch to dashboard when warehouse ETL completes
  };

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      tableName={tableName}
      etlRun={etlRun}
    >
      {activeTab === 'import' && (
        <Import onDatasetLoaded={handleDatasetLoaded} />
      )}
      
      {activeTab === 'profiler' && tableName && (
        <Profiler tableName={tableName} />
      )}
      
      {activeTab === 'cleaning' && tableName && (
        <Cleaning tableName={tableName} />
      )}
      
      {activeTab === 'etl' && tableName && (
        <ETL tableName={tableName} onEtlCompleted={handleEtlCompleted} />
      )}
      
      {activeTab === 'sql' && etlRun && (
        <SQLStudio />
      )}
      
      {activeTab === 'dashboard' && etlRun && (
        <Dashboard />
      )}
      
      {activeTab === 'ml' && etlRun && (
        <MLInsights />
      )}
      
      {activeTab === 'reports' && etlRun && (
        <Reports tableName={tableName!} />
      )}
    </Layout>
  );
}

export default App;
