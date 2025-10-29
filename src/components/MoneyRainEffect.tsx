import { useEffect, useState } from 'react';

interface MoneyRainEffectProps {
  trigger: boolean;
  amount: string;
  type: 'funding' | 'withdrawal';
  queueCount?: number; // ✅ Contador de transações na fila
}

export default function MoneyRainEffect({ trigger, amount, type, queueCount = 0 }: MoneyRainEffectProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (trigger) {
      setShow(true);
      
      // Tocar som
      try {
        const audio = new Audio(type === 'funding' 
          ? 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZRQ4PV6zo66lWEwtDm'
          : 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZRQ4PV6zo66lWEwtDm');
        audio.volume = 0.2; // ✅ Volume reduzido para não incomodar
        audio.play().catch(() => {});
      } catch (e) {}
      
      // Remover depois de 3 segundos
      setTimeout(() => setShow(false), 3000);
    }
  }, [trigger, type]);

  if (!show) return null;

  const isPositive = type === 'funding';
  const emojis = isPositive ? '💰😎' : '💸😢';
  const color = isPositive ? '#22c55e' : '#ef4444';
  
  // Formatar valor como BRL
  const formatBRL = (value: string) => {
    const numValue = parseFloat(value);
    return numValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  return (
    <>
      {/* Notificação minimalista estilo iPhone */}
      <div
        className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[9999] pointer-events-none"
        style={{
          animation: 'slide-down 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
      >
        <div 
          className="flex items-center gap-3 px-4 py-3 rounded-2xl backdrop-blur-2xl shadow-lg border"
          style={{
            background: 'rgba(255, 255, 255, 0.75)',
            borderColor: 'rgba(255, 255, 255, 0.3)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
            minWidth: '240px',
            maxWidth: '300px'
          }}
        >
          {/* Emojis */}
          <div className="text-3xl">
            {emojis}
          </div>
          
          {/* Valor formatado */}
          <div className="flex-1">
            <div 
              className="text-2xl font-bold tracking-tight"
              style={{ color }}
            >
              {isPositive ? '+' : '-'} R$ {formatBRL(amount)}
            </div>
            
            {/* Contador de transações na fila */}
            {queueCount > 1 && (
              <div className="text-xs text-muted-foreground mt-0.5">
                +{queueCount - 1} {queueCount - 1 === 1 ? 'transação' : 'transações'} aguardando...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes slide-down {
          0% { 
            transform: translate(-50%, -80px);
            opacity: 0;
          }
          100% { 
            transform: translate(-50%, 0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}

