import React, { useEffect, useMemo, useState } from 'react';
import { accountContentService } from '../../../services/account/accountContent.service';
import { websiteService } from '../../../services/website.service';
import { LegalProse, prepareLegalHtml } from '../../../components/legal/legalContent';
import { BookOpen, Clock } from 'lucide-react';
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
  const isLegalDoc = kind === 'privacy' || kind === 'terms';

  useEffect(() => {
    setData(null);
    setErr(null);
    if (isLegalDoc) {
      const slug = kind === 'privacy' ? 'privacy-policy' : 'terms-conditions';
      websiteService
        .getPublicLegalDocument(slug)
        .then((res: any) => setData(res?.data || res))
        .catch((e: any) => setErr(e?.message || 'Gagal memuat dokumen'));
    } else {
      accountContentService
        .about()
        .then((res) => setData(res.data))
        .catch((e) => setErr(e?.message || 'Gagal memuat'));
    }
  }, [kind, isLegalDoc]);

  const prepared = useMemo(() => prepareLegalHtml(isLegalDoc ? data?.content || '' : ''), [isLegalDoc, data?.content]);
  const formatDate = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  return (
    <AccountShell title={title}>
      {err && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{err}</div>}

      {isLegalDoc ? (
        <article className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-10">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-gray-400 mb-4">
            <span className="inline-flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Dokumen Legal</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Diperbarui {formatDate(data?.lastUpdated)}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight mb-6">{data?.title || title}</h1>
          {data ? <LegalProse html={prepared.html} /> : !err && <p className="text-sm text-gray-400">Memuat...</p>}
        </article>
      ) : (
        <article className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-10">
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight mb-6">{data?.appName || data?.title || 'GurkyNet'}</h1>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm mb-6">
            <div><p className="text-[10px] font-bold uppercase text-slate-400">Versi</p><p className="font-bold text-gray-800 mt-1">{data?.version || '—'}</p></div>
            <div><p className="text-[10px] font-bold uppercase text-slate-400">Build</p><p className="font-bold text-gray-800 mt-1">{data?.buildNumber || '—'}</p></div>
            <div><p className="text-[10px] font-bold uppercase text-slate-400">Website</p><p className="font-bold text-gray-800 mt-1">{data?.website || '—'}</p></div>
            <div><p className="text-[10px] font-bold uppercase text-slate-400">Email</p><p className="font-bold text-gray-800 mt-1">{data?.email || '—'}</p></div>
            <div><p className="text-[10px] font-bold uppercase text-slate-400">Developer</p><p className="font-bold text-gray-800 mt-1">{data?.developer || '—'}</p></div>
          </div>
          {data?.content && (
            <div className="pt-6 border-t border-gray-100">
              <LegalProse html={data.content} />
            </div>
          )}
        </article>
      )}
    </AccountShell>
  );
};
