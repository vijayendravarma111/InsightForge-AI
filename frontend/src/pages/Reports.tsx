import React, { useState } from 'react';
import { FileText, Download, RefreshCw, CheckCircle, ListPlus } from 'lucide-react';
import { apiService } from '../services/api';

interface ReportsProps {
  tableName: string;
}

export const Reports: React.FC<ReportsProps> = ({ tableName }) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadCompleted, setDownloadCompleted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadCompleted(false);
    setErrorMsg(null);
    
    try {
      const blob = await apiService.getReportBlob(tableName);
      
      // Create url reference for file download
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `executive_report_${tableName}.pdf`);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setDownloadCompleted(true);
    } catch (e: any) {
      console.error(e);
      setErrorMsg("Failed to generate and compile PDF. Check server connection and warehouse schema.");
    } finally {
      setDownloading(false);
    }
  };

  const reportItems = [
    { title: "Business KPIs Summary", desc: "Aggregated Gross Revenue, Profit, Margins, and transaction counts." },
    { title: "Enterprise Data Quality Assessment", desc: "Scores across Completeness, Consistency, Validity, Uniqueness, and Accuracy." },
    { title: "Sales Revenue Forecasting", desc: "Ridge Regression monthly projections with standard error confidence boundaries." },
    { title: "High-Value Customer Tiering Analysis", desc: "Classification metrics (F1-score) and predictor feature rankings." },
    { title: "Anomaly & Fraud Risk Evaluation", desc: "Contamination audits mapping outlier sales and profit levels." },
    { title: "Rule-Based Insight Findings", desc: "Concisely synthesized business Findings, Risks, Growth Opportunities, and Actions." }
  ];

  return (
    <div className="max-w-4xl space-y-6">
      {/* Download card */}
      <div className="bg-[#0c111e]/60 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="p-3.5 bg-blue-600/10 border border-blue-500/20 text-blue-500 rounded-xl shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-200">
              Executive PDF Report Compiler
            </h3>
            <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
              Compile and print a print-ready C-suite PDF summary. The compiler automatically renders static chart visual layouts and injects them directly into the report pages.
            </p>
          </div>
        </div>

        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center justify-center gap-2.5 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-xs font-bold uppercase tracking-wider rounded-xl transition duration-200 shadow-lg shadow-blue-600/10 disabled:opacity-50 h-fit"
        >
          {downloading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span>{downloading ? 'Compiling PDF...' : 'Download Report'}</span>
        </button>
      </div>

      {/* Completion alert */}
      {downloadCompleted && (
        <div className="p-4 rounded-xl border border-emerald-900/30 bg-emerald-950/20 text-xs text-emerald-400 flex items-center gap-2.5 font-semibold">
          <CheckCircle className="w-4 h-4 text-emerald-500" />
          <span>Executive report compiled and downloaded successfully!</span>
        </div>
      )}

      {/* Error alert */}
      {errorMsg && (
        <div className="p-4 rounded-xl border border-rose-900/30 bg-rose-950/20 text-xs text-rose-400 flex items-center gap-2.5 font-semibold">
          <AlertCircle className="w-4 h-4 text-rose-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Document details list */}
      <div className="bg-[#0c111e]/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
        <h4 className="font-semibold text-slate-300 text-xs uppercase tracking-wider mb-5 flex items-center gap-2">
          <ListPlus className="w-4 h-4 text-blue-500" />
          <span>Report Chapters & Sections</span>
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reportItems.map((item, idx) => (
            <div key={idx} className="p-4 bg-slate-900/40 border border-slate-850 rounded-xl space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                <span>{item.title}</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal pl-3">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
import { AlertCircle } from 'lucide-react'; // Fix missing import checks
export default Reports;
