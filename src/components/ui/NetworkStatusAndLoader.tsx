import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wifi, WifiOff } from 'lucide-react';
import { useNetwork } from '../../hooks/useNetwork';
import { useLoadingStore } from '../../store/loading.store';

export const NetworkStatusAndLoader = () => {
  const { isOnline } = useNetwork();
  const { globalLoading } = useLoadingStore();
  const [showRestored, setShowRestored] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  // Track transition from offline to online
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (isOnline && wasOffline) {
      setShowRestored(true);
      const timer = setTimeout(() => {
        setShowRestored(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  return (
    <>
      {/* 1. Global Slim Progress Bar Loader */}
      <AnimatePresence>
        {globalLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed top-0 left-0 right-0 h-[3px] bg-primary-100 z-[9999] overflow-hidden pointer-events-none"
            id="global-loader-progress"
          >
            <motion.div
              className="h-full bg-primary-600 rounded-r-full"
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{
                repeat: Infinity,
                duration: 1.5,
                ease: 'easeInOut',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Network Offline Alert Banner */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 120 }}
            className="fixed top-0 left-0 right-0 bg-red-600 text-white py-2 px-4 flex items-center justify-center gap-2.5 shadow-md z-[9998] font-bold text-xs md:text-sm tracking-wide text-center"
            id="network-offline-banner"
          >
            <WifiOff className="w-4 h-4 animate-bounce" />
            <span>Koneksi internet terputus. Menjalankan Aplikasi dalam Mode Offline.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Network Restored Notification */}
      <AnimatePresence>
        {showRestored && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 120 }}
            className="fixed top-0 left-0 right-0 bg-emerald-600 text-white py-2 px-4 flex items-center justify-center gap-2.5 shadow-md z-[9998] font-bold text-xs md:text-sm tracking-wide text-center"
            id="network-restored-banner"
          >
            <Wifi className="w-4 h-4" />
            <span>Koneksi terhubung kembali. Sinkronisasi data...</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
