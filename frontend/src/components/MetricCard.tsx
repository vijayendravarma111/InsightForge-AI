import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: {
    value: number;
    type: 'positive' | 'negative' | 'neutral';
  };
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  change,
  icon: Icon,
  loading = false,
}) => {
  return (
    <div className="bg-[#0c111e]/60 border border-slate-800/80 rounded-xl p-5 backdrop-blur-md relative overflow-hidden group shadow-[0_4px_20px_rgba(0,0,0,0.15)]">
      {/* Light glow on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-indigo-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {title}
          </span>
          {loading ? (
            <div className="h-8 w-24 bg-slate-800 rounded animate-pulse" />
          ) : (
            <h3 className="text-2xl font-bold text-slate-100 tracking-tight">
              {value}
            </h3>
          )}
          {subtitle && (
            <p className="text-[11px] text-slate-400 font-medium">{subtitle}</p>
          )}
        </div>
        
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 group-hover:text-blue-400 group-hover:border-blue-500/20 transition-all duration-300">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      
      {change && !loading && (
        <div className="mt-4 pt-4 border-t border-slate-800/40 flex items-center gap-1.5 text-xs">
          <span className={`font-semibold ${
            change.type === 'positive' 
              ? 'text-emerald-500' 
              : change.type === 'negative' 
                ? 'text-rose-500' 
                : 'text-slate-400'
          }`}>
            {change.type === 'positive' ? '+' : ''}{change.value}%
          </span>
          <span className="text-slate-500">vs last period</span>
        </div>
      )}
    </div>
  );
};

export default MetricCard;
