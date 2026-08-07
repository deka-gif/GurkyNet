import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Check,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { useBannerStore } from '../../store/banner.store';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { toastSuccess } from '../../hooks/useToast';

function formatDateId(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function statusLabel(status?: string) {
  switch (status) {
    case 'upcoming':
      return { text: 'Akan Datang', className: 'bg-sky-50 text-sky-700 border-sky-200' };
    case 'expired':
      return { text: 'Berakhir', className: 'bg-slate-100 text-slate-600 border-slate-200' };
    case 'inactive':
      return { text: 'Nonaktif', className: 'bg-slate-100 text-slate-500 border-slate-200' };
    default:
      return { text: 'Aktif', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
}

export function PromoDetailPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { currentPromo, promoLoading, promoError, fetchPromoBySlug, clearCurrentPromo } =
    useBannerStore();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetchPromoBySlug(slug);
    return () => clearCurrentPromo();
  }, [slug, fetchPromoBySlug, clearCurrentPromo]);

  const status = statusLabel(currentPromo?.scheduleStatus || currentPromo?.status);
  const promoCode = currentPromo?.promoCode || currentPromo?.code || '';
  const ctaUrl = currentPromo?.ctaUrl || currentPromo?.redirectUrl || '';
  const ctaLabel = currentPromo?.ctaLabel || 'Gunakan Promo';
  const isExpired = (currentPromo?.scheduleStatus || currentPromo?.status) === 'expired';
  const showCta = Boolean(ctaUrl?.trim());

  const heroSrc = useMemo(() => {
    if (!currentPromo) return '';
    return resolveMediaUrl(currentPromo.image || currentPromo.imageUrl || '');
  }, [currentPromo]);

  const handleCopy = async () => {
    if (!promoCode) return;
    try {
      await navigator.clipboard.writeText(promoCode);
      setCopied(true);
      toastSuccess('Kode promo berhasil disalin.', promoCode);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleUsePromo = () => {
    if (!ctaUrl || isExpired) return;
    if (ctaUrl.startsWith('http://') || ctaUrl.startsWith('https://')) {
      window.open(ctaUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(ctaUrl.startsWith('/') ? ctaUrl : `/${ctaUrl}`);
  };

  if (promoLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 pb-24 md:pb-8">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-100" />
        <div className="aspect-[16/9] animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-8 w-2/3 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (promoError || !currentPromo) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 pb-24 md:pb-8">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-primary-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Dashboard
        </Link>
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-8 text-center">
          <p className="text-sm font-bold text-rose-700">{promoError || 'Promo tidak ditemukan.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-24 md:pb-10">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-primary-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali
      </Link>

      {/* Hero Banner — full image */}
      <div className="overflow-hidden rounded-2xl bg-slate-100 aspect-[16/9]">
        {heroSrc ? (
          <img
            src={heroSrc}
            alt={currentPromo.title}
            className="h-full w-full object-cover"
            loading="eager"
            decoding="async"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            Tidak ada gambar
          </div>
        )}
      </div>

      <div className="space-y-2">
        <span
          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${status.className}`}
        >
          {status.text}
        </span>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
          {currentPromo.title}
        </h1>
        {currentPromo.description ? (
          <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-line">
            {currentPromo.description}
          </p>
        ) : null}
      </div>

      {promoCode ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Kode Promo
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <code className="text-lg font-black tracking-wider text-primary-700">{promoCode}</code>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-primary-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-primary-700"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Tersalin' : 'Salin Kode'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <Calendar className="h-3.5 w-3.5" />
          Masa Berlaku
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-800">
          {formatDateId(currentPromo.startsAt || currentPromo.startDate)} —{' '}
          {formatDateId(currentPromo.endsAt || currentPromo.endDate || currentPromo.validUntil)}
        </p>
      </div>

      {currentPromo.terms ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Syarat & Ketentuan</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
            {currentPromo.terms}
          </p>
        </div>
      ) : null}

      {showCta ? (
        <button
          type="button"
          disabled={isExpired}
          onClick={handleUsePromo}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary-600 px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-primary-600/20 transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        >
          {ctaLabel}
          <ExternalLink className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

export default PromoDetailPage;
