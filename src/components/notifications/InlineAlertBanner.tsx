import { motion } from 'motion/react';
import { AlertCircle, CheckCircle2, type LucideIcon } from 'lucide-react';
import { AutoDismissProgressBar, useAlertAutoDismiss } from './autoDismissUtils';

export const INLINE_ALERT_SUCCESS_MS = 5_000;
export const INLINE_ALERT_ERROR_MS = 6_000;

type InlineAlertVariant = 'success' | 'error';

const variantConfig: Record<
  InlineAlertVariant,
  {
    Icon: LucideIcon;
    container: string;
    icon: string;
    title: string;
    body: string;
    close: string;
    progress: string;
  }
> = {
  success: {
    Icon: CheckCircle2,
    container: 'bg-emerald-50 border-emerald-100',
    icon: 'text-emerald-600',
    title: 'text-emerald-900',
    body: 'text-emerald-700',
    close: 'text-emerald-500 hover:text-emerald-800',
    progress: 'bg-emerald-500',
  },
  error: {
    Icon: AlertCircle,
    container: 'bg-red-50 border-red-100',
    icon: 'text-red-600',
    title: 'text-red-900',
    body: 'text-red-700',
    close: 'text-red-500 hover:text-red-800',
    progress: 'bg-red-500',
  },
};

interface InlineAlertBannerProps {
  variant: InlineAlertVariant;
  title: string;
  message: string;
  onDismiss: () => void;
  durationMs?: number;
}

/**
 * Inline success/error banner with auto-dismiss, pause-on-hover, and progress bar.
 * Reuses SingleToast timer pattern (NotificationToast.tsx).
 */
export function InlineAlertBanner({
  variant,
  title,
  message,
  onDismiss,
  durationMs = variant === 'success' ? INLINE_ALERT_SUCCESS_MS : INLINE_ALERT_ERROR_MS,
}: InlineAlertBannerProps) {
  const style = variantConfig[variant];
  const { Icon } = style;
  const { progress, pauseHandlers } = useAlertAutoDismiss(message, durationMs, onDismiss);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      role="status"
      aria-live="polite"
      {...pauseHandlers}
      className={`relative overflow-hidden rounded-2xl border p-4 flex items-start gap-3.5 ${style.container}`}
    >
      <AutoDismissProgressBar progress={progress} progressClassName={style.progress} />
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${style.icon}`} />
      <div className="flex-1 pt-1">
        <h5 className={`font-bold text-sm ${style.title}`}>{title}</h5>
        <p className={`text-xs mt-0.5 ${style.body}`}>{message}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className={`text-xs font-bold shrink-0 ${style.close}`}
      >
        Tutup
      </button>
    </motion.div>
  );
}
