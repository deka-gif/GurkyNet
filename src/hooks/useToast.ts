import { useToastStore, type ToastType } from '../store/toast.store';

export type { ToastType };

/**
 * App-wide toast helper — call from any React component or non-React module.
 */
export function toast(input: {
  type: ToastType;
  title: string;
  description?: string;
  durationMs?: number;
  sourceId?: string;
}) {
  useToastStore.getState().push(input);
}

export function toastSuccess(title: string, description?: string, sourceId?: string) {
  toast({ type: 'success', title, description, sourceId });
}

export function toastError(title: string, description?: string, sourceId?: string) {
  toast({ type: 'error', title, description, sourceId });
}

export function toastWarning(title: string, description?: string, sourceId?: string) {
  toast({ type: 'warning', title, description, sourceId });
}

export function toastInfo(title: string, description?: string, sourceId?: string) {
  toast({ type: 'info', title, description, sourceId });
}

export function useToast() {
  const push = useToastStore((s) => s.push);
  const dismiss = useToastStore((s) => s.dismiss);
  const clear = useToastStore((s) => s.clear);
  const current = useToastStore((s) => s.current);

  return {
    push,
    dismiss,
    clear,
    current,
    success: (title: string, description?: string, sourceId?: string) =>
      push({ type: 'success', title, description, sourceId }),
    error: (title: string, description?: string, sourceId?: string) =>
      push({ type: 'error', title, description, sourceId }),
    warning: (title: string, description?: string, sourceId?: string) =>
      push({ type: 'warning', title, description, sourceId }),
    info: (title: string, description?: string, sourceId?: string) =>
      push({ type: 'info', title, description, sourceId }),
  };
}
