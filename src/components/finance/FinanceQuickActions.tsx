import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building, Receipt, Activity, FileSpreadsheet, Info, CheckCircle2, ShieldAlert } from 'lucide-react';

export const FinanceQuickActions: React.FC = () => {
  const [activeModal, setActiveModal] = useState<string | null>(null);

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
      <div className="border-b border-gray-100 pb-3">
        <h2 className="text-base font-extrabold text-gray-900">Aksi Cepat (Quick Actions)</h2>
        <p className="text-xs text-gray-500">Pilihan pintasan modul finansial & audit keuangan</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Settlement Button */}
        <Link
          to="/dashboard/finance/settlement"
          className="p-4 rounded-2xl bg-blue-50 hover:bg-blue-100/80 border border-blue-100 text-left transition-all group flex flex-col justify-between space-y-2"
        >
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <div className="font-extrabold text-blue-950 text-xs">Settlement</div>
            <p className="text-[10px] text-blue-700 mt-0.5">Rekonsiliasi dana bank & gateway</p>
          </div>
        </Link>

        {/* Refund Center Button */}
        <Link
          to="/dashboard/finance/refund-approval"
          className="p-4 rounded-2xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-100 text-left transition-all group flex flex-col justify-between space-y-2"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="font-extrabold text-emerald-950 text-xs">Refund Center</div>
            <p className="text-[10px] text-emerald-700 mt-0.5">Persetujuan pengembalian dana</p>
          </div>
        </Link>

        {/* Payment Monitoring Button */}
        <button
          onClick={() => setActiveModal('Payment Monitoring')}
          className="p-4 rounded-2xl bg-purple-50 hover:bg-purple-100/80 border border-purple-100 text-left transition-all group flex flex-col justify-between space-y-2"
        >
          <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="font-extrabold text-purple-950 text-xs">Payment Monitoring</div>
            <p className="text-[10px] text-purple-700 mt-0.5">Pantau latency & status VA/QRIS</p>
          </div>
        </button>

        {/* Financial Report Button */}
        <Link
          to="/dashboard/finance/financial-report"
          className="p-4 rounded-2xl bg-amber-50 hover:bg-amber-100/80 border border-amber-100 text-left transition-all group flex flex-col justify-between space-y-2"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="font-extrabold text-amber-950 text-xs">Financial Report</div>
            <p className="text-[10px] text-amber-700 mt-0.5">Ringkasan buku kas & ledger</p>
          </div>
        </Link>
      </div>

      {/* Info Modal for Read-Only Quick Actions */}
      {activeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-sm w-full rounded-3xl p-6 shadow-2xl space-y-4 border border-gray-100 text-center">
            <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-extrabold text-gray-900 text-base">{activeModal} Portal</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Modul <strong>{activeModal}</strong> berada dalam mode Read-Only pada Sprint 32 Finance Foundation.
              </p>
            </div>

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100 text-[11px] text-amber-800 text-left">
              Pemrosesan pembayaran dan persetujuan settlement dikelola sesuai dengan kebijakan otorisasi modul keuangan.
            </div>

            <button
              onClick={() => setActiveModal(null)}
              className="w-full bg-gray-900 text-white text-xs font-bold py-3 rounded-2xl hover:bg-gray-800 transition"
            >
              Tutup Modal
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
