import { motion } from 'motion/react';
import { Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { useWebsiteStore } from '../../store/website.store';
import type { HomepageSection } from '../../types';

type Props = { section?: HomepageSection };

export const CallToAction = ({ section }: Props = {}) => {
  const { settings } = useWebsiteStore();
  const websiteName = settings?.websiteName || 'GurkyNet';
  const title = section?.title || `Mulai Gunakan ${websiteName} Sekarang`;
  const description =
    section?.description ||
    'Nikmati pengalaman transaksi PPOB yang cepat, aman, dan modern dalam satu aplikasi.';
  const buttonLabel = section?.buttonLabel || 'Download APK';
  const buttonUrl = section?.buttonUrl || '#download-app';
  const isExternal = buttonUrl.startsWith('http');
  const isHash = buttonUrl.startsWith('#');

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 md:px-8 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 rounded-[2rem] md:rounded-[2.5rem] p-10 md:p-16 text-center text-white shadow-2xl shadow-primary-900/30 relative overflow-hidden ring-1 ring-white/10"
        >
          <div className="absolute inset-0 z-0 opacity-[0.07]">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
          <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[150%] bg-accent-500/15 rounded-full blur-3xl rotate-45 pointer-events-none"></div>

          <div className="relative z-10 max-w-3xl mx-auto">
            {section?.subtitle && (
              <p className="text-accent-400 text-sm font-bold uppercase tracking-widest mb-3">{section.subtitle}</p>
            )}
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold mb-6 leading-tight">{title}</h2>
            <p className="text-lg md:text-xl text-primary-100 mb-10 max-w-2xl mx-auto">{description}</p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {isExternal ? (
                <a href={buttonUrl} target="_blank" rel="noreferrer" className="w-full sm:w-auto">
                  <Button variant="secondary" className="w-full px-8 py-4 font-bold text-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <Download className="w-6 h-6" />
                    {buttonLabel}
                  </Button>
                </a>
              ) : isHash ? (
                <a
                  href={buttonUrl}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(buttonUrl.replace('#', ''))?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full sm:w-auto"
                >
                  <Button variant="secondary" className="w-full px-8 py-4 font-bold text-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <Download className="w-6 h-6" />
                    {buttonLabel}
                  </Button>
                </a>
              ) : (
                <Link to={buttonUrl} className="w-full sm:w-auto">
                  <Button variant="secondary" className="w-full px-8 py-4 font-bold text-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <Download className="w-6 h-6" />
                    {buttonLabel}
                  </Button>
                </Link>
              )}
            </div>

            <div className="mt-8 inline-flex items-center gap-2 text-primary-200/90 text-sm font-medium bg-white/10 px-4 py-2 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-400" />
              Gratis • Aman • Terpercaya
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
