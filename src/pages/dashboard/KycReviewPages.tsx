import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, IdCard } from 'lucide-react';
import { kycService } from '../../services/kyc/kyc.service';
import { DashboardHeader } from '../../components/common';
import { apiClient } from '../../services/api';

type ReviewBase = 'customer-support' | 'finance';

interface Props {
  base: ReviewBase;
}

export const KycReviewQueuePage: React.FC<Props> = ({ base }) => {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const detailPath = base === 'finance' ? '/dashboard/finance/kyc' : '/dashboard/customer-support/kyc';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await kycService.adminList(base, 'pending');
      setItems(res.data?.items || []);
    } catch (e: any) {
      setError(e?.message || 'Gagal memuat antrean KYC');
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="KYC Review"
        subtitle="Antrean verifikasi identitas Tier 2 (FR-KYC-05)"
        icon={IdCard}
      />
      {error && (
        <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm flex gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      {loading ? (
        <p className="text-sm text-gray-500">Memuat…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">Tidak ada KYC pending.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 divide-y">
          {items.map((row) => (
            <Link
              key={row.id}
              to={`${detailPath}/${row.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
            >
              <div>
                <p className="text-sm font-bold text-gray-900">{row.user?.name || `User #${row.userId}`}</p>
                <p className="text-xs text-gray-500">{row.ktpFullName} · {row.submittedAt || '—'}</p>
              </div>
              <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-100">
                {row.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export const KycReviewDetailPage: React.FC<Props> = ({ base }) => {
  const { id } = useParams();
  const [row, setRow] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const listPath = base === 'finance' ? '/dashboard/finance/kyc' : '/dashboard/customer-support/kyc';

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await kycService.adminShow(base, Number(id));
      setRow(res.data?.verification || null);
    } catch (e: any) {
      setError(e?.message || 'Gagal memuat detail');
    }
  }, [base, id]);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async () => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const res = await kycService.adminApprove(base, Number(id));
      if (!res.success) throw new Error(res.message);
      setInfo('KYC disetujui.');
      setRow(res.data?.verification);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal approve');
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const res = await kycService.adminReject(base, Number(id), reason);
      if (!res.success) throw new Error(res.message);
      setInfo('KYC ditolak.');
      setRow(res.data?.verification);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal reject');
    } finally {
      setBusy(false);
    }
  };

  const openDoc = async (type: 'ktp' | 'selfie') => {
    if (!row?.id) return;
    try {
      const response = await apiClient.get(`/kyc/verifications/${row.id}/documents/${type}`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setError('Tidak dapat membuka dokumen.');
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <DashboardHeader title="Detail KYC" subtitle={`Review #${id}`} icon={IdCard} />
      <Link to={listPath} className="text-xs font-bold text-primary-700">← Kembali ke antrean</Link>
      {error && (
        <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm flex gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      {info && (
        <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-sm flex gap-2">
          <CheckCircle2 className="w-4 h-4" /> {info}
        </div>
      )}
      {!row ? (
        <p className="text-sm text-gray-500">Memuat…</p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3 text-sm">
          <p><span className="text-gray-500">User:</span> <strong>{row.user?.name}</strong> ({row.user?.email})</p>
          <p><span className="text-gray-500">Nama KTP:</span> {row.ktpFullName}</p>
          <p><span className="text-gray-500">NIK (masked):</span> {row.ktpNumberMasked || '—'}</p>
          <p><span className="text-gray-500">Rekening:</span> {row.bankAccountName} · {row.bankAccountNumberMasked} ({row.bankName || '—'})</p>
          <p><span className="text-gray-500">Status:</span> <strong className="uppercase">{row.status}</strong></p>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => openDoc('ktp')} className="px-3 py-2 rounded-xl border text-xs font-bold">Lihat KTP</button>
            <button type="button" onClick={() => openDoc('selfie')} className="px-3 py-2 rounded-xl border text-xs font-bold">Lihat Selfie</button>
          </div>
          {row.status === 'pending' && (
            <div className="pt-4 space-y-3 border-t">
              <button type="button" disabled={busy} onClick={approve} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50">
                Approve
              </button>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Alasan penolakan (wajib jika reject)"
                className="w-full border rounded-xl p-3 text-sm"
                rows={3}
              />
              <button type="button" disabled={busy} onClick={reject} className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold disabled:opacity-50">
                Reject
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
