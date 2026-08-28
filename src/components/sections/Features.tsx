import { motion } from 'motion/react';
import { Shield, Zap, Smile, Tag, Clock, Printer } from 'lucide-react';

import { useWebsiteStore } from '../../store/website.store';

const features = [
  {
    icon: Shield,
    title: 'Aman',
    description: 'Transaksi dilindungi dengan sistem keamanan modern.',
  },
  {
    icon: Zap,
    title: 'Cepat',
    description: 'Proses transaksi berlangsung secara real-time.',
  },
  {
    icon: Smile,
    title: 'Mudah Digunakan',
    description: 'Antarmuka sederhana dan ramah pengguna.',
  },
  {
    icon: Tag,
    title: 'Harga Kompetitif',
    description: 'Harga bersaing dengan berbagai promo menarik.',
  },
  {
    icon: Clock,
    title: 'Riwayat Transaksi',
    description: 'Seluruh transaksi tersimpan dengan rapi.',
  },
  {
    icon: Printer,
    title: 'Bluetooth Printer',
    description: 'Mendukung pencetakan struk melalui printer Bluetooth.',
  },
];

export const Features = (props: { section?: import('../../types').HomepageSection } = {}) => {
  const { settings, sections } = useWebsiteStore();
  const featuresSection = props.section || sections.find((s) => s.componentType === 'promo' || s.componentType === 'features');
  const cmsItems = Array.isArray(featuresSection?.contentItems) ? featuresSection!.contentItems! : [];
  const displayFeatures = cmsItems.length > 0
    ? cmsItems.map((item) => ({
        icon: Shield,
        title: item.title || '',
        description: item.description || '',
      }))
    : features;

  return (
    <section id="features" className="py-20 md:py-32 public-section-alt">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="section-badge mb-4">
            Keunggulan Platform
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="section-title mb-4"
          >
            {featuresSection?.title ? (
              featuresSection.title
            ) : (
              <>Kenapa Memilih <span className="text-primary-600">{settings?.websiteName || 'GurkyNet'}</span>?</>
            )}
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="section-subtitle"
          >
            {featuresSection?.description || 'Kami hadir dengan berbagai keunggulan untuk memastikan pengalaman transaksi terbaik untuk Anda.'}
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayFeatures.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -5 }}
              className="public-card p-8 hover:-translate-y-1"
            >
              <div className="w-14 h-14 bg-gradient-to-br from-primary-50 to-primary-100 rounded-2xl flex items-center justify-center text-primary-700 mb-6 ring-1 ring-primary-100">
                <feature.icon className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
