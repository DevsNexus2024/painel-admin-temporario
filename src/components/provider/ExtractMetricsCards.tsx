import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export interface MetricSpec {
  label: string;
  /** Contagem opcional exibida grande; sem ela o amount vira o número grande. */
  count?: number;
  amount: string; // já formatado (R$ ...)
  /** 'accent' usa a cor do provider (var), 'success' verde. */
  tone?: 'accent' | 'success';
}

/**
 * Cards de métricas do extrato (padrão das telas de provider).
 * Requer wrapper com providerCssVars() no ancestral (consome var(--provider-*)).
 */
export default function ExtractMetricsCards({ metrics, loading }: { metrics: MetricSpec[]; loading: boolean }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      {metrics.map((m) => {
        const toneClass = m.tone === 'success' ? 'text-green-500' : 'text-[color:var(--provider-accent)]';
        return (
          <Card key={m.label} className="p-4 bg-background border border-[color:var(--provider-border)]">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{m.label}</p>
              {loading ? (
                <Loader2 className={`h-5 w-5 animate-spin ${toneClass}`} />
              ) : m.count !== undefined ? (
                <>
                  <p className={`text-2xl font-bold ${toneClass}`}>{m.count}</p>
                  <p className="text-sm text-muted-foreground">{m.amount}</p>
                </>
              ) : (
                <p className={`text-2xl font-bold ${toneClass}`}>{m.amount}</p>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
