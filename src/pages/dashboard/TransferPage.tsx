import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
  ArrowRight, 
  Wallet,
  RefreshCw,
  Building2,
  ShieldCheck
} from 'lucide-react';
import { useWalletStore } from '../../store/wallet.store';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { buildCreatePinUrl, PENDING_TRANSFER_KEY } from '../../utils/pinGate';
import { formatIDR } from '../../utils/currency';
import { getOrCreateIdempotencyKey } from '../../utils/idempotency';
import { toastError, toastSuccess } from '../../hooks/useToast';

const QUICK_AMOUNTS = [25_000, 50_000, 100_000, 200_000, 500_000] as const;

/**
 * Transfer page — P2P wallet transfer only.
 * Bank / BI-FAST transfer is not implemented; that path is disabled honestly.
 */
export const TransferPage = () => {
  const { wallet, fetchWallet, transfer, loading } = useWalletStore();
  const { user, fetchUser } = useAuth();
  const navigate = useNavigate();

  const [transferType, setTransferType] = useState<'bank' | 'p2p'>('p2p');
  const [accountNo, setAccountNo] = useState('');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // SRS 14.1 — one idempotency key per logical transfer; reused across retries, reset
  // only once the transfer reaches a terminal (successful) outcome.
  const transferIdemRef = useRef<string | null>(null);

  useEffect(() => {
    if (errorMsg) toastError('Terjadi Kesalahan', errorMsg);
  }, [errorMsg]);

  useEffect(() => {
    if (successMsg) toastSuccess('Berhasil', successMsg);
  }, [successMsg]);

  useEffect(() => {
    fetchWallet();
    fetchUser();
    try {
      const raw = sessionStorage.getItem(PENDING_TRANSFER_KEY);
      if (raw) {
        const pending = JSON.parse(raw);
        sessionStorage.removeItem(PENDING_TRANSFER_KEY);
        if (pending?.accountNo) setAccountNo(pending.accountNo);
        if (pending?.amount) setAmount(pending.amount);
        if (pending?.transferType) setTransferType(pending.transferType);
      }
    } catch {
      sessionStorage.removeItem(PENDING_TRANSFER_KEY);
    }
  }, [fetchWallet, fetchUser]);

  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (transferType === 'bank') {
      setErrorMsg('Transfer ke rekening bank belum tersedia. Gunakan transfer sesama GurkyPay (P2P).');
      return;
    }

    if (!user?.hasPin) {
      sessionStorage.setItem(
        PENDING_TRANSFER_KEY,
        JSON.stringify({ accountNo, amount, transferType })
      );
      navigate(buildCreatePinUrl('/dashboard/transfer'));
      return;
    }

    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount < 1000) {
      setErrorMsg('Minimal transfer dana adalah Rp 1.000');
      return;
    }

    if (!accountNo.trim()) {
      setErrorMsg('Mohon isi nomor wallet tujuan.');
      return;
    }

    if (!/^\d{6}$/.test(pin)) {
      setErrorMsg('PIN transaksi harus 6 digit angka.');
      return;
    }

    if (!wallet || wallet.balance < parsedAmount) {
      setErrorMsg('Saldo GurkyPay Anda tidak mencukupi.');
      return;
    }

    const idempotencyKey = getOrCreateIdempotencyKey(transferIdemRef);
    const res = await transfer(accountNo.trim(), parsedAmount, pin, idempotencyKey);
    if (res) {
      setSuccessMsg(`Transfer sebesar ${formatIDR(parsedAmount)} berhasil diproses ke ${accountNo.trim()}.`);
      setAccountNo('');
      setAmount('');
      setPin('');
      fetchWallet();
      transferIdemRef.current = null;
    } else {
      setErrorMsg('Gagal memproses transfer. Pastikan PIN benar, wallet tujuan valid, dan saldo mencukupi.');
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 container mx-auto max-w-2xl" id="transfer-page-root">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Kirim Uang</h2>
          <p className="text-sm text-gray-500">Transfer sesama wallet GurkyPay (P2P).</p>
        </div>
        <div className="bg-primary-50 px-4 py-2 rounded-2xl border border-primary-100 flex items-center gap-2 shrink-0">
          <Wallet className="w-4 h-4 text-primary-600" />
          <span className="text-xs font-black text-primary-950">
            Saldo: {wallet ? formatIDR(wallet.balance) : 'Loading...'}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex bg-gray-50 p-1 rounded-2xl border border-gray-200/60">
            <button
              type="button"
              onClick={() => {
                setTransferType('p2p');
                setErrorMsg(null);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${transferType === 'p2p' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500'}`}
            >
              Sesama GurkyPay (P2P)
            </button>
            <button
              type="button"
              onClick={() => {
                setTransferType('bank');
                setErrorMsg('Transfer ke rekening bank belum tersedia. Integrasi payout bank belum diimplementasikan.');
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${transferType === 'bank' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-500'}`}
            >
              Rekening Bank
            </button>
          </div>

          {transferType === 'bank' && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex gap-3 items-start">
              <Building2 className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h5 className="text-sm font-bold text-amber-900">Bank transfer belum tersedia</h5>
                <p className="text-xs text-amber-800 mt-1">
                  Fitur transfer ke rekening bank (BI-FAST / online) belum diimplementasikan.
                  Tidak ada transaksi yang akan dikirim. Gunakan transfer sesama GurkyPay.
                </p>
              </div>
            </div>
          )}

          {transferType === 'p2p' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">Nomor Wallet Tujuan</label>
                <div className="relative">
                  <User className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text"
                    placeholder="Contoh: 104200000003"
                    value={accountNo}
                    onChange={(e) => setAccountNo(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all tracking-wide"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">Jumlah Transfer</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-gray-400">Rp</span>
                  <input 
                    type="number"
                    placeholder="Minimal Rp 1.000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {QUICK_AMOUNTS.map((nominal) => {
                  const active = amount === String(nominal);
                  return (
                    <button
                      key={nominal}
                      type="button"
                      onClick={() => setAmount(String(nominal))}
                      className={`py-2 rounded-xl text-[10px] font-extrabold transition-colors ${
                        active
                          ? 'border border-primary-600 bg-primary-50 text-primary-700'
                          : 'border border-gray-200 bg-white text-gray-700 hover:border-primary-200'
                      }`}
                    >
                      {(nominal / 1000).toLocaleString('id-ID')}k
                    </button>
                  );
                })}
              </div>

              {accountNo.trim() && parseInt(amount, 10) >= 1000 && (
                <div className="rounded-2xl border border-dashed border-primary-300 bg-primary-50/60 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary-600 shrink-0" />
                    <p className="text-xs font-extrabold text-primary-900">Periksa sebelum kirim</p>
                  </div>
                  <div className="text-xs text-gray-700 space-y-1">
                    <p>
                      <span className="text-gray-500">Tujuan:</span>{' '}
                      <span className="font-bold font-mono">{accountNo.trim()}</span>
                    </p>
                    <p>
                      <span className="text-gray-500">Nominal:</span>{' '}
                      <span className="font-bold">{formatIDR(parseInt(amount, 10))}</span>
                    </p>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    Pastikan nomor wallet tujuan sudah benar. Transfer P2P tidak dapat dibatalkan setelah PIN
                    dimasukkan.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">PIN Transaksi</label>
                <input 
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6 digit PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-3.5 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white rounded-2xl font-bold text-sm tracking-wide shadow-lg shadow-primary-500/10 transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <span>Kirim Transfer P2P</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
