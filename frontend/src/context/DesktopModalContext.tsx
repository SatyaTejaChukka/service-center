import React, { createContext, useContext, useState, useRef, useEffect, type ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, HelpCircle, X } from 'lucide-react';

export type DialogType = 'info' | 'success' | 'warning' | 'error' | 'confirm' | 'prompt';

export interface AlertOptions {
  title?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  okText?: string;
}

export interface ConfirmOptions {
  title?: string;
  type?: 'info' | 'warning' | 'danger';
  confirmText?: string;
  cancelText?: string;
  variant?: 'primary' | 'danger' | 'warning';
}

export interface PromptOptions {
  title?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  required?: boolean;
}

export interface ToastItem {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

interface DialogState {
  isOpen: boolean;
  type: DialogType;
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  variant: 'primary' | 'danger' | 'warning';
  promptValue?: string;
  placeholder?: string;
  required?: boolean;
  resolve: (value: any) => void;
}

interface DesktopModalContextType {
  alert: (message: string, options?: AlertOptions) => Promise<void>;
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  prompt: (message: string, options?: PromptOptions) => Promise<string | null>;
  toast: (message: string, type?: 'info' | 'success' | 'warning' | 'error', durationMs?: number) => void;
}

const DesktopModalContext = createContext<DesktopModalContextType | undefined>(undefined);

// Imperative global bridge for usage anywhere (e.g. utility files, async callbacks)
export const desktopDialog: {
  alert: (message: string, options?: AlertOptions) => Promise<void>;
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  prompt: (message: string, options?: PromptOptions) => Promise<string | null>;
  toast: (message: string, type?: 'info' | 'success' | 'warning' | 'error', durationMs?: number) => void;
} = {
  alert: async () => {},
  confirm: async () => false,
  prompt: async () => null,
  toast: () => {},
};

export const DesktopModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const promptInputRef = useRef<HTMLInputElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // Focus management
  useEffect(() => {
    if (dialog?.isOpen) {
      if (dialog.type === 'prompt') {
        setTimeout(() => promptInputRef.current?.focus(), 50);
      } else {
        setTimeout(() => confirmBtnRef.current?.focus(), 50);
      }
    }
  }, [dialog?.isOpen, dialog?.type]);

  const showAlert = (message: string, options?: AlertOptions): Promise<void> => {
    return new Promise((resolve) => {
      const type = options?.type || 'info';
      const defaultTitle = type === 'error' ? 'Notice: Error' : type === 'warning' ? 'Attention' : type === 'success' ? 'Success' : 'Information';
      setDialog({
        isOpen: true,
        type,
        title: options?.title || defaultTitle,
        message,
        confirmText: options?.okText || 'OK',
        variant: type === 'error' ? 'danger' : type === 'warning' ? 'warning' : 'primary',
        resolve: () => {
          setDialog(null);
          resolve();
        },
      });
    });
  };

  const showConfirm = (message: string, options?: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      const variant = options?.variant || (options?.type === 'danger' ? 'danger' : 'primary');
      setDialog({
        isOpen: true,
        type: 'confirm',
        title: options?.title || 'Please Confirm',
        message,
        confirmText: options?.confirmText || 'Confirm',
        cancelText: options?.cancelText || 'Cancel',
        variant,
        resolve: (result: boolean) => {
          setDialog(null);
          resolve(Boolean(result));
        },
      });
    });
  };

  const showPrompt = (message: string, options?: PromptOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      setDialog({
        isOpen: true,
        type: 'prompt',
        title: options?.title || 'Action Required',
        message,
        confirmText: options?.confirmText || 'Submit',
        cancelText: options?.cancelText || 'Cancel',
        promptValue: options?.defaultValue || '',
        placeholder: options?.placeholder || '',
        required: options?.required !== false,
        variant: 'primary',
        resolve: (result: string | null) => {
          setDialog(null);
          resolve(result);
        },
      });
    });
  };

  const showToast = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', durationMs: number = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration: durationMs }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, durationMs);
  };

  // Wire imperative singleton bridge
  desktopDialog.alert = showAlert;
  desktopDialog.confirm = showConfirm;
  desktopDialog.prompt = showPrompt;
  desktopDialog.toast = showToast;

  // Handle keyboard shortcuts (Enter to confirm, Escape to cancel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!dialog?.isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (dialog.type === 'confirm' || dialog.type === 'prompt') {
          dialog.resolve(dialog.type === 'confirm' ? false : null);
        } else {
          dialog.resolve(undefined);
        }
      } else if (e.key === 'Enter' && dialog.type === 'prompt') {
        e.preventDefault();
        dialog.resolve(dialog.promptValue || '');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialog]);

  const renderIcon = (type: DialogType, variant: string) => {
    switch (type) {
      case 'error':
        return (
          <div className="w-11 h-11 rounded-full bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
        );
      case 'warning':
        return (
          <div className="w-11 h-11 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
        );
      case 'success':
        return (
          <div className="w-11 h-11 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        );
      case 'prompt':
        return (
          <div className="w-11 h-11 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <HelpCircle className="w-6 h-6" />
          </div>
        );
      case 'confirm':
        return (
          <div className={`w-11 h-11 rounded-full ${variant === 'danger' ? 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'} flex items-center justify-center shrink-0`}>
            {variant === 'danger' ? <AlertTriangle className="w-6 h-6" /> : <HelpCircle className="w-6 h-6" />}
          </div>
        );
      case 'info':
      default:
        return (
          <div className="w-11 h-11 rounded-full bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Info className="w-6 h-6" />
          </div>
        );
    }
  };

  const getConfirmButtonClasses = (variant: 'primary' | 'danger' | 'warning') => {
    switch (variant) {
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-sm shadow-rose-600/20 focus:ring-rose-500';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-sm shadow-amber-600/20 focus:ring-amber-500';
      case 'primary':
      default:
        return 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm shadow-blue-600/20 focus:ring-blue-500';
    }
  };

  return (
    <DesktopModalContext.Provider value={{ alert: showAlert, confirm: showConfirm, prompt: showPrompt, toast: showToast }}>
      {children}

      {/* Modern Desktop Modal Dialog Overlay */}
      {dialog?.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150 transition-all transform select-none"
            role="dialog"
            aria-modal="true"
          >
            {/* Desktop Dialog Title Bar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Pushpa Raj Workshop &bull; Dialog
              </span>
              <button
                type="button"
                onClick={() => {
                  if (dialog.type === 'confirm') dialog.resolve(false);
                  else if (dialog.type === 'prompt') dialog.resolve(null);
                  else dialog.resolve(undefined);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Dialog Content */}
            <div className="p-6">
              <div className="flex items-start gap-4">
                {renderIcon(dialog.type, dialog.variant)}
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white leading-tight">
                    {dialog.title}
                  </h3>
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
                    {dialog.message}
                  </div>
                </div>
              </div>

              {/* Prompt Input Field */}
              {dialog.type === 'prompt' && (
                <div className="mt-4">
                  <input
                    ref={promptInputRef}
                    type="text"
                    value={dialog.promptValue || ''}
                    onChange={(e) => setDialog((prev) => (prev ? { ...prev, promptValue: e.target.value } : null))}
                    placeholder={dialog.placeholder}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              )}

              {/* Dialog Actions */}
              <div className="mt-6 flex items-center justify-end gap-2.5">
                {(dialog.type === 'confirm' || dialog.type === 'prompt') && (
                  <button
                    type="button"
                    onClick={() => dialog.resolve(dialog.type === 'confirm' ? false : null)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400/20"
                  >
                    {dialog.cancelText || 'Cancel'}
                  </button>
                )}
                <button
                  ref={confirmBtnRef}
                  type="button"
                  onClick={() => {
                    if (dialog.type === 'confirm') dialog.resolve(true);
                    else if (dialog.type === 'prompt') dialog.resolve(dialog.promptValue || '');
                    else dialog.resolve(undefined);
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all focus:outline-none focus:ring-2 ${getConfirmButtonClasses(
                    dialog.variant
                  )}`}
                >
                  {dialog.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modern Desktop Toast Container (Bottom-Right) */}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-sm text-slate-800 dark:text-slate-200 animate-in slide-in-from-bottom-3 duration-200"
            >
              {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />}
              {t.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />}
              {t.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />}
              {t.type === 'info' && <Info className="w-5 h-5 text-blue-500 shrink-0" />}
              <span className="flex-1 leading-snug">{t.message}</span>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </DesktopModalContext.Provider>
  );
};

export const useDesktopModal = (): DesktopModalContextType => {
  const context = useContext(DesktopModalContext);
  if (!context) {
    throw new Error('useDesktopModal must be used within a DesktopModalProvider');
  }
  return context;
};
