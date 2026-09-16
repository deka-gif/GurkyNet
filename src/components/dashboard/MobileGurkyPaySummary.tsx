import { memo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, Plus } from 'lucide-react';
import { useWalletStore } from '../../store/wallet.store';
import { formatIDR } from '../../utils/currency';

/**
 * Mobile-only GurkyPay balance + monthly summary (Tahap 1).
 * Reuses GET /wallet overview via useWalletStore — same payload as WalletPage.
 * Hidden from lg+ so desktop dashboard layout is unchanged.
 */
export const MobileGurkyPaySummary = memo(function MobileGurkyPaySummary() {
  const navigate = useNavigate();
  const wallet = useWalletStore((s) => s.wallet);
  const summary = useWalletStore((s) => s.summary);
  const loading = useWalletStore((s) => s.loading);
  const fetchWallet = useWalletStore((s) => s.fetchWallet);

  useEffect(() => {
    // Layout usually hydrates wallet already; refresh if empty.
    if (!wallet) void fetchWallet();
  }, [wallet, fetchWallet]);

  const showSkeleton = loading && !wallet;
  const monthIn = Number(summary?.income_this_month ?? 0);
  const monthOut = Number(summary?.expense_this_month ?? 0);
  const mutationCount = Number(summary?.transaction_count ?? 0);

  return (
    <div className="lg:hidden space-y-3">
      {/* Balance card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 p-4 text-white shadow-lg shadow-primary-900/20">
        <div className="pointer-events-none absolute -right-6 -bottom-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />

        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-100/90">
              Saldo GurkyPay
            </p>
            {showSkeleton ? (
              <div className="mt-2 h-8 w-40 animate-pulse rounded-lg bg-white/20" />
            ) : (
              <p className="mt-1 text-2xl font-black tracking-tight tabular-nums">
                {formatIDR(wallet?.balance ?? 0)}
              </p>
            )}
            <p className="mt-3 text-[11px] font-medium text-primary-200/90">
              ID/No. Rekening GurkyPay
            </p>
            {showSkeleton ? (
              <div className="mt-1 h-3.5 w-28 animate-pulse rounded bg-white/15" />
            ) : (
              <p className="mt-0.5 text-xs font-bold tracking-wider text-white/95">
                {wallet?.walletNo || '—'}
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-2">
            <button
              type="button"
              onClick={() => navigate('/dashboard/topup')}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-white px-3.5 py-2.5 text-xs font-bold text-primary-800 shadow-sm active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Top Up
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard/transfer')}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-white/95 px-3.5 py-2.5 text-xs font-bold text-primary-800 shadow-sm active:scale-[0.98]"
            >
              <ArrowLeftRight className="h-4 w-4" strokeWidth={2.5} />
              Transfer
            </button>
          </div>
        </div>
      </div>

      {/* Monthly summary strip */}
      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm shadow-slate-200/40">
        <SummaryCell
          loading={showSkeleton}
          value={formatIDR(monthIn)}
          label="Pemasukan"
          sublabel="bulan ini"
        />
        <SummaryCell
          loading={showSkeleton}
          value={formatIDR(monthOut)}
          label="Pengeluaran"
          sublabel="bulan ini"
        />
        <SummaryCell
          loading={showSkeleton}
          value={String(mutationCount)}
          label="Mutasi"
          sublabel="tercatat"
        />
      </div>
    </div>
  );
});

function SummaryCell({
  loading,
  value,
  label,
  sublabel,
}: {
  loading: boolean;
  value: string;
  label: string;
  sublabel: string;
}) {
  return (
    <div className="min-w-0 text-center">
      {loading ? (
        <div className="mx-auto h-4 w-14 animate-pulse rounded bg-slate-100" />
      ) : (
        <p className="truncate text-sm font-extrabold tabular-nums text-gray-900">{value}</p>
      )}
      <p className="mt-1 text-[11px] font-semibold leading-tight text-gray-500">{label}</p>
      <p className="text-[10px] font-medium text-gray-400">{sublabel}</p>
    </div>
  );
}

export default MobileGurkyPaySummary;
