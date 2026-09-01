import { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  Gamepad2,
  History,
  PackageOpen,
  Smartphone,
  Wifi,
  XCircle,
  Zap,
} from 'lucide-react';
import type { Transaction } from '../../types';
import { formatIDR } from '../../utils/currency';
import {
  isFailedStatus,
  isPendingStatus,
  isSuccessStatus,
} from '../../utils/transactionStatus';
import {
  formatTransactionDateTime,
  maskTargetNumber,
} from '../../utils/transactionDisplay';

type RecentTransactionsCardProps = {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  limit?: number;
};

function serviceTone(tx: Transaction) {
  const s = `${tx.serviceName || ''} ${tx.productName || ''}`.toLowerCase();
  if (s.includes('pulsa')) return { box: 'bg-blue-50 text-blue-600 border-blue-100', Icon: Smartphone };
  if (s.includes('pln') || s.includes('listrik')) {
    return { box: 'bg-amber-50 text-amber-600 border-amber-100', Icon: Zap };
  }
  if (s.includes('game')) return { box: 'bg-purple-50 text-purple-600 border-purple-100', Icon: Gamepad2 };
  if (s.includes('data') || s.includes('paket')) {
    return { box: 'bg-cyan-50 text-cyan-600 border-cyan-100', Icon: Wifi };
  }
  return { box: 'bg-emerald-50 text-emerald-600 border-emerald-100', Icon: CreditCard };
}

function StatusBadge({ status }: { status: Transaction['status'] }) {
  if (isSuccessStatus(status)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        Success
      </span>
    );
  }
  if (isPendingStatus(status)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
        <Clock className="h-3 w-3" />
        Pending
      </span>
    );
  }
  if (isFailedStatus(status)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
        <XCircle className="h-3 w-3" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600">
      {String(status)}
    </span>
  );
}

/**
 * Dynamic "Transaksi Terakhir" list (max N) from user transaction store.
 */
export const RecentTransactionsCard = memo(function RecentTransactionsCard({
  transactions,
  loading,
  error,
  onRetry,
  limit = 5,
}: RecentTransactionsCardProps) {
  const navigate = useNavigate();

  const items = useMemo(() => {
    const list = Array.isArray(transactions) ? [...transactions] : [];
    list.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    return list.slice(0, limit);
  }, [transactions, limit]);

  return (
    <div className="flex flex-col justify-between rounded-3xl border border-gray-100 bg-white p-6 shadow-xl shadow-gray-200/50 lg:col-span-7">
      <div>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900">Transaksi Terakhir</h2>
            <p className="mt-0.5 text-xs text-gray-400">
              {limit} aktivitas transaksi terbaru Anda
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard/riwayat')}
            className="flex cursor-pointer items-center gap-1 text-xs font-bold text-primary-600 hover:text-primary-700 hover:underline"
          >
            Semua Transaksi <History className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="divide-y divide-gray-50">
          {loading && items.length === 0 ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-2">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 animate-pulse rounded-xl bg-gray-100" />
                    <div className="space-y-1.5">
                      <div className="h-3.5 w-32 animate-pulse rounded bg-gray-200" />
                      <div className="h-2.5 w-24 animate-pulse rounded bg-gray-100" />
                    </div>
                  </div>
                  <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                </div>
              ))}
            </div>
          ) : error && items.length === 0 ? (
            <div className="py-8 text-center">
              <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-400" />
              <p className="mb-2 text-xs font-bold text-red-600">Gagal memuat riwayat transaksi</p>
              <button
                type="button"
                onClick={onRetry}
                className="cursor-pointer rounded-xl bg-primary-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-700"
              >
                Coba Lagi
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-gray-300">
                <PackageOpen className="h-7 w-7" />
              </div>
              <h4 className="mb-1 text-sm font-bold text-gray-800">Belum Ada Transaksi</h4>
              <p className="mb-4 max-w-xs text-xs text-gray-400">
                Riwayat akan muncul di sini setelah Anda melakukan transaksi pertama.
              </p>
              <button
                type="button"
                onClick={() => navigate('/dashboard/pulsa')}
                className="cursor-pointer rounded-xl bg-primary-50 px-4 py-2 text-xs font-bold text-primary-600 transition-colors hover:bg-primary-100"
              >
                Mulai Transaksi Pertama
              </button>
            </div>
          ) : (
            items.map((tx) => {
              const { box, Icon } = serviceTone(tx);
              const detailId = tx.id || tx.transactionCode;

              return (
                <button
                  key={String(detailId)}
                  type="button"
                  onClick={() => navigate(`/dashboard/riwayat/${encodeURIComponent(String(detailId))}`)}
                  className="group flex w-full cursor-pointer items-center justify-between rounded-2xl px-2.5 py-3.5 text-left transition-all hover:bg-gray-50/80"
                  title="Lihat detail transaksi"
                >
                  <div className="flex min-w-0 items-center gap-3.5">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${box}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold text-gray-900 transition-colors group-hover:text-primary-600">
                        {tx.productName || tx.serviceName || 'Transaksi PPOB'}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-gray-400">
                        {maskTargetNumber(tx.targetNo)} · {formatTransactionDateTime(tx.date)}
                      </div>
                    </div>
                  </div>

                  <div className="ml-3 shrink-0 text-right">
                    <div className="text-sm font-black tabular-nums text-gray-900">
                      {formatIDR(tx.amount || 0)}
                    </div>
                    <div className="mt-1 flex justify-end">
                      <StatusBadge status={tx.status} />
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
});

export default RecentTransactionsCard;
