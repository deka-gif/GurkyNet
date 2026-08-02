import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Receipt,
  AlertTriangle,
  Info,
  DollarSign,
  Building,
  Lock
} from 'lucide-react';
import { storageService } from '../../services/storage.service';
import { FinanceTopSummary } from '../../components/finance/FinanceTopSummary';
import { RevenueChart } from '../../components/finance/RevenueChart';
import { PaymentStatusCards } from '../../components/finance/PaymentStatusCards';
import { LatestPaymentsTable } from '../../components/finance/LatestPaymentsTable';
import { FinanceQuickActions } from '../../components/finance/FinanceQuickActions';

export const FinanceDashboard: React.FC = () => {
  const user = storageService.getUser();

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 backdrop-blur-xs text-[11px] font-bold text-emerald-200 border border-emerald-400/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              GurkyNet Finance CMS Workspace
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Finance Management Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed max-w-2xl">
              Selamat datang, <strong>{user?.name || 'Finance Manager'}</strong>. Pantau mutasi kas, indikator pembayaran real-time, dan audit transaksi keuangan.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/dashboard/finance/refund-approval"
              className="px-4 py-2.5 bg-white text-emerald-950 rounded-2xl font-extrabold text-xs shadow-md hover:bg-emerald-50 transition flex items-center gap-2"
            >
              <Receipt className="w-4 h-4 text-emerald-700" />
              <span>Refund Center</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Read-Only Warning Banner */}
      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/80 flex items-start sm:items-center gap-3 text-amber-900 shadow-xs">
        <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex-1 text-xs">
          <div className="font-extrabold text-amber-950">Notice: Finance Dashboard is read-only. No approval yet.</div>
          <p className="text-amber-800/90 mt-0.5">
            Modul keuangan ini difungsikan sebagai dasbor pemantauan audit & indikator kas. Eksekusi pengembalian dana atau approval transaksi dapat diakses via Refund Center.
          </p>
        </div>
        <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-200/60 text-amber-900 font-mono shrink-0">
          <Lock className="w-3 h-3" /> READ-ONLY MODE
        </span>
      </div>

      {/* 1. TOP SUMMARY CARDS */}
      <section className="space-y-2">
        <h2 className="text-sm font-extrabold text-gray-900 uppercase tracking-wider text-[11px]">
          Top Summary
        </h2>
        <FinanceTopSummary />
      </section>

      {/* 2. REVENUE CHART */}
      <section>
        <RevenueChart />
      </section>

      {/* 3. PAYMENT STATUS CARDS */}
      <section>
        <PaymentStatusCards />
      </section>

      {/* 4. QUICK ACTIONS */}
      <section>
        <FinanceQuickActions />
      </section>

      {/* 5. LATEST PAYMENTS TABLE */}
      <section>
        <LatestPaymentsTable />
      </section>
    </div>
  );
};
