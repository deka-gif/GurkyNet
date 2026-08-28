import { useEffect, useRef } from 'react';
import { useAutoDismissTimer } from '../../hooks/useAutoDismissTimer';
import type { ToastItem, ToastType } from '../../store/toast.store';

const typeStyles: Record<
  ToastType,
  { iconBg: string; iconColor: string; progress: string; border: string }
> = {
  success: {
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    progress: 'bg-emerald-500',
    border: 'border-emerald-100',
  },
  error: {
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    progress: 'bg-rose-500',
    border: 'border-rose-100',
  },
  warning: {
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    progress: 'bg-amber-500',
    border: 'border-amber-100',
  },
  info: {
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-600',
    progress: 'bg-sky-500',
    border: 'border-sky-100',
  },
};

export function AutoDismissProgressBar({
  progress,
  progressClassName,
}: {
  progress: number;
  progressClassName: string;
}) {
  return (
    <div className="absolute inset-x-0 top-0 h-1 bg-slate-100/80">
      <div
        className={`h-full ${progressClassName} transition-[width] duration-75 ease-linear`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

/** Shared countdown + pause-on-hover for toast and inline banners. */
export function useAlertAutoDismiss(
  messageKey: string | null | undefined,
  durationMs: number,
  onDismiss: () => void,
) {
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  return useAutoDismissTimer(messageKey, durationMs, () => onDismissRef.current());
}

export { typeStyles as toastTypeStyles };
export type { ToastItem, ToastType };
