import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { useWebsiteStore } from '../../store/website.store';

// This data structure is designed to be easily swappable with API response
const initialFaqs = [
  {
    question: 'Apa itu GurkyNet?',
    answer: 'GurkyNet adalah platform PPOB (Payment Point Online Bank) modern yang melayani berbagai macam transaksi digital seperti pengisian pulsa, paket data, token listrik, voucher game, dan pembayaran tagihan bulanan.'
  },
  {
    question: 'Bagaimana cara daftar?',
    answer: 'Anda dapat mendaftar melalui aplikasi Android GurkyNet yang bisa diunduh melalui website ini, atau langsung mendaftar melalui halaman website (segera hadir). Pendaftaran 100% gratis.'
  },
  {
    question: 'Apakah transaksi aman?',
    answer: 'Sangat aman. Kami menggunakan sistem keamanan tingkat tinggi, enkripsi data, dan server yang handal untuk memastikan setiap transaksi dan data pengguna terlindungi dengan maksimal.'
  },
  {
    question: 'Bagaimana cara download APK?',
    answer: 'Anda dapat mengunduh file APK resmi GurkyNet melalui tombol Download yang tersedia di halaman website ini. Setelah selesai, buka file APK untuk menginstalnya di perangkat Android Anda.'
  },
  {
    question: 'Apakah tersedia di Play Store?',
    answer: 'Saat ini aplikasi GurkyNet masih dalam tahap Beta dan belum tersedia di Google Play Store. Untuk sementara, aplikasi hanya dapat diunduh secara resmi melalui website ini.'
  },
  {
    question: 'Bagaimana jika transaksi gagal?',
    answer: 'Jika transaksi gagal, saldo Anda akan otomatis dikembalikan (refund) ke akun dompet Anda dalam waktu singkat. Anda juga dapat menghubungi Customer Service kami jika mengalami kendala.'
  },
  {
    question: 'Apakah mendukung Bluetooth Printer?',
    answer: 'Ya, aplikasi Android GurkyNet telah mendukung fitur pencetakan struk transaksi langsung melalui berbagai jenis mobile printer Bluetooth.'
  },
  {
    question: 'Bagaimana menghubungi Customer Service?',
    answer: 'Anda dapat menghubungi Customer Service kami melalui WhatsApp, Email, atau media sosial yang tercantum pada halaman Kontak di website ini.'
  }
];

export const Faq = (_props: { section?: import('../../types').HomepageSection } = {}) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const { faqs } = useWebsiteStore();
  const resolvedFaqs = faqs.length > 0 ? faqs : initialFaqs;

  return (
    <section id="faq" className="py-20 md:py-32 bg-gray-50">
      <div className="container mx-auto px-4 md:px-8 max-w-3xl">
        <div className="text-center mb-16">
          <div className="section-badge mb-4">FAQ</div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="section-title mb-4"
          >
            Pertanyaan yang Sering <span className="text-primary-600">Diajukan</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="section-subtitle"
          >
            Temukan jawaban atas pertanyaan umum seputar layanan GurkyNet.
          </motion.p>
        </div>

        <div className="space-y-4">
          {resolvedFaqs.map((faq, index) => {
            const isOpen = openIndex === index;
            
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className={`public-card overflow-hidden ${isOpen ? 'ring-1 ring-primary-200 shadow-md shadow-primary-900/5' : ''}`}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full text-left px-6 py-5 flex items-center justify-between focus:outline-none"
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${index}`}
                >
                  <h3 className={`text-lg font-semibold transition-colors ${isOpen ? 'text-primary-600' : 'text-gray-900'}`}>
                    {faq.question}
                  </h3>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-300 ${isOpen ? 'bg-primary-50 text-primary-600 rotate-180' : 'bg-gray-50 text-gray-500'}`}>
                    <ChevronDown className="w-5 h-5" />
                  </div>
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      id={`faq-answer-${index}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="px-6 pb-6 text-gray-600 leading-relaxed border-t border-gray-50 pt-4">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
