import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Upload } from 'lucide-react';
import { kycService, KycStatusPayload } from '../../../services/kyc/kyc.service';
import { AccountCard } from './AccountShell';
import { toastError, toastSuccess } from '../../../hooks/useToast';

export const AccountKycPage: React.FC = () => {
  const [status, setStatus] = useState<KycStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [phoneCode, setPhoneCode] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [ktpName, setKtpName] = useState('');
  const [ktpNumber, setKtpNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [ktpFile, setKtpFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (error) toastError('Terjadi Kesalahan', error);
  }, [error]);

  useEffect(() => {
    if (info) toastSuccess('Berhasil', info);
  }, [info]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await kycService.status();
      if (res.success && res.data) {
        setStatus(res.data);
      } else {
        setError(res.message || 'Gagal memuat status KYC');
      }
    } catch (e: any) {
      setError(e?.message || 'Gagal memuat status KYC');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Operasi gagal');
    } finally {
      setBusy(false);
    }
  };

  const submitTier2 = () =>
    run(async () => {
      if (!ktpFile || !selfieFile) {
        throw new Error('Unggah foto KTP dan selfie wajib.');
      }
      const form = new FormData();
      form.append('ktp_full_name', ktpName);
      form.append('ktp_number', ktpNumber);
      form.append('bank_name', bankName);
      form.append('bank_account_name', bankAccountName);
      form.append('bank_account_number', bankAccountNumber);
      form.append('ktp_photo', ktpFile);
      form.append('selfie_photo', selfieFile);
      const res = await kycService.submitTier2(form);
      if (!res.success) throw new Error(res.message || 'Gagal submit KYC');
      setInfo('Pengajuan KYC Tier 2 terkirim. Menunggu review CS/Finance.');
    });

  if (loading && !status) {
    return <p className="text-sm text-gray-500">Memuat status KYC…</p>;
  }

  const tier1 = status?.tier1;
  const tier2 = status?.tier2;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Akun</p>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Verifikasi KYC</h1>
        <p className="text-sm text-gray-500 mt-1">Tier 1 (HP + email) wajib sebelum transaksi. Tier 2 wajib sebelum withdraw agen.</p>
      </div>

      <AccountCard>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-5 h-5 text-primary-600" />
          <h2 className="font-extrabold text-gray-900">Status</h2>
        </div>
        <p className="text-sm text-gray-700">
          Status keseluruhan:{' '}
          <span className="font-bold uppercase">{status?.kycStatus || 'unverified'}</span>
        </p>
        <ul className="mt-3 text-sm text-gray-600 space-y-1">
          <li>HP: {tier1?.phoneVerified ? 'Terverifikasi' : 'Belum'}</li>
          <li>Email: {tier1?.emailVerified ? 'Terverifikasi' : 'Belum'}</li>
          <li>Tier 2: {tier2?.status || 'belum diajukan'}</li>
        </ul>
        {tier2?.rejectionReason && (
          <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-3">
            Alasan penolakan: {tier2.rejectionReason}
          </p>
        )}
      </AccountCard>

      <AccountCard>
        <h2 className="font-extrabold text-gray-900 mb-3">Tier 1 — Verifikasi HP</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !!tier1?.phoneVerified}
            onClick={() =>
              run(async () => {
                const res = await kycService.requestPhoneOtp();
                if (!res.success) throw new Error(res.message);
                setInfo(res.data?.dummy_sent_code ? `OTP (dev): ${res.data.dummy_sent_code}` : 'OTP HP dikirim.');
              })
            }
            className="px-3 py-2 rounded-xl bg-primary-600 text-white text-xs font-bold disabled:opacity-50"
          >
            Kirim OTP HP
          </button>
          <input
            value={phoneCode}
            onChange={(e) => setPhoneCode(e.target.value)}
            placeholder="Kode 6 digit"
            className="px-3 py-2 border rounded-xl text-sm"
            maxLength={6}
          />
          <button
            type="button"
            disabled={busy || !!tier1?.phoneVerified}
            onClick={() =>
              run(async () => {
                const res = await kycService.verifyPhone(phoneCode);
                if (!res.success) throw new Error(res.message);
                setInfo('HP terverifikasi.');
              })
            }
            className="px-3 py-2 rounded-xl border text-xs font-bold disabled:opacity-50"
          >
            Verifikasi HP
          </button>
        </div>
      </AccountCard>

      <AccountCard>
        <h2 className="font-extrabold text-gray-900 mb-3">Tier 1 — Verifikasi Email</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !!tier1?.emailVerified}
            onClick={() =>
              run(async () => {
                const res = await kycService.requestEmailOtp();
                if (!res.success) throw new Error(res.message);
                setInfo(res.data?.dummy_sent_code ? `OTP (dev): ${res.data.dummy_sent_code}` : 'OTP email dikirim.');
              })
            }
            className="px-3 py-2 rounded-xl bg-primary-600 text-white text-xs font-bold disabled:opacity-50"
          >
            Kirim OTP Email
          </button>
          <input
            value={emailCode}
            onChange={(e) => setEmailCode(e.target.value)}
            placeholder="Kode 6 digit"
            className="px-3 py-2 border rounded-xl text-sm"
            maxLength={6}
          />
          <button
            type="button"
            disabled={busy || !!tier1?.emailVerified}
            onClick={() =>
              run(async () => {
                const res = await kycService.verifyEmail(emailCode);
                if (!res.success) throw new Error(res.message);
                setInfo('Email terverifikasi.');
              })
            }
            className="px-3 py-2 rounded-xl border text-xs font-bold disabled:opacity-50"
          >
            Verifikasi Email
          </button>
        </div>
      </AccountCard>

      <AccountCard>
        <div className="flex items-center gap-2 mb-3">
          <Upload className="w-5 h-5 text-primary-600" />
          <h2 className="font-extrabold text-gray-900">Tier 2 — KTP + Selfie + Rekening</h2>
        </div>
        {!tier1?.complete && (
          <p className="text-sm text-amber-700 mb-3">Selesaikan Tier 1 sebelum mengajukan Tier 2.</p>
        )}
        {tier2?.status === 'pending' && (
          <p className="text-sm text-indigo-700 mb-3">Pengajuan Anda sedang menunggu review.</p>
        )}
        {tier2?.status === 'approved' && (
          <p className="text-sm text-emerald-700 mb-3">KYC Tier 2 sudah disetujui.</p>
        )}
        {(tier2?.status !== 'approved' && tier2?.status !== 'pending') && (
          <div className="space-y-3">
            <input className="w-full px-3 py-2 border rounded-xl text-sm" placeholder="Nama sesuai KTP" value={ktpName} onChange={(e) => setKtpName(e.target.value)} />
            <input className="w-full px-3 py-2 border rounded-xl text-sm" placeholder="Nomor KTP" value={ktpNumber} onChange={(e) => setKtpNumber(e.target.value)} />
            <input className="w-full px-3 py-2 border rounded-xl text-sm" placeholder="Bank" value={bankName} onChange={(e) => setBankName(e.target.value)} />
            <input className="w-full px-3 py-2 border rounded-xl text-sm" placeholder="Nama pemilik rekening (harus sama dengan KTP)" value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} />
            <input className="w-full px-3 py-2 border rounded-xl text-sm" placeholder="Nomor rekening" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} />
            <label className="block text-xs font-bold text-gray-600">Foto KTP
              <input type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block w-full text-sm" onChange={(e) => setKtpFile(e.target.files?.[0] || null)} />
            </label>
            <label className="block text-xs font-bold text-gray-600">Selfie pegang KTP
              <input type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block w-full text-sm" onChange={(e) => setSelfieFile(e.target.files?.[0] || null)} />
            </label>
            <button
              type="button"
              disabled={busy || !tier1?.complete}
              onClick={submitTier2}
              className="px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-bold disabled:opacity-50"
            >
              Ajukan KYC Tier 2
            </button>
          </div>
        )}
      </AccountCard>
    </div>
  );
};
