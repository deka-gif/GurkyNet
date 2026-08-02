import { motion } from 'motion/react';
import { 
  Smartphone, 
  Wifi, 
  Zap, 
  Gift, 
  CreditCard, 
  Briefcase, 
  Send, 
  FileText, 
  PlayCircle 
} from 'lucide-react';

const services = [
  { icon: Smartphone, title: 'Pulsa', desc: 'Isi ulang pulsa semua operator.' },
  { icon: Wifi, title: 'Paket Data', desc: 'Beli paket internet murah.' },
  { icon: Zap, title: 'Token PLN', desc: 'Beli token listrik prabayar.' },
  { icon: Gift, title: 'Voucher Digital', desc: 'Berbagai voucher digital.' },
  { icon: CreditCard, title: 'Voucher Fisik', desc: 'Aktivasi voucher fisik.' },
  { icon: Briefcase, title: 'Top Up E-Wallet', desc: 'Isi saldo dompet digital.' },
  { icon: Send, title: 'Transfer', desc: 'Kirim dana ke berbagai bank.' },
  { icon: FileText, title: 'Tagihan', desc: 'Bayar tagihan bulanan.' },
  { icon: PlayCircle, title: 'Game Voucher', desc: 'Top up game favorit.' },
];

export const Services = () => {
  return (
    <section className="py-20 md:py-32 bg-white">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold text-gray-900 mb-4"
          >
            Layanan <span className="text-primary-600">Lengkap</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-600"
          >
            Apapun kebutuhan transaksi digital Anda, semuanya tersedia dalam satu platform.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {services.map((service, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              whileHover={{ y: -4, scale: 1.02 }}
              className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-primary-200 hover:bg-white hover:shadow-xl hover:shadow-primary-500/5 transition-all duration-300 group cursor-pointer"
            >
              <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center text-gray-600 group-hover:text-primary-600 group-hover:bg-primary-50 transition-colors mb-4">
                <service.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors">{service.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{service.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
