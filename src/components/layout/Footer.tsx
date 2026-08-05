import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, Twitter, Youtube, Mail, Phone, MapPin, Shield, HelpCircle } from 'lucide-react';
import { useWebsiteStore } from '../../store/website.store';
import { resolveMediaSrc } from '../../utils/mediaUrl';

export const Footer = () => {
  const { settings, fetchSettings, pages, fetchPages } = useWebsiteStore();

  useEffect(() => {
    fetchSettings();
    fetchPages();
  }, []);

  // Filter some common static pages to display at the very bottom, others in the "Perusahaan / Informasi" column
  const bottomPages = pages.filter(p =>
    p.slug.includes('privacy') || p.slug.includes('terms') || p.slug.includes('refund') || p.slug.includes('syarat') || p.slug.includes('kebijakan')
  );

  const mainPages = pages.filter(p => !bottomPages.some(bp => bp.id === p.id));

  return (
    <footer className="bg-white border-t border-gray-100 pt-16 pb-8" id="website-footer">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">

          {/* Brand Info */}
          <div className="col-span-1 md:col-span-2 lg:col-span-1 space-y-6">
            <Link to="/" className="flex items-center gap-2">
              {settings?.logo ? (
                <img
                  src={resolveMediaSrc(settings.logo)}
                  alt={settings.websiteName || 'GurkyNet'}
                  className="w-8 h-8 object-contain rounded-lg"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-black text-lg shadow-md shadow-primary-500/30">
                  {settings?.websiteName ? settings.websiteName.charAt(0).toUpperCase() : 'G'}
                </div>
              )}
              <span className="font-extrabold text-xl tracking-tight text-gray-900">
                {settings?.websiteName || 'GurkyNet'}
              </span>
            </Link>

            <p className="text-gray-600 leading-relaxed text-sm">
              {settings?.tagline || 'Platform PPOB modern untuk semua kebutuhan transaksi digital Anda. Cepat, aman, dan terpercaya.'}
            </p>

            {/* Social Media Links */}
            <div className="flex items-center gap-3">
              {settings?.facebook && (
                <a
                  href={settings.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-primary-50 hover:text-primary-600 transition-colors"
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
                  className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-primary-50 hover:text-primary-600 transition-colors"
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
                  className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-primary-50 hover:text-primary-600 transition-colors"
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
                  className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-primary-50 hover:text-primary-600 transition-colors"
                  title="YouTube"
                >
                  <Youtube className="w-5 h-5" />
                </a>
              )}
            </div>
          </div>

          {/* Product Shortcuts */}
          <div>
            <h4 className="font-extrabold text-sm text-gray-900 uppercase tracking-wider mb-6">Layanan PPOB</h4>
            <ul className="flex flex-col gap-3.5 text-sm">
              <li><Link to="/dashboard/pulsa" className="text-gray-600 hover:text-primary-600 transition-colors">Beli Pulsa & Paket Data</Link></li>
              <li><Link to="/dashboard/token-pln" className="text-gray-600 hover:text-primary-600 transition-colors">Token Listrik PLN</Link></li>
              <li><Link to="/dashboard/voucher" className="text-gray-600 hover:text-primary-600 transition-colors">Voucher Digital</Link></li>
              <li><Link to="/dashboard/tagihan" className="text-gray-600 hover:text-primary-600 transition-colors">Bayar Tagihan Bulanan</Link></li>
            </ul>
          </div>

          {/* Dynamic Static Pages list */}
          <div>
            <h4 className="font-extrabold text-sm text-gray-900 uppercase tracking-wider mb-6">Informasi & Bantuan</h4>
            <ul className="flex flex-col gap-3.5 text-sm">
              {mainPages.length > 0 ? (
                mainPages.map((page) => (
                  <li key={page.id}>
                    <Link to={`/page/${page.slug}`} className="text-gray-600 hover:text-primary-600 transition-colors">
                      {page.title}
                    </Link>
                  </li>
                ))
              ) : (
                <>
                  <li><Link to="/page/about-us" className="text-gray-600 hover:text-primary-600 transition-colors">Tentang Kami</Link></li>
                  <li><Link to="/page/faq" className="text-gray-600 hover:text-primary-600 transition-colors">Pertanyaan Umum (FAQ)</Link></li>
                  <li><Link to="/page/contact" className="text-gray-600 hover:text-primary-600 transition-colors">Hubungi Kontak</Link></li>
                </>
              )}
            </ul>
          </div>

          {/* Support Contacts */}
          <div>
            <h4 className="font-extrabold text-sm text-gray-900 uppercase tracking-wider mb-6">Hubungi CS</h4>
            <ul className="flex flex-col gap-4 text-sm text-gray-600">
              {settings?.supportEmail && (
                <li className="flex items-start gap-2.5">
                  <Mail className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
                  <a href={`mailto:${settings.supportEmail}`} className="hover:text-primary-600 transition-colors break-all">
                    {settings.supportEmail}
                  </a>
                </li>
              )}
              {settings?.supportPhone && (
                <li className="flex items-start gap-2.5">
                  <Phone className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
                  <a href={`tel:${settings.supportPhone}`} className="hover:text-primary-600 transition-colors">
                    {settings.supportPhone}
                  </a>
                </li>
              )}
              {settings?.whatsapp && (
                <li className="flex items-start gap-2.5">
                  <span className="text-green-500 font-extrabold shrink-0 mt-0.5 text-xs">WA</span>
                  <a
                    href={`https://wa.me/${settings.whatsapp.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary-600 transition-colors"
                  >
                    {settings.whatsapp}
                  </a>
                </li>
              )}
              {settings?.officeAddress && (
                <li className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    {settings.officeAddress}
                  </span>
                </li>
              )}
            </ul>
          </div>

        </div>

        {/* Footer Bottom */}
        <div className="border-t border-gray-100 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-xs text-center md:text-left">
            {settings?.copyright || `© ${new Date().getFullYear()} PT GurkyNet Digital Nusantara. Hak Cipta Dilindungi.`}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-gray-500">
            {bottomPages.length > 0 ? (
              bottomPages.map((page) => (
                <Link key={page.id} to={`/page/${page.slug}`} className="hover:text-primary-600 transition-colors">
                  {page.title}
                </Link>
              ))
            ) : (
              <>
                <Link to="/page/privacy-policy" className="hover:text-primary-600 transition-colors">Kebijakan Privasi</Link>
                <Link to="/page/terms-conditions" className="hover:text-primary-600 transition-colors">Ketentuan Layanan</Link>
                <Link to="/page/refund-policy" className="hover:text-primary-600 transition-colors">Kebijakan Pengembalian</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};
