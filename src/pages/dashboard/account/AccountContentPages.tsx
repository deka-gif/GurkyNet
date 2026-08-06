import React, { useEffect, useState } from 'react';
import { accountContentService } from '../../../services/account/accountContent.service';
import { AccountShell, AccountCard } from './AccountShell';

export const AccountHelpPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    accountContentService.help().then((res) => setData(res.data)).catch((e) => setErr(e?.message || 'Gagal memuat'));
  }, []);

  return (
    <AccountShell title="Help Center" subtitle="FAQ dan kanal dukungan dari CMS.">
      {err && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{err}</div>}
      <AccountCard>
        <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">Kontak</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <p><span className="font-bold">WhatsApp:</span> {data?.whatsapp || '—'}</p>
          <p><span className="font-bold">Telegram:</span> {data?.telegram || '—'}</p>
          <p><span className="font-bold">Email:</span> {data?.email || '—'}</p>
          <p><span className="font-bold">Jam Operasional:</span> {data?.operatingHours || '—'}</p>
        </div>
      </AccountCard>
      <div className="space-y-2">
        {(data?.faq || []).map((f: any) => (
          <AccountCard key={f.id}>
            <p className="text-sm font-extrabold text-gray-900">{f.question}</p>
            <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{f.answer}</p>
          </AccountCard>
        ))}
      </div>
    </AccountShell>
  );
};

export const AccountCmsPage: React.FC<{ kind: 'privacy' | 'terms' | 'about' }> = ({ kind }) => {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const title = kind === 'privacy' ? 'Privacy Policy' : kind === 'terms' ? 'Terms & Conditions' : 'About';

  useEffect(() => {
    const load = kind === 'privacy' ? accountContentService.privacy : kind === 'terms' ? accountContentService.terms : accountContentService.about;
    load().then((res) => setData(res.data)).catch((e) => setErr(e?.message || 'Gagal memuat'));
  }, [kind]);

  return (
    <AccountShell title={title}>
      {err && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{err}</div>}
      <AccountCard>
        {kind === 'about' ? (
          <div className="space-y-2 text-sm">
            <p><span className="font-bold">Aplikasi:</span> {data?.appName || data?.title}</p>
            <p><span className="font-bold">Versi:</span> {data?.version || '—'}</p>
            <p><span className="font-bold">Build:</span> {data?.buildNumber || '—'}</p>
            <p><span className="font-bold">Developer:</span> {data?.developer || '—'}</p>
            <p><span className="font-bold">Website:</span> {data?.website || '—'}</p>
            <p><span className="font-bold">Email:</span> {data?.email || '—'}</p>
            {data?.content && <div className="prose prose-sm max-w-none mt-4 whitespace-pre-wrap">{data.content}</div>}
          </div>
        ) : (
          <div>
            <h2 className="text-base font-extrabold text-gray-900 mb-3">{data?.title}</h2>
            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{data?.content}</div>
          </div>
        )}
      </AccountCard>
    </AccountShell>
  );
};
