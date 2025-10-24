/**
 * 🎨 Toast Helper
 * Funções auxiliares para exibir toasts padronizados usando Sonner
 */

import { toast } from 'sonner';

/**
 * Toast de erro (vermelho)
 */
export const toastError = (title: string, description?: string) => {
  return toast.error(title, {
    description,
    style: {
      borderLeft: '4px solid rgb(239 68 68)', // red-500
      background: 'rgba(239, 68, 68, 0.1)', // red-500/10
    },
    duration: 5000,
  });
};

/**
 * Toast de sucesso (verde)
 */
export const toastSuccess = (title: string, description?: string) => {
  return toast.success(title, {
    description,
    style: {
      borderLeft: '4px solid rgb(34 197 94)', // green-500
      background: 'rgba(34, 197, 94, 0.1)', // green-500/10
    },
    duration: 4000,
  });
};

/**
 * Toast de aviso (amarelo)
 */
export const toastWarning = (title: string, description?: string) => {
  return toast.warning(title, {
    description,
    style: {
      borderLeft: '4px solid rgb(234 179 8)', // yellow-500
      background: 'rgba(234, 179, 8, 0.1)', // yellow-500/10
    },
    duration: 5000,
  });
};

/**
 * Toast informativo (azul)
 */
export const toastInfo = (title: string, description?: string) => {
  return toast.info(title, {
    description,
    style: {
      borderLeft: '4px solid rgb(59 130 246)', // blue-500
      background: 'rgba(59, 130, 246, 0.1)', // blue-500/10
    },
    duration: 4000,
  });
};

/**
 * Toast de carregamento
 */
export const toastLoading = (title: string, description?: string) => {
  return toast.loading(title, {
    description,
    style: {
      borderLeft: '4px solid rgb(107 114 128)', // gray-500
      background: 'rgba(107, 114, 128, 0.1)', // gray-500/10
    },
  });
};

/**
 * Toast genérico
 */
export const toastCustom = (
  title: string, 
  description?: string, 
  variant: 'danger' | 'warning' | 'success' | 'primary' | 'info' = 'info'
) => {
  const styles = {
    danger: {
      borderLeft: '4px solid rgb(239 68 68)',
      background: 'rgba(239, 68, 68, 0.1)',
    },
    warning: {
      borderLeft: '4px solid rgb(234 179 8)',
      background: 'rgba(234, 179, 8, 0.1)',
    },
    success: {
      borderLeft: '4px solid rgb(34 197 94)',
      background: 'rgba(34, 197, 94, 0.1)',
    },
    primary: {
      borderLeft: '4px solid rgb(59 130 246)',
      background: 'rgba(59, 130, 246, 0.1)',
    },
    info: {
      borderLeft: '4px solid rgb(107 114 128)',
      background: 'rgba(107, 114, 128, 0.1)',
    },
  };

  return toast(title, {
    description,
    style: styles[variant],
    duration: variant === 'danger' || variant === 'warning' ? 5000 : 4000,
  });
};

/**
 * Promise Toast - Para operações assíncronas
 */
export const toastPromise = <T,>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: any) => string);
  }
) => {
  return toast.promise(promise, {
    loading: {
      title: messages.loading,
      style: {
        borderLeft: '4px solid rgb(107 114 128)',
        background: 'rgba(107, 114, 128, 0.1)',
      },
    },
    success: {
      title: typeof messages.success === 'function' ? 'Sucesso' : messages.success,
      style: {
        borderLeft: '4px solid rgb(34 197 94)',
        background: 'rgba(34, 197, 94, 0.1)',
      },
    },
    error: {
      title: typeof messages.error === 'function' ? 'Erro' : messages.error,
      style: {
        borderLeft: '4px solid rgb(239 68 68)',
        background: 'rgba(239, 68, 68, 0.1)',
      },
    },
  });
};

