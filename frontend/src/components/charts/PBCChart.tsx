import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { PBCAnalysis, Signal } from '../../types';
import { format } from 'date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface PBCChartProps {
  analysis: PBCAnalysis;
  showSigmaLines: boolean;
  title?: string;
}

const PBCChart: React.FC<PBCChartProps> = ({ 
  analysis, 
  showSigmaLines = false,
  title = "Process Behaviour Chart (XmR)" 
}) => {
  const { xChart, mrChart, signals } = analysis;

  // Create signal point colors based on detection rules
  const getPointColors = (dataLength: number, signals: Signal[]) => {
    const colors = new Array(dataLength).fill('#2196F3');
    
    signals.forEach(signal => {
      signal.dataPoints.forEach(pointIndex => {
        if (pointIndex < colors.length) {
          // Color coding based on detection rule severity
          colors[pointIndex] = signal.severity === 'high' ? '#f44336' : 
                             signal.severity === 'moderate' ? '#ff9800' : '#ff5722';
        }
      });
    });
    
    return colors;
  };

  // X Chart (Individual Values Chart) configuration
  const xChartData = {
    labels: xChart.timestamps.map(ts => format(new Date(ts), 'MM/dd/yyyy')),
    datasets: [
      {
        label: 'Individual Values',
        data: xChart.values,
        borderColor: '#2196F3',
        backgroundColor: 'transparent',
        pointBackgroundColor: getPointColors(xChart.values.length, signals),
        pointBorderColor: getPointColors(xChart.values.length, signals),
        pointRadius: 4,
        tension: 0,
        fill: false
      },
      {
        label: 'Average (Center Line)',
        data: Array(xChart.values.length).fill(xChart.average),
        borderColor: '#4CAF50',
        borderDash: [5, 5],
        pointRadius: 0,
        tension: 0,
        fill: false
      },
      {
        label: 'Upper Natural Process Limit (UNPL)',
        data: Array(xChart.values.length).fill(xChart.upperLimit),
        borderColor: '#f44336',
        borderDash: [10, 5],
        pointRadius: 0,
        tension: 0,
        fill: false
      },
      {
        label: 'Lower Natural Process Limit (LNPL)',
        data: Array(xChart.values.length).fill(xChart.lowerLimit),
        borderColor: '#f44336',
        borderDash: [10, 5],
        pointRadius: 0,
        tension: 0,
        fill: false
      }
    ]
  };

  // Add sigma lines if requested (for enhanced signal detection)
  if (showSigmaLines && xChart.sigmaLines) {
    xChartData.datasets.push(
      {
        label: '2-Sigma Upper',
        data: Array(xChart.values.length).fill(xChart.sigmaLines.twoSigmaUpper),
        borderColor: '#FF9800',
        borderDash: [3, 3],
        pointRadius: 0,
        tension: 0,
        fill: false
      },
      {
        label: '2-Sigma Lower', 
        data: Array(xChart.values.length).fill(xChart.sigmaLines.twoSigmaLower),
        borderColor: '#FF9800',
        borderDash: [3, 3],
        pointRadius: 0,
        tension: 0,
        fill: false
      },
      {
        label: '1-Sigma Upper',
        data: Array(xChart.values.length).fill(xChart.sigmaLines.oneSigmaUpper),
        borderColor: '#9C27B0',
        borderDash: [2, 2],
        pointRadius: 0,
        tension: 0,
        fill: false
      },
      {
        label: '1-Sigma Lower',
        data: Array(xChart.values.length).fill(xChart.sigmaLines.oneSigmaLower),
        borderColor: '#9C27B0',
        borderDash: [2, 2],
        pointRadius: 0,
        tension: 0,
        fill: false
      }
    );
  }

  // mR Chart (Moving Range Chart) configuration
  const mrChartData = {
    labels: mrChart.timestamps.map(ts => format(new Date(ts), 'MM/dd/yyyy')),
    datasets: [
      {
        label: 'Moving Range',
        data: mrChart.values,
        borderColor: '#673AB7',
        backgroundColor: 'transparent',
        pointBackgroundColor: '#673AB7',
        pointRadius: 3,
        tension: 0,
        fill: false
      },
      {
        label: 'Average Moving Range',
        data: Array(mrChart.values.length).fill(mrChart.average),
        borderColor: '#4CAF50',
        borderDash: [5, 5],
        pointRadius: 0,
        tension: 0,
        fill: false
      },
      {
        label: 'Upper Range Limit (URL)',
        data: Array(mrChart.values.length).fill(mrChart.upperLimit),
        borderColor: '#f44336',
        borderDash: [10, 5],
        pointRadius: 0,
        tension: 0,
        fill: false
      }
    ]
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          filter: function(item, chart) {
            // Hide sigma lines from legend if not shown
            if (!showSigmaLines && item.text?.includes('Sigma')) {
              return false;
            }
            return true;
          }
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          afterLabel: function(context) {
            // Add signal information to tooltips
            const pointIndex = context.dataIndex;
            const relevantSignals = signals.filter(signal => 
              signal.dataPoints.includes(pointIndex)
            );
            
            if (relevantSignals.length > 0) {
              return relevantSignals.map(signal => 
                `Signal: ${signal.type.toUpperCase()} - ${signal.description}`
              );
            }
            return [];
          }
        }
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Time'
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Value'
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };

  return (
    <div style={{ width: '100%', height: '800px' }}>
      <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>{title}</h3>
      
      {/* X Chart (Individual Values) */}
      <div style={{ height: '400px', marginBottom: '20px' }}>
        <h4 style={{ textAlign: 'center', marginBottom: '10px' }}>
          Individual Values Chart (X Chart)
        </h4>
        <div style={{ height: '350px' }}>
          <Line data={xChartData} options={chartOptions} />
        </div>
      </div>
      
      {/* mR Chart (Moving Range) */}
      <div style={{ height: '300px' }}>
        <h4 style={{ textAlign: 'center', marginBottom: '10px' }}>
          Moving Range Chart (mR Chart)
        </h4>
        <div style={{ height: '250px' }}>
          <Line data={mrChartData} options={chartOptions} />
        </div>
      </div>

      {/* Signal Summary */}
      {signals.length > 0 && (
        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <h4>Detected Signals: {signals.length}</h4>
          <p style={{ fontSize: '12px', color: '#666' }}>
            Red points indicate high severity signals (Rule 1: Points outside Natural Process Limits).
            Orange points indicate moderate severity signals (Rules 2-3: Pattern-based detection).
            Light red points indicate low severity signals (Rule 4: Sustained shifts).
          </p>
        </div>
      )}
    </div>
  );
};

export default PBCChart;
