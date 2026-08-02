import { useEffect } from 'react';
import { useNotificationStore } from '../store/notification.store';

export const useNotifications = (autoFetch = false) => {
  const {
    notifications,
    loading,
    error,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotificationStore();

  useEffect(() => {
    if (autoFetch && notifications.length === 0 && !loading) {
      fetchNotifications();
    }
  }, [autoFetch, notifications, loading, fetchNotifications]);

  return {
    notifications,
    loading,
    error,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
};
