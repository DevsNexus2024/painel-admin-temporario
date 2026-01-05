import * as React from "react";
import { Calendar, CalendarProps } from "./calendar";
import { buttonVariants } from "./button";
import { cn } from "@/lib/utils";

/**
 * ✅ Componente Day customizado para corrigir problemas de interação em produção
 * 
 * Quando o Calendar está dentro de um Popover dentro de um Dialog, os eventos de click
 * podem ser bloqueados ou não disparar corretamente em produção.
 * 
 * Este componente Day customizado:
 * - Usa onMouseDown com preventDefault/stopPropagation para garantir que o evento seja processado
 * - Força estilos inline críticos (cursor, pointer-events, z-index)
 * - Chama o onClick original após prevenir o comportamento padrão
 */
function CustomDay(props: any) {
  const { date, displayMonth, onClick, ...buttonProps } = props;
  
  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    // CRÍTICO: Prevenir comportamento padrão e parar propagação
    e.preventDefault();
    e.stopPropagation();
    
    // Chamar o onClick original IMEDIATAMENTE
    if (onClick) {
      // Usar requestAnimationFrame para garantir que o evento seja processado
      requestAnimationFrame(() => {
        onClick(e);
      });
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Prevenir comportamento padrão
    e.preventDefault();
    e.stopPropagation();
    
    // Chamar onClick como fallback
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button
      {...buttonProps}
      type="button"
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onTouchStart={(e) => {
        // Suportar touch events para mobile
        e.preventDefault();
        e.stopPropagation();
        if (onClick) {
          onClick(e as any);
        }
      }}
      style={{
        cursor: 'pointer !important',
        pointerEvents: 'auto !important',
        zIndex: 10,
        position: 'relative',
        WebkitTapHighlightColor: 'transparent',
        ...buttonProps.style,
      }}
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
        "hover:bg-accent hover:text-accent-foreground",
        buttonProps.className
      )}
    />
  );
}

/**
 * ✅ CalendarWrapper - Componente wrapper para corrigir problemas de interação em produção
 * 
 * Quando o Calendar está dentro de um Popover dentro de um Dialog, os eventos de click
 * podem ser bloqueados ou não disparar corretamente em produção (minificação, otimizações).
 * 
 * Este wrapper usa um componente Day customizado que força os handlers corretos.
 */
export function CalendarWrapper({ onSelect, selected, ...props }: CalendarProps) {
  return (
    <Calendar
      {...props}
      selected={selected}
      onSelect={onSelect}
      components={{
        Day: CustomDay,
        ...props.components,
      }}
    />
  );
}

