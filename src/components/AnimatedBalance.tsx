import { useEffect, useState, useRef } from 'react';

interface AnimatedBalanceProps {
  value: string | number;
  className?: string;
  formatAsCurrency?: boolean; // Se false, formata apenas com separadores
}

export default function AnimatedBalance({ value, className = '', formatAsCurrency = true }: AnimatedBalanceProps) {
  const [displayValue, setDisplayValue] = useState(value.toString());
  const [animatingIndices, setAnimatingIndices] = useState<number[]>([]);
  const previousValue = useRef(value.toString());

  useEffect(() => {
    const newValue = value.toString();
    const oldValue = previousValue.current;

    if (newValue === oldValue) return;

    // Detectar quais dígitos mudaram
    const changedIndices: number[] = [];
    const maxLength = Math.max(newValue.length, oldValue.length);
    
    for (let i = 0; i < maxLength; i++) {
      if (newValue[i] !== oldValue[i]) {
        changedIndices.push(i);
      }
    }

    // Animar apenas os dígitos que mudaram
    setAnimatingIndices(changedIndices);
    setDisplayValue(newValue);
    previousValue.current = newValue;

    // Remover animação após 400ms
    setTimeout(() => {
      setAnimatingIndices([]);
    }, 400);
  }, [value]);

  const formatDisplay = (val: string) => {
    if (!isNaN(Number(val))) {
      if (formatAsCurrency) {
        // Formato de moeda com 2 decimais
        return new Intl.NumberFormat('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(Number(val));
      } else {
        // Formato de número simples com separadores
        return new Intl.NumberFormat('pt-BR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(Number(val));
      }
    }
    return val;
  };

  const formattedValue = formatDisplay(displayValue);
  const chars = formattedValue.split('');

  return (
    <span className={`inline-flex ${className}`}>
      {chars.map((char, index) => {
        const isAnimating = animatingIndices.includes(index);
        return (
          <span
            key={`${index}-${char}`}
            className={`inline-block ${isAnimating ? 'animate-digit-change' : ''}`}
            style={{
              minWidth: char === ',' || char === '.' ? '4px' : '0.6em',
              textAlign: 'center'
            }}
          >
            {char}
          </span>
        );
      })}
      
      <style>{`
        @keyframes digit-change {
          0%, 100% {
            transform: translateY(0) scale(1);
            color: inherit;
          }
          50% {
            transform: translateY(-4px) scale(1.15);
            color: #22c55e;
            text-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
          }
        }

        .animate-digit-change {
          animation: digit-change 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          display: inline-block;
        }
      `}</style>
    </span>
  );
}

