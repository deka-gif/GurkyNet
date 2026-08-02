import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Home, AlertCircle } from 'lucide-react';

export const NotFoundPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="max-w-md w-full bg-white p-8 md:p-10 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100"
      >
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8" />
        </div>
        
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2">404</h1>
        <h2 className="text-xl font-bold text-gray-800 mb-4">Halaman Tidak Ditemukan</h2>
        
        <p className="text-gray-500 text-sm leading-relaxed mb-8">
          Maaf, halaman yang Anda cari tidak tersedia atau telah dipindahkan. Pastikan alamat URL yang dimasukkan sudah benar.
        </p>

        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 w-full bg-primary-600 hover:bg-primary-700 text-white py-3.5 rounded-full font-bold shadow-lg shadow-primary-500/25 transition-all duration-300"
        >
          <Home className="w-5 h-5" />
          Kembali ke Beranda
        </Link>
      </motion.div>
    </div>
  );
};
