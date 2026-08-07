import { motion } from 'motion/react';
import { UserPlus, LogIn, Grid, CheckCircle } from 'lucide-react';

const steps = [
  {
    icon: UserPlus,
    title: 'Daftar Akun',
    description: 'Registrasi mudah dan cepat.',
  },
  {
    icon: LogIn,
    title: 'Login',
    description: 'Masuk ke dashboard Anda.',
  },
  {
    icon: Grid,
    title: 'Pilih Layanan',
    description: 'Temukan produk yang Anda butuhkan.',
  },
  {
    icon: CheckCircle,
    title: 'Selesaikan Transaksi',
    description: 'Bayar dengan aman dan instan.',
  },
];

export const HowItWorks = (_props: { section?: import('../../types').HomepageSection } = {}) => {
  return (
    <section className="py-20 md:py-32 bg-primary-900 text-white relative overflow-hidden">
      {/* Background Decors */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-600/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent-500/20 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 md:px-8 max-w-7xl relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold mb-4"
          >
            Cara <span className="text-primary-400">Kerja</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-primary-100"
          >
            Mulai bertransaksi dengan 4 langkah mudah.
          </motion.p>
        </div>

        <div className="relative">
          {/* Connecting Line */}
          <div className="hidden lg:block absolute top-1/2 left-0 w-full h-0.5 bg-primary-700 -translate-y-1/2 z-0"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-4 relative z-10">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                className="flex flex-col items-center text-center group"
              >
                <div className="w-20 h-20 bg-primary-800 rounded-full border-4 border-primary-900 flex items-center justify-center text-primary-400 mb-6 group-hover:bg-primary-600 group-hover:text-white group-hover:scale-110 transition-all duration-300 shadow-xl shadow-primary-900/50 relative">
                  <step.icon className="w-8 h-8" />
                  <div className="absolute -top-3 -right-3 w-8 h-8 bg-accent-500 rounded-full flex items-center justify-center text-white font-bold text-sm border-2 border-primary-900 shadow-sm">
                    {index + 1}
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                <p className="text-primary-200">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
