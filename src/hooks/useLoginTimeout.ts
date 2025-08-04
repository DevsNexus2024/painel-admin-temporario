import { useEffect, useRef, useCallback } from 'react';
import { LOGIN_TIMEOUT_CONFIG, LAST_ACTIVITY_STORAGE } from '@/config/api';

export interface LoginTimeoutOptions {
  onTimeout?: () => void;
  onWarning?: (minutesRemaining: number) => void;
  enabled?: boolean;
}

export interface LoginTimeoutReturn {
  updateActivity: () => void;
  getTimeRemaining: () => number;
  isInactive: () => boolean;
}

/**
 * Hook para gerenciar timeout de login e monitorar atividade do usuário
 */
export const useLoginTimeout = (options: LoginTimeoutOptions = {}): LoginTimeoutReturn => {
  const {
    onTimeout,
    onWarning,
    enabled = true
  } = options;

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTriggeredRef = useRef<boolean>(false);
  const lastActivityRef = useRef<number>(Date.now());

  /**
   * Atualizar timestamp da última atividade
   */
  const updateActivity = useCallback(() => {
    if (!enabled) return;
    
    const now = Date.now();
    lastActivityRef.current = now;
    LAST_ACTIVITY_STORAGE.set(now);
    
    // Reset warning flag quando há nova atividade
    warningTriggeredRef.current = false;
    
    console.log('🔄 [LoginTimeout] Atividade atualizada:', new Date(now).toLocaleTimeString());
  }, [enabled]);

  /**
   * Verificar se deve mostrar aviso ou fazer logout
   */
  const checkTimeout = useCallback(() => {
    if (!enabled) return;

    const timeRemaining = LAST_ACTIVITY_STORAGE.getTimeUntilTimeout();
    const isInactive = LAST_ACTIVITY_STORAGE.isInactive();

    console.log('⏱️ [LoginTimeout] Verificação:', {
      timeRemaining,
      isInactive,
      warningTriggered: warningTriggeredRef.current
    });

    if (isInactive) {
      console.log('🚪 [LoginTimeout] Usuário inativo, fazendo logout...');
      onTimeout?.();
      return;
    }

    // Mostrar aviso se estiver próximo do timeout
    if (timeRemaining <= LOGIN_TIMEOUT_CONFIG.WARNING_MINUTES && !warningTriggeredRef.current) {
      console.log('⚠️ [LoginTimeout] Mostrando aviso de timeout:', timeRemaining);
      warningTriggeredRef.current = true;
      onWarning?.(timeRemaining);
    }
  }, [enabled, onTimeout, onWarning]);

  /**
   * Adicionar listeners de eventos de atividade
   */
  useEffect(() => {
    if (!enabled) return;

    const handleActivity = () => updateActivity();

    // Adicionar listeners para todos os eventos de atividade
    LOGIN_TIMEOUT_CONFIG.ACTIVITY_EVENTS.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Registrar atividade inicial
    updateActivity();

    return () => {
      // Remover listeners
      LOGIN_TIMEOUT_CONFIG.ACTIVITY_EVENTS.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [enabled, updateActivity]);

  /**
   * Inicializar verificação periódica
   */
  useEffect(() => {
    if (!enabled) return;

    // Verificação inicial
    checkTimeout();

    // Configurar verificação periódica
    timeoutRef.current = setInterval(
      checkTimeout,
      LOGIN_TIMEOUT_CONFIG.CHECK_INTERVAL_MS
    );

    return () => {
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [enabled, checkTimeout]);

  /**
   * Obter tempo restante em minutos
   */
  const getTimeRemaining = useCallback((): number => {
    return LAST_ACTIVITY_STORAGE.getTimeUntilTimeout();
  }, []);

  /**
   * Verificar se usuário está inativo
   */
  const isInactive = useCallback((): boolean => {
    return LAST_ACTIVITY_STORAGE.isInactive();
  }, []);

  return {
    updateActivity,
    getTimeRemaining,
    isInactive
  };
};

export default useLoginTimeout;