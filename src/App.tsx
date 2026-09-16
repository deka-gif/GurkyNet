import React, { lazy, Suspense, useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './router';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { NotificationToast } from './components/notifications/NotificationToast';
import { useAuthStore } from './store/auth.store';
import { toastWarning } from './hooks/useToast';

const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((m) => ({
        default: m.ReactQueryDevtools,
      }))
    )
  : null;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function AuthHydrator({ children }: { children: React.ReactNode }) {
  const { fetchUser, token, logout } = useAuthStore();

  useEffect(() => {
    if (token) {
      fetchUser();
    }

    const handleUnauthorized = () => {
      logout();
      toastWarning('Sesi berakhir', 'Sesi Anda telah berakhir karena tidak aktif. Silakan login kembali.');
    };

    window.addEventListener('auth-unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth-unauthorized', handleUnauthorized);
    };
  }, []);

  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthHydrator>
          <RouterProvider router={router} />
        </AuthHydrator>
        <NotificationToast />
        {ReactQueryDevtools ? (
          <Suspense fallback={null}>
            <ReactQueryDevtools initialIsOpen={false} />
          </Suspense>
        ) : null}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
