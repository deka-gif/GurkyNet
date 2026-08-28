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

  return (
    <footer className="relative bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900 text-white overflow-hidden" id="website-footer">
      <div className="absolute inset-0 pointer-events-none">
        <div className="brand-glow-primary top-0 right-0 w-96 h-96 opacity-40" />
        <div className="brand-glow-accent bottom-0 left-0 w-80 h-80 opacity-30" />
      </div>
      <div className="h-1 bg-gradient-to-r from-transparent via-accent-500/70 to-transparent relative z-10" />

      <div className="container mx-auto px-4 md:px-8 max-w-7xl relative z-10 pt-16 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">

          <div className="col-span-1 md:col-span-2 lg:col-span-1 space-y-6">
            <Link to="/" className="flex items-center gap-2.5 group">
              {settings?.logo ? (
                <img
                  src={resolveMediaSrc(settings.logo)}
                  alt={settings.websiteName || 'GurkyNet'}
                  className="w-10 h-10 object-contain rounded-xl ring-2 ring-white/20 group-hover:ring-accent-400/50 transition-all"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white font-black text-lg ring-2 ring-white/20">
                  {settings?.websiteName ? settings.websiteName.charAt(0).toUpperCase() : 'G'}
                </div>
              )}
              <span className="font-extrabold text-xl tracking-tight">
                {settings?.websiteName || 'GurkyNet'}
              </span>
            </Link>

            {settings?.tagline ? (
              <p className="text-primary-100/90 leading-relaxed text-sm max-w-xs">{settings.tagline}</p>
            ) : null}

            <div className="flex items-center gap-2.5">
              {settings?.facebook && (
                <a
                  href={settings.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-primary-100 hover:bg-accent-500/30 hover:text-white transition-all"
                  title="Facebook"
                >
                  <Facebook className="w-5 h-5" />
                </a>
              )}
              {settings?.instagram && (
                <a
                  href={settings.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-primary-100 hover:bg-accent-500/30 hover:text-white transition-all"
                  title="Instagram"
                >
                  <Instagram className="w-5 h-5" />
                </a>
              )}
              {settings?.twitter && (
                <a
                  href={settings.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-primary-100 hover:bg-accent-500/30 hover:text-white transition-all"
                  title="Twitter / X"
                >
                  <Twitter className="w-5 h-5" />
                </a>
              )}
              {settings?.youtube && (
                <a
                  href={settings.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-primary-100 hover:bg-accent-500/30 hover:text-white transition-all"
                  title="YouTube"
                >
                  <Youtube className="w-5 h-5" />
                </a>
              )}
            </div>
          </div>

          <div>
            <h4 className="font-extrabold text-xs text-accent-400 uppercase tracking-widest mb-6">Layanan PPOB</h4>
            <ul className="flex flex-col gap-3.5 text-sm">
              <li><Link to="/dashboard/pulsa" className="text-primary-100/80 hover:text-white transition-colors">Beli Pulsa & Paket Data</Link></li>
              <li><Link to="/dashboard/token-pln" className="text-primary-100/80 hover:text-white transition-colors">Token Listrik PLN</Link></li>
              <li><Link to="/dashboard/voucher-digital" className="text-primary-100/80 hover:text-white transition-colors">Voucher Digital</Link></li>
              <li><Link to="/dashboard/tagihan" className="text-primary-100/80 hover:text-white transition-colors">Bayar Tagihan Bulanan</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-extrabold text-xs text-accent-400 uppercase tracking-widest mb-6">Informasi & Bantuan</h4>
            <ul className="flex flex-col gap-3.5 text-sm">
              {mainPages.length > 0 ? (
                mainPages.map((page) => (
                  <li key={page.id}>
                    <Link to={pageHref(page.slug)} className="text-primary-100/80 hover:text-white transition-colors">
                      {page.title}
                    </Link>
                  </li>
                ))
              ) : (
                <>
                  <li><Link to="/page/about-us" className="text-primary-100/80 hover:text-white transition-colors">Tentang Kami</Link></li>
                  <li><Link to="/page/faq" className="text-primary-100/80 hover:text-white transition-colors">Pertanyaan Umum (FAQ)</Link></li>
                  <li><Link to="/page/contact" className="text-primary-100/80 hover:text-white transition-colors">Hubungi Kontak</Link></li>
                </>
              )}
            </ul>
          </div>

          <div>
            <h4 className="font-extrabold text-xs text-accent-400 uppercase tracking-widest mb-6">Hubungi CS</h4>
            <ul className="flex flex-col gap-4 text-sm text-primary-100/80">
              {settings?.supportEmail && (
                <li className="flex items-start gap-2.5">
                  <Mail className="w-4 h-4 text-accent-400 shrink-0 mt-0.5" />
                  <a href={`mailto:${settings.supportEmail}`} className="hover:text-white transition-colors break-all">
                    {settings.supportEmail}
                  </a>
                </li>
              )}
              {settings?.supportPhone && (
                <li className="flex items-start gap-2.5">
                  <Phone className="w-4 h-4 text-accent-400 shrink-0 mt-0.5" />
                  <a href={`tel:${settings.supportPhone}`} className="hover:text-white transition-colors">
                    {settings.supportPhone}
                  </a>
                </li>
              )}
              {settings?.whatsapp && (
                <li className="flex items-start gap-2.5">
                  <span className="text-accent-400 font-extrabold shrink-0 mt-0.5 text-xs">WA</span>
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
                <li className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-accent-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{settings.officeAddress}</span>
                </li>
              )}
              {settings?.operatingHours && (
                <li className="flex items-start gap-2.5">
                  <span className="text-accent-400 font-extrabold shrink-0 mt-0.5 text-xs">Jam</span>
                  <span className="leading-relaxed">{settings.operatingHours}</span>
                </li>
              )}
            </ul>
          </div>

        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-primary-200/70 text-xs text-center md:text-left">
            {settings?.copyright || `© ${new Date().getFullYear()} PT GurkyNet Digital Nusantara. Hak Cipta Dilindungi.`}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-primary-200/70">
            {bottomPages.length > 0 ? (
              bottomPages.map((page) => (
                <Link key={page.id} to={pageHref(page.slug)} className="hover:text-accent-400 transition-colors">
                  {page.title}
                </Link>
              ))
            ) : (
              <>
                <Link to="/legal/privacy-policy" className="hover:text-accent-400 transition-colors">Kebijakan Privasi</Link>
                <Link to="/legal/terms-conditions" className="hover:text-accent-400 transition-colors">Ketentuan Layanan</Link>
                <Link to="/legal/refund-policy" className="hover:text-accent-400 transition-colors">Kebijakan Pengembalian</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};
