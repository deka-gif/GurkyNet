import { WifiOff, AlertOctagon, RotateCw, Loader2, Inbox, ShieldAlert } from 'lucide-react';

interface CommonStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryText?: string;
}

// 1. Loading State Component
export const LoadingState = ({ 
  title = 'Memuat Data...', 
  description = 'Mohon tunggu sebentar, sedang mengambil data dari server.' 
}: CommonStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center" id="state-loading">
      <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      <p className="text-sm text-slate-500 mt-1 max-w-md">{description}</p>
    </div>
  );
};

// 2. Empty State Component
export const EmptyState = ({ 
  title = 'Tidak Ada Data', 
  description = 'Saat ini tidak ada data yang tersedia untuk ditampilkan.',
  onRetry,
  retryText = 'Refresh'
}: CommonStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50" id="state-empty">
      <Inbox className="w-12 h-12 text-slate-400 mb-4" />
      <h3 className="text-lg font-semibold text-slate-700">{title}</h3>
      <p className="text-sm text-slate-500 mt-1 max-w-md">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-1.5"
        >
          <RotateCw className="w-3.5 h-3.5" />
          {retryText}
        </button>
      )}
    </div>
  );
};

// 3. Offline State Component
export const OfflineState = ({ 
  title = 'Koneksi Terputus', 
  description = 'Koneksi internet Anda terputus. Silakan periksa koneksi data atau Wi-Fi Anda.',
  onRetry,
  retryText = 'Coba Lagi'
}: CommonStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-amber-50 border border-amber-200 rounded-xl" id="state-offline">
      <WifiOff className="w-12 h-12 text-amber-500 mb-4" />
      <h3 className="text-lg font-semibold text-amber-900">{title}</h3>
      <p className="text-sm text-amber-700 mt-1 max-w-md">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-2 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition flex items-center gap-1.5"
        >
          <RotateCw className="w-3.5 h-3.5" />
          {retryText}
        </button>
      )}
    </div>
  );
};

// 4. Unauthorized State Component
export const UnauthorizedState = ({ 
  title = 'Sesi Berakhir', 
  description = 'Anda belum masuk atau sesi Anda telah kedaluwarsa. Silakan masuk kembali.',
  onRetry,
  retryText = 'Masuk Sekarang'
}: CommonStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-red-50 border border-red-100 rounded-xl" id="state-unauthorized">
      <ShieldAlert className="w-12 h-12 text-red-500 mb-4" />
      <h3 className="text-lg font-semibold text-red-900">{title}</h3>
      <p className="text-sm text-red-700 mt-1 max-w-md">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-2 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-1.5"
        >
          {retryText}
        </button>
      )}
    </div>
  );
};

// 5. Server Error State Component
export const ServerErrorState = ({ 
  title = 'Server Mengalami Gangguan', 
  description = 'Terjadi kesalahan internal pada server kami. Silakan coba beberapa saat lagi.',
  onRetry,
  retryText = 'Muat Ulang'
}: CommonStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-rose-50 border border-rose-100 rounded-xl" id="state-server-error">
      <AlertOctagon className="w-12 h-12 text-rose-500 mb-4" />
      <h3 className="text-lg font-semibold text-rose-900">{title}</h3>
      <p className="text-sm text-rose-700 mt-1 max-w-md">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-2 text-xs font-medium bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition flex items-center gap-1.5"
        >
          <RotateCw className="w-3.5 h-3.5" />
          {retryText}
        </button>
      )}
    </div>
  );
};
