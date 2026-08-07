import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from 'lucide-react';
import { useToastStore, type ToastItem, type ToastType } from '../../store/toast.store';

const TICK_MS = 50;

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

function ToastIcon({ type }: { type: ToastType }) {
  const cls = 'w-5 h-5';
  switch (type) {
    case 'success':
      return <CheckCircle2 className={cls} />;
    case 'error':
      return <XCircle className={cls} />;
    case 'warning':
      return <AlertTriangle className={cls} />;
    default:
      return <Info className={cls} />;
  }
}

function SingleToast({
  item,
  onRequestDismiss,
}: {
  item: ToastItem;
  onRequestDismiss: () => void;
}) {
  const [remainingMs, setRemainingMs] = useState(item.durationMs);
  const pausedRef = useRef(false);
  const remainingRef = useRef(item.durationMs);
  const style = typeStyles[item.type];

  useEffect(() => {
    remainingRef.current = item.durationMs;
    setRemainingMs(item.durationMs);
  }, [item.id, item.durationMs]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (pausedRef.current) return;
      const next = Math.max(0, remainingRef.current - TICK_MS);
      remainingRef.current = next;
      setRemainingMs(next);
      if (next <= 0) {
        window.clearInterval(timer);
        onRequestDismiss();
      }
    }, TICK_MS);

    return () => window.clearInterval(timer);
  }, [item.id, onRequestDismiss]);

  const progress = Math.max(0, Math.min(100, (remainingMs / item.durationMs) * 100));

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
      className={`pointer-events-auto relative w-[min(92vw,380px)] overflow-hidden rounded-2xl border bg-white shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25)] ${style.border}`}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-slate-100/80">
        <div
          className={`h-full ${style.progress} transition-[width] duration-75 ease-linear`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-start gap-3 px-4 pb-4 pt-5">
        <div
          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.iconBg} ${style.iconColor}`}
        >
          <ToastIcon type={item.type} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-extrabold tracking-tight text-slate-900">{item.title}</div>
          {item.description ? (
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.description}</p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onRequestDismiss}
          aria-label="Tutup notifikasi"
          className="mt-0.5 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Renders the single active toast + drains the queue (no overlap).
 * Mount once inside DashboardLayout (user dashboard shell).
 */
export function NotificationToast() {
  const current = useToastStore((s) => s.current);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex justify-center px-3 md:inset-x-auto md:right-4 md:top-4 md:justify-end"
      aria-hidden={!current}
    >
      <AnimatePresence mode="wait">
        {current ? (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <SingleToast item={current} onRequestDismiss={dismiss} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default NotificationToast;
