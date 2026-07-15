import React, { useEffect, useRef } from 'react';

interface PlotlyChartProps {
  data: any[];
  layout: any;
  config?: any;
  className?: string;
}

declare global {
  interface Window {
    Plotly: any;
  }
}

export const PlotlyChart: React.FC<PlotlyChartProps> = ({ data, layout, config, className = "h-72 w-full" }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chartRef.current && window.Plotly) {
      // Deep dark dashboard theme styling defaults
      const defaultLayout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#94a3b8', family: 'Inter, sans-serif', size: 11 },
        margin: { t: 45, r: 20, l: 50, b: 40 },
        xaxis: {
          gridcolor: '#1e293b',
          zerolinecolor: '#1e293b',
          tickcolor: '#1e293b',
          linecolor: '#1e293b'
        },
        yaxis: {
          gridcolor: '#1e293b',
          zerolinecolor: '#1e293b',
          tickcolor: '#1e293b',
          linecolor: '#1e293b'
        },
        ...layout
      };
      
      const defaultConfig = {
        responsive: true,
        displayModeBar: false,
        ...config
      };

      window.Plotly.newPlot(chartRef.current, data, defaultLayout, defaultConfig);
    }
  }, [data, layout, config]);

  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current && window.Plotly) {
        window.Plotly.Plots.resize(chartRef.current);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current && window.Plotly) {
        window.Plotly.purge(chartRef.current);
      }
    };
  }, []);

  return <div ref={chartRef} className={className} />;
};

export default PlotlyChart;
