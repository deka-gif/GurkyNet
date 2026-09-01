import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { router } from './router';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { NotificationToast } from './components/notifications/NotificationToast';
import { useEffect } from 'react';
import { useAuthStore } from './store/auth.store';

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
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

