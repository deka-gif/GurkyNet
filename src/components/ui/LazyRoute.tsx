import { Suspense, type ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { PageSkeleton } from './PageSkeleton';

type LazyRouteProps = {
  children: ReactNode;
};

/** Suspense + ErrorBoundary wrapper for lazy dashboard routes. */
export function LazyRoute({ children }: LazyRouteProps) {
  return (
    <ErrorBoundary fallbackTitle="Halaman gagal dimuat">
      <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

export default LazyRoute;
