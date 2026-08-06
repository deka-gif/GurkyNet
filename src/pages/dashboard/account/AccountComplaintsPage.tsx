import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { complaintService } from '../../../services/account/complaint.service';
import { AccountShell, AccountCard } from './AccountShell';

export const AccountComplaintsPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    complaintService
      .list()
      .then((res) => setItems(Array.isArray(res.data) ? res.data : []))
      .catch((e) => setErr(e?.message || 'Gagal memuat komplain'));
  }, []);

  return (
    <AccountShell title="Complaint Center" subtitle="Buat dan lacak tiket komplain Anda.">
      {err && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{err}</div>}
      <div className="flex justify-end">
        <Link to="/dashboard/account/complaints/new" className="px-3 py-2 rounded-xl bg-primary-600 text-white text-xs font-bold">
          Buat Tiket
        </Link>
      </div>
      <div className="space-y-3">
        {items.map((t) => (
          <Link key={t.id} to={`/dashboard/account/complaints/${t.id}`} className="block">
            <AccountCard className="hover:border-primary-100 transition">
              <div className="flex justify-between gap-2">
                <p className="text-sm font-extrabold text-gray-900">{t.subject || t.category}</p>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{t.status}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{t.ticketNumber || t.ticket_number}</p>
              <p className="text-xs text-gray-600 mt-2 line-clamp-2">{t.description}</p>
            </AccountCard>
          </Link>
        ))}
        {items.length === 0 && !err && <AccountCard><p className="text-sm text-gray-500 text-center py-6">Belum ada tiket.</p></AccountCard>}
      </div>
    </AccountShell>
  );
};

export const AccountComplaintCreatePage: React.FC = () => {
  const [category, setCategory] = useState('Transaksi');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append('category', category);
      fd.append('subject', subject);
      fd.append('description', description);
      if (file) fd.append('attachment', file);
      const res = await complaintService.create(fd);
      if (res.success) setMsg('Tiket berhasil dibuat.');
      else setErr(res.message);
    } catch (e: any) {
      setErr(e?.message || 'Gagal membuat tiket');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccountShell title="Buat Komplain" backTo="/dashboard/account/complaints">
      {msg && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{msg}</div>}
      {err && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{err}</div>}
      <AccountCard>
        <form onSubmit={submit} className="space-y-3">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
            <option>Transaksi</option>
            <option>Wallet</option>
            <option>Akun</option>
            <option>Lainnya</option>
          </select>
          <input required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subjek" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
          <textarea required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deskripsi" rows={5} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button disabled={busy} type="submit" className="px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-bold disabled:opacity-50">Kirim</button>
        </form>
      </AccountCard>
    </AccountShell>
  );
};

export const AccountComplaintDetailPage: React.FC = () => {
  const { id } = useParams();
  const [ticket, setTicket] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    complaintService.show(id).then((res) => setTicket(res.data)).catch((e) => setErr(e?.message || 'Gagal memuat'));
  }, [id]);

  return (
    <AccountShell title="Detail Komplain" backTo="/dashboard/account/complaints">
      {err && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{err}</div>}
      {ticket && (
        <AccountCard>
          <div className="flex justify-between gap-2">
            <h2 className="text-base font-extrabold text-gray-900">{ticket.subject}</h2>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100">{ticket.status}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{ticket.ticketNumber}</p>
          <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap">{ticket.description}</p>
          {ticket.adminReply && (
            <div className="mt-4 rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-3">
              <p className="text-[10px] font-bold uppercase text-indigo-500">Balasan Admin</p>
              <p className="text-sm text-indigo-900 mt-1">{ticket.adminReply}</p>
            </div>
          )}
          <div className="mt-4 space-y-2">
            {(ticket.replies || []).map((r: any) => (
              <div key={r.id} className={`rounded-xl px-3 py-2 text-xs ${r.isStaff ? 'bg-indigo-50' : 'bg-slate-50'}`}>
                <p className="font-bold">{r.userName || (r.isStaff ? 'Admin' : 'Anda')}</p>
                <p className="mt-1">{r.message}</p>
              </div>
            ))}
          </div>
        </AccountCard>
      )}
    </AccountShell>
  );
};
