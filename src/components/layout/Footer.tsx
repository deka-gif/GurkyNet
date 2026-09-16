import { Link } from 'react-router-dom';
import { Facebook, Instagram, Twitter, Youtube, Mail, Phone, MapPin } from 'lucide-react';
import { useWebsiteStore } from '../../store/website.store';
import { resolveMediaSrc } from '../../utils/mediaUrl';
import { isLegalSlug, legalPath } from '../legal/legalContent';

function pageHref(slug: string): string {
  return isLegalSlug(slug) ? legalPath(slug) : `/page/${slug}`;
}

export const Footer = () => {
  const { settings, pages } = useWebsiteStore();

  const bottomPages = pages.filter(p =>
    p.slug.includes('privacy') || p.slug.includes('terms') || p.slug.includes('refund') || p.slug.includes('syarat') || p.slug.includes('kebijakan')
  );

  const mainPages = pages.filter(p => !bottomPages.some(bp => bp.id === p.id));

  const brandBlock = (
    <div className="space-y-3 md:space-y-6">
      <Link to="/" className="flex items-center gap-2.5 group">
        {settings?.logo ? (
          <img
            src={resolveMediaSrc(settings.logo)}
            alt={settings.websiteName || 'GurkyNet'}
            className="w-9 h-9 md:w-10 md:h-10 object-contain rounded-xl ring-2 ring-white/20 group-hover:ring-accent-400/50 transition-all"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-9 h-9 md:w-10 md:h-10 bg-white/10 rounded-xl flex items-center justify-center text-white font-black text-lg ring-2 ring-white/20">
            {settings?.websiteName ? settings.websiteName.charAt(0).toUpperCase() : 'G'}
          </div>
        )}
        <span className="font-extrabold text-lg md:text-xl tracking-tight">
          {settings?.websiteName || 'GurkyNet'}
        </span>
      </Link>

      {settings?.tagline ? (
        <p className="text-primary-100/90 leading-relaxed text-xs md:text-sm max-w-xs">{settings.tagline}</p>
      ) : null}

      <div className="flex flex-row flex-wrap items-center gap-2">
        {settings?.facebook && (
          <a
            href={settings.facebook}
            target="_blank"
            rel="noopener noreferrer"
            className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white/10 flex items-center justify-center text-primary-100 hover:bg-accent-500/30 hover:text-white transition-all"
            title="Facebook"
          >
            <Facebook className="w-4 h-4 md:w-5 md:h-5" />
          </a>
        )}
        {settings?.instagram && (
          <a
            href={settings.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white/10 flex items-center justify-center text-primary-100 hover:bg-accent-500/30 hover:text-white transition-all"
            title="Instagram"
          >
            <Instagram className="w-4 h-4 md:w-5 md:h-5" />
          </a>
        )}
        {settings?.twitter && (
          <a
            href={settings.twitter}
            target="_blank"
            rel="noopener noreferrer"
            className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white/10 flex items-center justify-center text-primary-100 hover:bg-accent-500/30 hover:text-white transition-all"
            title="Twitter / X"
          >
            <Twitter className="w-4 h-4 md:w-5 md:h-5" />
          </a>
        )}
        {settings?.youtube && (
          <a
            href={settings.youtube}
            target="_blank"
            rel="noopener noreferrer"
            className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white/10 flex items-center justify-center text-primary-100 hover:bg-accent-500/30 hover:text-white transition-all"
            title="YouTube"
          >
            <Youtube className="w-4 h-4 md:w-5 md:h-5" />
          </a>
        )}
      </div>
    </div>
  );

  const layananBlock = (
    <div className="min-w-0">
      <h4 className="font-extrabold text-[10px] md:text-xs text-accent-400 uppercase tracking-widest mb-2.5 md:mb-6">Layanan PPOB</h4>
      <ul className="flex flex-col gap-2 md:gap-3.5 text-xs md:text-sm">
        <li><Link to="/dashboard/pulsa" className="text-primary-100/80 hover:text-white transition-colors leading-snug">Beli Pulsa & Paket Data</Link></li>
        <li><Link to="/dashboard/token-pln" className="text-primary-100/80 hover:text-white transition-colors leading-snug">Token Listrik PLN</Link></li>
        <li><Link to="/dashboard/voucher-digital" className="text-primary-100/80 hover:text-white transition-colors leading-snug">Voucher Digital</Link></li>
        <li><Link to="/dashboard/tagihan" className="text-primary-100/80 hover:text-white transition-colors leading-snug">Bayar Tagihan Bulanan</Link></li>
      </ul>
    </div>
  );

  const infoBlock = (
    <div className="min-w-0">
      <h4 className="font-extrabold text-[10px] md:text-xs text-accent-400 uppercase tracking-widest mb-2.5 md:mb-6">Informasi & Bantuan</h4>
      <ul className="flex flex-col gap-2 md:gap-3.5 text-xs md:text-sm">
        {mainPages.length > 0 ? (
          mainPages.map((page) => (
            <li key={page.id}>
              <Link to={pageHref(page.slug)} className="text-primary-100/80 hover:text-white transition-colors leading-snug">
                {page.title}
              </Link>
            </li>
          ))
        ) : (
          <>
            <li><Link to="/page/about-us" className="text-primary-100/80 hover:text-white transition-colors leading-snug">Tentang Kami</Link></li>
            <li><Link to="/page/faq" className="text-primary-100/80 hover:text-white transition-colors leading-snug">Pertanyaan Umum (FAQ)</Link></li>
            <li><Link to="/page/contact" className="text-primary-100/80 hover:text-white transition-colors leading-snug">Hubungi Kontak</Link></li>
          </>
        )}
      </ul>
    </div>
  );

  const csBlock = (
    <div className="min-w-0">
      <h4 className="font-extrabold text-[10px] md:text-xs text-accent-400 uppercase tracking-widest mb-2.5 md:mb-6">Hubungi CS</h4>
      <ul className="flex flex-col gap-2.5 md:gap-4 text-xs md:text-sm text-primary-100/80">
        {settings?.supportEmail && (
          <li className="flex items-start gap-2">
            <Mail className="w-3.5 h-3.5 md:w-4 md:h-4 text-accent-400 shrink-0 mt-0.5" />
            <a href={`mailto:${settings.supportEmail}`} className="hover:text-white transition-colors break-all">
              {settings.supportEmail}
            </a>
          </li>
        )}
        {settings?.supportPhone && (
          <li className="flex items-start gap-2">
            <Phone className="w-3.5 h-3.5 md:w-4 md:h-4 text-accent-400 shrink-0 mt-0.5" />
            <a href={`tel:${settings.supportPhone}`} className="hover:text-white transition-colors">
              {settings.supportPhone}
            </a>
          </li>
        )}
        {settings?.whatsapp && (
          <li className="flex items-start gap-2">
            <span className="text-accent-400 font-extrabold shrink-0 mt-0.5 text-[10px] md:text-xs">WA</span>
            <a
              href={`https://wa.me/${settings.whatsapp.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              {settings.whatsapp}
            </a>
          </li>
        )}
        {settings?.officeAddress && (
          <li className="flex items-start gap-2">
            <MapPin className="w-3.5 h-3.5 md:w-4 md:h-4 text-accent-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{settings.officeAddress}</span>
          </li>
        )}
        {settings?.operatingHours && (
          <li className="flex items-start gap-2">
            <span className="text-accent-400 font-extrabold shrink-0 mt-0.5 text-[10px] md:text-xs">Jam</span>
            <span className="leading-relaxed">{settings.operatingHours}</span>
          </li>
        )}
      </ul>
    </div>
  );

  const legalLinks = bottomPages.length > 0 ? (
    bottomPages.map((page) => (
      <Link key={page.id} to={pageHref(page.slug)} className="hover:text-accent-400 transition-colors">
        {page.title}
      </Link>
    ))
  ) : (
    <>
      <Link to="/legal/privacy-policy" className="hover:text-accent-400 transition-colors">Kebijakan Privasi</Link>
      <Link to="/legal/terms-conditions" className="hover:text-accent-400 transition-colors">Syarat dan Ketentuan</Link>
      <Link to="/legal/refund-policy" className="hover:text-accent-400 transition-colors">Kebijakan Pengembalian Dana (Refund)</Link>
    </>
  );

  return (
    <footer className="relative bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900 text-white overflow-hidden" id="website-footer">
      <div className="absolute inset-0 pointer-events-none">
        <div className="brand-glow-primary top-0 right-0 w-96 h-96 opacity-40" />
        <div className="brand-glow-accent bottom-0 left-0 w-80 h-80 opacity-30" />
      </div>
      <div className="h-1 bg-gradient-to-r from-transparent via-accent-500/70 to-transparent relative z-10" />

      <div className="container mx-auto px-4 md:px-8 max-w-7xl relative z-10 pt-10 md:pt-16 pb-8">
        {/*
          Mobile (<lg): Owner layout — LEFT brand/social/info · RIGHT layanan/CS.
          Desktop (lg+): unchanged 4 equal columns Brand | Layanan | Informasi | Hubungi CS.
        */}
        <div className="grid grid-cols-2 gap-5 mb-8 lg:hidden" data-footer-layout="mobile">
          <div className="min-w-0 space-y-5">
            {brandBlock}
            {infoBlock}
          </div>
          <div className="min-w-0 space-y-5">
            {layananBlock}
            {csBlock}
          </div>
        </div>

        <div className="hidden lg:grid lg:grid-cols-4 gap-12 mb-12" data-footer-layout="desktop">
          <div>{brandBlock}</div>
          {layananBlock}
          {infoBlock}
          {csBlock}
        </div>

        {/* Bottom bar: copyright LEFT · legal RIGHT (kiri-kanan on all breakpoints). */}
        <div className="border-t border-white/10 pt-5 md:pt-8 flex flex-row items-start justify-between gap-3 md:gap-6">
          <p className="text-primary-200/70 text-[10px] md:text-xs leading-snug text-left max-w-[46%] md:max-w-md">
            {settings?.copyright || `© ${new Date().getFullYear()} PT Gurky Solusi Digital. Hak Cipta Dilindungi Undang-Undang.`}
          </p>

          <nav
            aria-label="Tautan legal"
            className="flex flex-col items-end gap-1.5 md:flex-row md:flex-wrap md:items-center md:justify-end md:gap-x-5 md:gap-y-2 text-[10px] md:text-xs text-primary-200/70 text-right shrink-0 max-w-[52%] md:max-w-none"
          >
            {legalLinks}
          </nav>
        </div>
      </div>
    </footer>
  );
};
