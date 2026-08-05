import React, { ErrorInfo, ReactNode } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackSubtitle?: string;
  height?: string | number;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ChartErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[ChartErrorBoundary] Caught chart rendering error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      const heightStyle = typeof this.props.height === 'number' 
        ? `${this.props.height}px` 
        : (this.props.height || '100%');

      return (
        <div 
          style={{ height: heightStyle }}
          className="w-full min-h-[160px] bg-slate-50/70 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-6 text-center space-y-2"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <BarChart3 className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-gray-700">
            {this.props.fallbackTitle || 'Data visualisasi belum tersedia'}
          </p>
          <p className="text-[11px] text-gray-400 max-w-xs">
            {this.props.fallbackSubtitle || 'Grafik akan otomatis dirender saat metrik analytics terbaru diterima.'}
          </p>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg text-[10px] font-bold shadow-xs transition"
          >
            <RefreshCw className="w-3 h-3 text-purple-600" />
            <span>Muat Ulang Grafik</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

