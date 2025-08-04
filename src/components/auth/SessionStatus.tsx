import React, { useState, useEffect } from 'react';
import { Clock, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { LAST_ACTIVITY_STORAGE, LOGIN_TIMEOUT_CONFIG } from '@/config/api';

interface SessionStatusProps {
  /** Mostrar apenas quando próximo do timeout */
  showOnlyWhenNearTimeout?: boolean;
  /** Estilo do componente */
  variant?: 'badge' | 'card' | 'inline';
  /** Se deve ser exibido */
  visible?: boolean;
}

/**
 * Componente para mostrar status da sessão e tempo restante
 */
export const SessionStatus: React.FC<SessionStatusProps> = ({
  showOnlyWhenNearTimeout = false,
  variant = 'badge',
  visible = true
}) => {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isNearTimeout, setIsNearTimeout] = useState<boolean>(false);

  useEffect(() => {
    if (!visible) return;

    const updateStatus = () => {
      const remaining = LAST_ACTIVITY_STORAGE.getTimeUntilTimeout();
      const nearTimeout = remaining <= LOGIN_TIMEOUT_CONFIG.WARNING_MINUTES;
      
      setTimeRemaining(remaining);
      setIsNearTimeout(nearTimeout);
    };

    // Atualizar imediatamente
    updateStatus();

    // Atualizar a cada 30 segundos
    const interval = setInterval(updateStatus, 30000);

    return () => clearInterval(interval);
  }, [visible]);

  // Não mostrar se não deve ser visível
  if (!visible) return null;

  // Não mostrar se deve mostrar apenas próximo do timeout e não está próximo
  if (showOnlyWhenNearTimeout && !isNearTimeout) return null;

  // Não mostrar se não há tempo restante
  if (timeRemaining <= 0) return null;

  const formatTime = (minutes: number): string => {
    if (minutes <= 0) return 'Expirado';
    if (minutes === 1) return '1 min';
    if (minutes < 60) return `${minutes} min`;
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours === 1 && remainingMinutes === 0) return '1h';
    if (hours === 1) return `1h ${remainingMinutes}min`;
    if (remainingMinutes === 0) return `${hours}h`;
    
    return `${hours}h ${remainingMinutes}min`;
  };

  const getStatusColor = () => {
    if (timeRemaining <= 5) return 'destructive';
    if (timeRemaining <= 10) return 'secondary';
    return 'default';
  };

  const content = (
    <>
      <Clock className="w-3 h-3 mr-1" />
      Sessão: {formatTime(timeRemaining)}
    </>
  );

  switch (variant) {
    case 'card':
      return (
        <Card className={`w-fit ${isNearTimeout ? 'border-orange-200 bg-orange-50' : ''}`}>
          <CardContent className="p-3">
            <div className="flex items-center text-sm">
              <Shield className="w-4 h-4 mr-2 text-muted-foreground" />
              <span className="text-muted-foreground">
                Sessão expira em: 
              </span>
              <span className={`ml-1 font-medium ${
                isNearTimeout ? 'text-orange-600' : 'text-green-600'
              }`}>
                {formatTime(timeRemaining)}
              </span>
            </div>
          </CardContent>
        </Card>
      );

    case 'inline':
      return (
        <span className={`text-xs ${
          isNearTimeout ? 'text-orange-600' : 'text-muted-foreground'
        }`}>
          Sessão: {formatTime(timeRemaining)}
        </span>
      );

    case 'badge':
    default:
      return (
        <Badge 
          variant={getStatusColor()}
          className="text-xs"
        >
          {content}
        </Badge>
      );
  }
};

export default SessionStatus;