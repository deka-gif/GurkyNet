import { motion } from 'motion/react';
import { MessageCircle, Mail, Instagram, MapPin, Clock } from 'lucide-react';
import { Button } from '../ui/Button';
import { useWebsiteStore } from '../../store/website.store';

export const Contact = (_props: { section?: import('../../types').HomepageSection } = {}) => {
  const { settings, sections } = useWebsiteStore();
  const contactSection = sections.find((s) => s.componentType === 'announcement');

  const whatsappNumber = settings?.whatsapp || '+62 812 3456 7890';
  const whatsappUrl = `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}`;
  const supportEmail = settings?.supportEmail || 'support@gurkynet.com';
  const instagramHandle = settings?.instagram ? settings.instagram.replace('https://instagram.com/', '@') : '@gurkynet';
  const tiktokHandle = settings?.tiktok ? settings.tiktok.replace('https://tiktok.com/@', '@') : '@gurkynet';
  const officeAddress = settings?.officeAddress || 'Jl. Gatot Subroto No. 88, Jakarta Selatan';
  const mapsUrl = settings?.googleMapsUrl || 'https://maps.google.com/?q=Jakarta';

  return (
    <section id="contact" className="py-20 md:py-32 bg-white">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold text-gray-900 mb-4"
          >
            {contactSection?.title ? (
              contactSection.title
            ) : (
              <>Hubungi <span className="text-primary-600">Kami</span></>
            )}
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-600"
          >
            {contactSection?.description || 'Tim support kami siap membantu Anda menyelesaikan berbagai kendala transaksi.'}
          </motion.p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-stretch">
          
          {/* Contact Cards Grid */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-6"
          >
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-primary-200 hover:bg-white hover:shadow-lg hover:shadow-primary-500/5 transition-all duration-300">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600 mb-4">
                <MessageCircle className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-gray-900 mb-1">WhatsApp</h4>
              <p className="text-gray-600 mb-4">{whatsappNumber}</p>
              <a 
                href={whatsappUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-primary-600 font-semibold text-sm hover:underline"
              >
                Chat Sekarang →
              </a>
            </div>

            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-primary-200 hover:bg-white hover:shadow-lg hover:shadow-primary-500/5 transition-all duration-300">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-4">
                <Mail className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-gray-900 mb-1">Email</h4>
              <p className="text-gray-600 mb-4">{supportEmail}</p>
              <a 
                href={`mailto:${supportEmail}`} 
                className="text-primary-600 font-semibold text-sm hover:underline"
              >
                Kirim Pesan →
              </a>
            </div>
            
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-primary-200 hover:bg-white hover:shadow-lg hover:shadow-primary-500/5 transition-all duration-300">
              <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center text-pink-600 mb-4">
                <Instagram className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-gray-900 mb-1">Sosial Media</h4>
              <p className="text-gray-600 mb-1">{instagramHandle}</p>
              <p className="text-gray-600 mb-4">{tiktokHandle}</p>
              <a 
                href={settings?.instagram || '#'} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-primary-600 font-semibold text-sm hover:underline"
              >
                Follow Kami →
              </a>
            </div>

            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-primary-200 hover:bg-white hover:shadow-lg hover:shadow-primary-500/5 transition-all duration-300">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 mb-4">
                <Clock className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-gray-900 mb-1">Layanan Bantuan</h4>
              <p className="text-gray-600">Online 24 Jam Nonstop setiap hari</p>
            </div>
          </motion.div>

          {/* Premium Contact Card */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-primary-900 rounded-3xl p-8 md:p-12 text-white relative overflow-hidden flex flex-col justify-center"
          >
            {/* Decors */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-600/30 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent-500/20 rounded-full blur-3xl"></div>
            
            <div className="relative z-10">
              <h3 className="text-2xl md:text-3xl font-bold mb-4">Kantor Pusat</h3>
              <p className="text-primary-100 mb-8 leading-relaxed">
                Kunjungi kantor pusat kami untuk keperluan bisnis, kerjasama, atau bantuan yang memerlukan tatap muka secara langsung.
              </p>
              
              <div className="flex items-start gap-4 mb-8">
                <div className="w-10 h-10 rounded-full bg-primary-800 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-primary-300" />
                </div>
                <div>
                  <h5 className="font-bold text-white mb-1">Alamat</h5>
                  <p className="text-primary-200">{officeAddress}</p>
                </div>
              </div>
              
              <a 
                href={mapsUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-block"
              >
                <Button variant="secondary" className="w-full sm:w-auto">
                  Lihat di Google Maps
                </Button>
              </a>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};
