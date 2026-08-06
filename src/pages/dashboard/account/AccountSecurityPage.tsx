import React, { useEffect, useState } from 'react';
import { profileService } from '../../../services/profile/profile.service';
import { useAuth } from '../../../hooks/useAuth';
import { AccountShell, AccountCard } from './AccountShell';
import { Link } from 'react-router-dom';

export const AccountSecurityPage: React.FC = () => {
  const { user, fetchUser } = useAuth();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await profileService.getSecurity();
      setData(res.data);
    } catch (e: any) {
      setErr(e?.message || 'Gagal memuat keamanan');
    }
  };

  useEffect(() => {
    fetchUser();
    load();
  }, [fetchUser]);

  return (
    <AccountShell title="Keamanan" subtitle="Status PIN, sesi perangkat, dan riwayat login.">
      {err && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{err}</div>}
      <AccountCard>
        <p className="text-[10px] font-bold uppercase text-slate-400">Status PIN</p>
        <p className="text-sm font-extrabold text-gray-900 mt-1">{user?.hasPin || data?.has_pin ? 'Aktif' : 'Belum dibuat'}</p>
        <p className="text-xs text-gray-500 mt-1">Terakhir diganti: {data?.pin_updated_at || user?.createdAt || '—'}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {!user?.hasPin ? (
            <Link to="/dashboard/account/pin/create" className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary-600 text-white">Buat PIN</Link>
          ) : (
            <>
              <Link to="/dashboard/account/pin/change" className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200">Ganti PIN</Link>
              <Link to="/dashboard/account/pin/forgot" className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200">Lupa PIN</Link>
            </>
          )}
        </div>
      </AccountCard>

      <AccountCard>
        <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">Last Login</p>
        {data?.last_login ? (
          <p className="text-sm text-gray-800">{data.last_login.logged_at} · {data.last_login.ip_address}</p>
        ) : (
          <p className="text-sm text-gray-500">Belum ada data.</p>
        )}
      </AccountCard>

      <AccountCard>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold uppercase text-slate-400">Device Session</p>
          <button
            type="button"
            className="text-xs font-bold text-rose-600"
            onClick={async () => {
              await profileService.revokeOtherSessions();
              await load();
            }}
          >
            Logout perangkat lain
          </button>
        </div>
        <div className="space-y-2">
          {(data?.active_tokens || []).map((t: any) => (
            <div key={t.id} className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
              <div>
                <p className="text-xs font-bold text-gray-800">{t.name || 'Session'}</p>
                <p className="text-[10px] text-gray-500">Last used: {t.last_used_at || t.created_at || '—'}</p>
              </div>
              <button type="button" className="text-[10px] font-bold text-rose-600" onClick={async () => { await profileService.revokeSession(t.id); await load(); }}>
                Revoke
              </button>
            </div>
          ))}
          {(!data?.active_tokens || data.active_tokens.length === 0) && <p className="text-sm text-gray-500">Tidak ada sesi aktif.</p>}
        </div>
      </AccountCard>

      <AccountCard>
        <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">Login History</p>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {(data?.registered_devices || []).slice(0, 20).map((d: any, i: number) => (
            <div key={i} className="text-xs text-gray-700 border-b border-slate-50 pb-2">
              <p className="font-bold truncate">{d.user_agent}</p>
              <p className="text-gray-500">{d.ip_address} · {d.last_login_at}</p>
            </div>
          ))}
        </div>
      </AccountCard>
    </AccountShell>
  );
};
