import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Loader2, Wifi, WifiOff, CheckCircle, AlertCircle, Banknote } from "lucide-react";
import AnimatedBalance from "@/components/AnimatedBalance";
import { ProviderTheme, providerCssVars } from "@/config/provider-theme";

export interface BalanceCardSpec {
  label: string;
  icon: React.ReactNode;
  /** Valor em reais (string numérica, ex. "1234.56"). */
  value: string;
  /** Cor SEMÂNTICA do valor (verde=disponível, azul=total, vermelho=bloqueado...) — não é a cor do provider. */
  color: string;
}

interface ProviderTopBarProps {
  theme: ProviderTheme;
  title: string;
  subtitle: string;
  isConnected?: boolean;
  isReconnecting?: boolean;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  cards: BalanceCardSpec[];
}

// Tailwind não compila classe montada em runtime — grade mapeada estática por contagem
const GRID_BY_COUNT: Record<number, string> = {
  1: "grid grid-cols-1 gap-3 lg:gap-4",
  2: "grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4",
  3: "grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4",
  4: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4",
  5: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4",
};

/**
 * TopBar padrão das telas de provider: header sticky (ícone no accent do provider,
 * título, badge, status, refresh) + cards de saldo com cor semântica por card.
 */
export default function ProviderTopBar({
  theme,
  title,
  subtitle,
  isConnected = false,
  isReconnecting = false,
  loading,
  error,
  onRefresh,
  cards,
}: ProviderTopBarProps) {
  const parseValue = (value: string): number => {
    const numValue = parseFloat(value);
    return isNaN(numValue) ? 0 : numValue;
  };

  const getStatusIcon = () => {
    if (loading) {
      return <Loader2 className="h-4 w-4 animate-spin" style={{ color: theme.accent }} />;
    }
    if (error) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  return (
    <div className="sticky top-0 z-30 bg-background border-b border-border h-auto p-6" style={providerCssVars(theme)}>
      {/* Header principal */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl shadow-xl" style={{ backgroundColor: theme.accent }}>
            <Banknote className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <Banknote className="h-5 w-5" style={{ color: theme.accent }} />
              <h1 className="text-2xl font-bold text-foreground">{title}</h1>
              <Badge
                className="text-xs font-medium border"
                style={{ backgroundColor: theme.accentSoft, color: theme.accent, borderColor: theme.accentBorder }}
              >
                {theme.badge}
              </Badge>
              {getStatusIcon()}
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded-md">
                    <Wifi className="h-3 w-3" />
                    <span className="text-xs font-medium">Tempo Real</span>
                  </div>
                ) : isReconnecting ? (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-md animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-xs font-medium">Reconectando...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 text-gray-600 border border-gray-200 rounded-md">
                    <WifiOff className="h-3 w-3" />
                    <span className="text-xs font-medium">Offline</span>
                  </div>
                )}
              </div>
            </div>
            <p className="text-muted-foreground text-sm">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="hover:bg-muted rounded-xl"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <RefreshCcw className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="ml-2 text-sm">Atualizar</span>
          </Button>
        </div>
      </div>

      {/* Cards de saldo */}
      <div className={GRID_BY_COUNT[cards.length] || GRID_BY_COUNT[3]}>
        {cards.map((card) => (
          <div
            key={card.label}
            className="p-4 lg:p-5 rounded-lg bg-background border border-[rgba(255,255,255,0.1)] hover:opacity-90 transition-all duration-200 group"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="group-hover:opacity-80 transition-opacity" style={{ color: card.color }}>
                {card.icon}
              </span>
              <span className="text-[0.9rem] text-[rgba(255,255,255,0.66)]">{card.label}</span>
            </div>
            <div className="text-[1.3rem] lg:text-[1.5rem] font-bold mt-1 overflow-hidden" style={{ color: card.color }}>
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : error ? (
                <span className="text-lg text-red-500">Erro</span>
              ) : (
                <div className="whitespace-nowrap">R$ <AnimatedBalance value={parseValue(card.value)} /></div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
