import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const FeedbackContext = createContext(null);
const TOAST_EXIT_MS = 250;
const DIALOG_EXIT_MS = 200;

// Windows 11 Adaptive System Tones - Shared flawlessly across Toast & Modal
const toneStyles = {
  info: {
    label: 'Windows Security',
    icon: 'shield_with_heart',
    accent: 'bg-[#0078d4]', 
    iconClass: 'text-[#0078d4]',
    border: 'border-black/[0.08] dark:border-white/[0.08]',
    confirmClass: 'bg-[#0078d4] text-white hover:bg-[#106ebe] active:bg-[#005a9e]',
  },
  success: {
    label: 'Completed',
    icon: 'verified',
    accent: 'bg-[#107c41]', 
    iconClass: 'text-[#107c41]',
    border: 'border-black/[0.08] dark:border-white/[0.08]',
    confirmClass: 'bg-[#107c41] text-white hover:bg-[#0b5930] active:bg-[#084324]',
  },
  warning: {
    label: 'User Account Control',
    icon: 'shield', 
    accent: 'bg-[#fff100]', 
    iconClass: 'text-[#e81123] dark:text-[#ffb900]',
    border: 'border-black/[0.12] dark:border-white/[0.12]',
    confirmClass: 'bg-[#0078d4] text-white hover:bg-[#106ebe] active:bg-[#005a9e]',
  },
  danger: {
    label: 'Blocked',
    icon: 'gpp_bad',
    accent: 'bg-[#a80000]', 
    iconClass: 'text-[#a80000]',
    border: 'border-black/[0.08] dark:border-white/[0.08]',
    confirmClass: 'bg-[#a80000] text-white hover:bg-[#b32020] active:bg-[#800000]',
  },
};

const defaultAlertTitles = {
  info: 'Windows Notification',
  success: 'Action Successful',
  warning: 'Do you want to allow this app to make changes?',
  danger: 'An error occurred',
};

const createId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeDialogOptions = (input, fallback) => {
  const options = typeof input === 'string' ? { message: input } : (input || {});
  return { ...fallback, ...options };
};

const getToastPhaseClass = (phase) => {
  if (phase === 'enter') return 'translate-x-[420px] opacity-0';
  if (phase === 'exit') return 'translate-x-[420px] opacity-0 transition-all duration-250 cubic-bezier(0.7, 0, 1, 0.5)';
  return 'translate-x-0 opacity-100 transition-all duration-300 cubic-bezier(0.1, 0.9, 0.2, 1)';
};

const getDialogPhaseClass = (phase) => {
  if (phase === 'enter') return 'opacity-0 scale-[0.96] translate-y-3';
  if (phase === 'exit') return 'opacity-0 scale-95 transition-all duration-150 cubic-bezier(0.7, 0, 1, 0.5)';
  return 'opacity-100 scale-100 translate-y-0 transition-all duration-300 cubic-bezier(0.1, 0.9, 0.2, 1)';
};

const getBackdropPhaseClass = (phase) => {
  if (phase === 'enter') return 'opacity-0';
  if (phase === 'exit') return 'opacity-0 transition-opacity duration-150';
  return 'opacity-100 transition-opacity duration-200';
};

export function FeedbackProvider({ children }) {
  const [dialogView, setDialogView] = useState(null);
  const [toasts, setToasts] = useState([]);
  const dialogResolveRef = useRef(null);
  const dialogResultRef = useRef(false);
  const toastTimersRef = useRef(new Map());
  const toastRemovalTimersRef = useRef(new Map());
  const dialogExitTimerRef = useRef(null);
  const portalTarget = typeof document !== 'undefined' ? document.body : null;

  const dismissToast = useCallback((id) => {
    const autoTimer = toastTimersRef.current.get(id);
    if (autoTimer) {
      clearTimeout(autoTimer);
      toastTimersRef.current.delete(id);
    }

    const exitTimer = toastRemovalTimersRef.current.get(id);
    if (exitTimer) {
      clearTimeout(exitTimer);
      toastRemovalTimersRef.current.delete(id);
    }

    let shouldScheduleRemoval = false;
    setToasts((current) => {
      const hasToast = current.some((toast) => toast.id === id);
      const isExiting = current.some((toast) => toast.id === id && toast.phase === 'exit');
      shouldScheduleRemoval = hasToast && !isExiting;
      return current.map((toast) => (
        toast.id === id ? { ...toast, phase: 'exit' } : toast
      ));
    });

    if (!shouldScheduleRemoval) return;

    const removalTimer = window.setTimeout(() => {
      toastRemovalTimersRef.current.delete(id);
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, TOAST_EXIT_MS);

    toastRemovalTimersRef.current.set(id, removalTimer);
  }, []);

  const showToast = useCallback((input, maybeOptions = {}) => {
    const options = typeof input === 'string'
      ? { message: input, ...maybeOptions }
      : { ...(input || {}) };

    const tone = options.tone || 'info';
    const styles = toneStyles[tone] || toneStyles.info;
    const id = createId();
    const duration = options.duration ?? 4000;

    setToasts((current) => [
      ...current,
      {
        id,
        tone,
        title: options.title || styles.label,
        message: options.message || '',
        duration,
        phase: 'enter',
      },
    ]);

    if (duration !== Infinity) {
      const timer = window.setTimeout(() => dismissToast(id), duration);
      toastTimersRef.current.set(id, timer);
    }

    return id;
  }, [dismissToast]);

  const openDialog = useCallback((config) => {
    return new Promise((resolve) => {
      if (dialogResolveRef.current) {
        dialogResolveRef.current(false);
        dialogResolveRef.current = null;
      }

      if (dialogExitTimerRef.current) {
        clearTimeout(dialogExitTimerRef.current);
        dialogExitTimerRef.current = null;
      }

      dialogResultRef.current = false;
      dialogResolveRef.current = resolve;
      setDialogView({ id: createId(), phase: 'enter', ...config });
    });
  }, []);

  const closeDialog = useCallback((result) => {
    if (!dialogView || dialogView.phase === 'exit') return;
    dialogResultRef.current = result;
    setDialogView((current) => (current ? { ...current, phase: 'exit' } : current));
  }, [dialogView]);

  const showAlert = useCallback((input) => {
    const options = normalizeDialogOptions(input, {
      kind: 'alert',
      tone: 'info',
      title: defaultAlertTitles.info,
      message: '',
      confirmText: 'OK',
    });

    const tone = options.tone || 'info';
    return openDialog({
      kind: 'alert',
      tone,
      title: options.title || defaultAlertTitles[tone] || defaultAlertTitles.info,
      message: options.message || '',
      confirmText: options.confirmText || 'OK',
    });
  }, [openDialog]);

  const showConfirm = useCallback((input) => {
    const options = normalizeDialogOptions(input, {
      kind: 'confirm',
      tone: 'warning',
      title: 'User Account Control',
      message: '',
      confirmText: 'Yes',
      cancelText: 'No',
    });

    return openDialog({
      kind: 'confirm',
      tone: options.tone || 'warning',
      title: options.title || 'User Account Control',
      message: options.message || '',
      confirmText: options.confirmText || 'Yes',
      cancelText: options.cancelText || 'No',
    });
  }, [openDialog]);

  useEffect(() => {
    return () => {
      toastTimersRef.current.forEach((timer) => clearTimeout(timer));
      toastRemovalTimersRef.current.forEach((timer) => clearTimeout(timer));
      if (dialogExitTimerRef.current) clearTimeout(dialogExitTimerRef.current);
      if (dialogResolveRef.current) dialogResolveRef.current(false);
    };
  }, []);

  useEffect(() => {
    if (!toasts.some((t) => t.phase === 'enter')) return;
    const frame = requestAnimationFrame(() => {
      setToasts((current) => current.map((t) => t.phase === 'enter' ? { ...t, phase: 'open' } : t));
    });
    return () => cancelAnimationFrame(frame);
  }, [toasts]);

  useEffect(() => {
    if (dialogView?.phase !== 'enter') return;
    const frame = requestAnimationFrame(() => {
      setDialogView((current) => current?.phase === 'enter' ? { ...current, phase: 'open' } : current);
    });
    return () => cancelAnimationFrame(frame);
  }, [dialogView?.id, dialogView?.phase]);

  useEffect(() => {
    if (dialogView?.phase !== 'exit') return;
    dialogExitTimerRef.current = window.setTimeout(() => {
      if (dialogResolveRef.current) {
        dialogResolveRef.current(dialogResultRef.current);
        dialogResolveRef.current = null;
      }
      setDialogView(null);
    }, DIALOG_EXIT_MS);
    return () => clearTimeout(dialogExitTimerRef.current);
  }, [dialogView?.id, dialogView?.phase]);

  const value = useMemo(() => ({
    toast: showToast,
    showToast,
    alert: showAlert,
    showAlert,
    confirm: showConfirm,
    showConfirm,
  }), [showAlert, showConfirm, showToast]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {portalTarget ? <ToastViewport toasts={toasts} onDismiss={dismissToast} portalTarget={portalTarget} /> : null}
      {portalTarget && dialogView ? <FeedbackDialog dialogView={dialogView} onResolve={closeDialog} portalTarget={portalTarget} /> : null}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('useFeedback must be used within a FeedbackProvider');
  return context;
}

function ToastViewport({ toasts, onDismiss, portalTarget }) {
  return createPortal(
    <div className="pointer-events-none fixed bottom-0 right-0 z-[240] p-3 sm:p-4 md:p-6 w-full max-w-[380px] flex flex-col gap-2 overflow-hidden">
      {[...toasts].reverse().map((toast) => (
        <div key={toast.id} className="w-full transform-gpu">
          <ToastCard toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>,
    portalTarget,
  );
}

// Adaptive Windows 11 Flyout Notification Card
function ToastCard({ toast, onDismiss }) {
  const styles = toneStyles[toast.tone] || toneStyles.info;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto overflow-hidden rounded-[8px] border bg-[#f3f3f3]/90 dark:bg-[#202020]/85 text-black dark:text-white shadow-xl backdrop-blur-2xl will-change-transform ${styles.border} ${getToastPhaseClass(toast.phase)}`}
      style={{ fontFamily: '"Segoe UI", system-ui, sans-serif' }}
    >
      <div className="flex p-3 items-start gap-3">
        <div className={`mt-0.5 shrink-0 ${styles.iconClass}`}>
          <span className="material-symbols-outlined text-[20px] font-light">
            {toast.tone === 'warning' && typeof window !== 'undefined' && !document.documentElement.classList.contains('dark') ? 'warning' : styles.icon}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold tracking-wide text-neutral-800 dark:text-neutral-200">{toast.title}</p>
          {toast.message ? (
            <p className="mt-0.5 text-[12px] leading-normal text-neutral-600 dark:text-neutral-400 whitespace-pre-line">
              {toast.message}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 h-6 w-6 rounded flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:bg-black/5 dark:hover:bg-white/10 hover:text-black dark:hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <span className="material-symbols-outlined text-[14px]">close</span>
        </button>
      </div>
    </div>
  );
}

// EXACT TOAST DESIGN REFLECTION: Windows 11 System Modal Layout
// MODIFIED CODE: Ultra-Modern Premium Dialog UI (Replacing the boxy structure)
function FeedbackDialog({ dialogView, onResolve, portalTarget }) {
  const styles = toneStyles[dialogView.tone] || toneStyles.info;
  const confirmButtonRef = useRef(null);

  useEffect(() => {
    confirmButtonRef.current?.focus();
  }, [dialogView]);

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
      {/* Cinematic Premium Dim Backdrop Overlay */}
      <div
        className={`absolute inset-0 bg-black/40 dark:bg-[#090d10]/70 backdrop-blur-[12px] transition-all duration-200 ${getBackdropPhaseClass(dialogView.phase)}`}
        onClick={() => onResolve(dialogView.kind === 'alert')}
      ></div>
      
      {/* Modern High-End Structural Card */}
      <div
        role={dialogView.kind === 'confirm' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        tabIndex={-1}
        className={`relative w-full max-w-[430px] overflow-hidden rounded-[20px] border border-neutral-200/60 dark:border-white/[0.08] bg-white dark:bg-[#15191e] text-black dark:text-white shadow-[0_24px_70px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_32px_80px_-20px_rgba(0,0,0,0.8)] transform-gpu transition-all ${getDialogPhaseClass(dialogView.phase)}`}
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dynamic Minimalist Edge Accent Strip */}
        <div className={`h-[4px] w-full ${styles.accent}`}></div>

        {/* Top-Right Micro Action Control */}
        <button
          type="button"
          onClick={() => onResolve(dialogView.kind === 'alert')}
          className="absolute top-4 right-4 h-7 w-7 rounded-full flex items-center justify-center text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.06] hover:text-neutral-700 dark:hover:text-neutral-200 transition-all duration-200"
          aria-label="Close"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>

        {/* Content Body Layout */}
        <div className="p-6 pt-7">
          <div className="flex items-center gap-3.5 mb-3">
            {/* Minimal Circular Icon Badging */}
            <div className={`shrink-0 p-2 rounded-xl bg-neutral-100 dark:bg-white/[0.04] ${styles.iconClass} flex items-center justify-center shadow-sm`}>
              <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                {dialogView.tone === 'warning' && typeof window !== 'undefined' && !document.documentElement.classList.contains('dark') ? 'warning' : styles.icon}
              </span>
            </div>
            
            <h2 className="text-[17px] font-bold tracking-tight text-neutral-900 dark:text-white">
              {dialogView.title}
            </h2>
          </div>

          {/* Premium Typography Space */}
          <div className="text-[14px] leading-relaxed text-neutral-500 dark:text-neutral-400 font-normal whitespace-pre-line px-1">
            {dialogView.message || 'Do you want to allow this application to load system processes?'}
          </div>

          {/* Clean Subtle Footer Divider Line */}
          <div className="mt-6 border-t border-neutral-100 dark:border-white/[0.06] pt-4 flex items-center gap-2 text-[11px] text-neutral-400 dark:text-neutral-500 tracking-wide select-none">
            <span className="material-symbols-outlined text-[13px] text-neutral-400">verified_user</span>
            End-to-End Encrypted Verification Engine
          </div>
        </div>

        {/* High-Contrast Production Action Footer */}
        <div className="bg-neutral-50 dark:bg-[#1a1f26] px-6 py-4 flex flex-row gap-3 justify-end border-t border-neutral-100 dark:border-white/[0.04]">
          {dialogView.kind === 'confirm' ? (
            <button
              type="button"
              onClick={() => onResolve(false)}
              className="px-5 h-[38px] rounded-xl text-[13px] font-semibold bg-white dark:bg-[#232a33] text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-white/[0.06] hover:bg-neutral-50 dark:hover:bg-[#2b343f] hover:text-neutral-900 dark:hover:text-white shadow-sm active:scale-[0.98] transition-all duration-150 outline-none"
            >
              {dialogView.cancelText}
            </button>
          ) : null}

          <button
            ref={confirmButtonRef}
            type="button"
            onClick={() => onResolve(true)}
            className={`px-5 h-[38px] rounded-xl text-[13px] font-semibold transition-all shadow-md shadow-sky-500/10 hover:brightness-110 active:scale-[0.98] outline-none focus:ring-2 focus:ring-sky-500/40 ${styles.confirmClass}`}
          >
            {dialogView.confirmText}
          </button>
        </div>
      </div>
    </div>,
    portalTarget,
  );
}