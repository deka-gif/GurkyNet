import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Info,
  Zap,
  Send,
  Clock,
  RefreshCw,
  Gift,
  Smartphone,
} from 'lucide-react';
import { useNotificationStore } from '../../store/notification.store';
import { Notification } from '../../types';

export const NotifikasiPage = () => {
  const navigate = useNavigate();
  const { notifications, loading, fetchNotifications, markAsRead, markAllAsRead, unreadCount } = useNotificationStore();

  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'read'>('all');

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const openNotification = async (notif: Notification) => {
    if (!notif.isRead) {
      await markAsRead(notif.id);
    }
    const target = notif.transactionId || notif.invoiceNumber;
    if (target) {
      navigate(`/dashboard/riwayat/${encodeURIComponent(String(target))}`);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  const filteredNotifications = notifications.filter((notif) => {
    if (activeFilter === 'unread') return !notif.isRead;
    if (activeFilter === 'read') return notif.isRead;
    return true;
  });

  const renderNotifIcon = (title: string) => {
    const text = String(title || '').toLowerCase();
    if (text.includes('promo') || text.includes('diskon')) return <Gift className="w-5 h-5 text-amber-500" />;
    if (text.includes('transaksi') || text.includes('pembelian') || text.includes('top up')) {
      return <Smartphone className="w-5 h-5 text-indigo-500" />;
    }
    if (text.includes('saldo') || text.includes('transfer')) return <Send className="w-5 h-5 text-emerald-500" />;
    if (text.includes('listrik') || text.includes('token')) return <Zap className="w-5 h-5 text-yellow-500" />;
    return <Info className="w-5 h-5 text-blue-500" />;
  };

  return (
    <div className="p-4 md:p-8 space-y-6 container mx-auto max-w-3xl" id="notifikasi-page-root">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Pusat Notifikasi</h2>
          <p className="text-sm text-gray-500">Pantau info promo saldo cashback, status PPOB, dan laporan keamanan akun.</p>
        </div>

        <div className="flex gap-2 shrink-0">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-2 text-xs font-bold text-primary-600 bg-primary-50 border border-primary-100 hover:bg-primary-100 px-4 py-2.5 rounded-xl transition-all"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Tandai Semua Dibaca</span>
            </button>
          )}

          <button
            onClick={() => void fetchNotifications({ force: true })}
            className="p-2.5 rounded-xl bg-white border border-gray-100 hover:bg-gray-50 text-gray-500 transition-all shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex border-b border-gray-100 gap-6">
        <button
          onClick={() => setActiveFilter('all')}
          className={`pb-4 font-black text-sm border-b-2 transition-all flex items-center gap-2 ${activeFilter === 'all' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
        >
          <span>Semua Notifikasi</span>
          <span className="bg-gray-100 text-gray-700 text-[10px] px-2 py-0.5 rounded-full font-black">
            {notifications.length}
          </span>
        </button>

        <button
          onClick={() => setActiveFilter('unread')}
          className={`pb-4 font-black text-sm border-b-2 transition-all flex items-center gap-2 ${activeFilter === 'unread' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
        >
          <span>Belum Dibaca</span>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveFilter('read')}
          className={`pb-4 font-black text-sm border-b-2 transition-all flex items-center gap-2 ${activeFilter === 'read' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
        >
          <span>Sudah Dibaca</span>
        </button>
      </div>

      {loading ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-gray-100 shadow-sm space-y-3">
          <RefreshCw className="w-8 h-8 text-primary-600 animate-spin mx-auto" />
          <p className="text-xs text-gray-400 font-bold">Sinkronisasi pesan masuk...</p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/20 space-y-3">
          <Bell className="w-10 h-10 text-gray-300 mx-auto" />
          <h5 className="font-extrabold text-gray-700 text-sm">Notifikasi Kosong</h5>
          <p className="text-xs text-gray-400">Tidak ada info baru yang tersedia pada kategori ini.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => void openNotification(notif)}
              className={`p-5 rounded-3xl border transition-all flex items-start gap-4 cursor-pointer relative ${
                notif.isRead
                  ? 'bg-white border-gray-100 hover:border-gray-200 shadow-sm'
                  : 'bg-primary-50/10 border-primary-100 hover:border-primary-200 shadow-sm shadow-primary-500/5'
              }`}
            >
              {!notif.isRead && (
                <span className="absolute top-5 right-5 w-2 h-2 bg-primary-600 rounded-full"></span>
              )}

              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  notif.isRead ? 'bg-gray-50 text-gray-400' : 'bg-primary-50 text-primary-700'
                }`}
              >
                {renderNotifIcon(notif.title)}
              </div>

              <div className="flex-1 min-w-0 pr-4">
                <h4 className={`text-sm text-gray-900 leading-tight ${notif.isRead ? 'font-bold' : 'font-black'}`}>
                  {notif.title}
                </h4>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{notif.message}</p>
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-2.5 font-bold">
                  <Clock className="w-3 h-3" />
                  <span>
                    {new Date(notif.createdAt).toLocaleString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                  {(notif.transactionId || notif.invoiceNumber) && (
                    <span className="text-primary-600">· Lihat detail</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
