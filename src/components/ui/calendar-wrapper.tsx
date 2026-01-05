import { useEffect, useRef } from "react";
import { Calendar, CalendarProps } from "./calendar";

/**
 * ✅ CalendarWrapper - Componente wrapper para corrigir problemas de interação em produção
 * 
 * Quando o Calendar está dentro de um Popover dentro de um Dialog, os eventos de click
 * podem ser bloqueados ou não disparar corretamente em produção (minificação, otimizações).
 * 
 * Este wrapper:
 * - Adiciona handlers onMouseDown com preventDefault/stopPropagation
 * - Força estilos inline críticos (cursor, pointer-events, z-index)
 * - Usa MutationObserver para aplicar correções quando novos botões são renderizados
 */
export function CalendarWrapper({ onSelect, selected, ...props }: CalendarProps) {
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!calendarRef.current) return;

    const fixDayButtons = () => {
      // Selecionar todos os botões de dia do calendário
      const dayButtons = calendarRef.current?.querySelectorAll(
        'button[role="gridcell"], button[aria-label], button.day'
      ) || [];
      
      dayButtons.forEach((button) => {
        const btn = button as HTMLButtonElement;
        
        // Pular se já foi processado (evitar duplicação)
        if (btn.dataset.calendarFixed === 'true') return;
        
        // Forçar estilos inline críticos com !important
        btn.style.setProperty('cursor', 'pointer', 'important');
        btn.style.setProperty('pointer-events', 'auto', 'important');
        btn.style.setProperty('z-index', '1', 'important');
        
        // Marcar como processado
        btn.dataset.calendarFixed = 'true';
        
        // Adicionar handler onMouseDown como fallback
        const handleMouseDown = (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Disparar click após um pequeno delay para garantir que o estado seja atualizado
          setTimeout(() => {
            btn.click();
          }, 0);
        };

        // Remover listener anterior se existir (evitar duplicação)
        btn.removeEventListener('mousedown', handleMouseDown);
        btn.addEventListener('mousedown', handleMouseDown, { capture: true });
      });
    };

    // Executar imediatamente
    fixDayButtons();

    // Observer para quando o calendário navegar entre meses (novos botões são renderizados)
    const observer = new MutationObserver(() => {
      fixDayButtons();
    });

    observer.observe(calendarRef.current, { 
      childList: true, 
      subtree: true,
      attributes: false
    });

    return () => {
      observer.disconnect();
    };
  }, [selected]); // Re-executar quando a data selecionada mudar ou quando o componente montar

  return (
    <div ref={calendarRef} style={{ position: 'relative' }}>
      <Calendar
        {...props}
        selected={selected}
        onSelect={onSelect}
      />
    </div>
  );
}

