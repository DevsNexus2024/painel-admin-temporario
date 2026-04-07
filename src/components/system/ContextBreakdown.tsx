import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ContextBreakdownProps {
  byContext: Record<string, number>;
}

export default function ContextBreakdown({ byContext }: ContextBreakdownProps) {
  const entries = Object.entries(byContext).sort(([, a], [, b]) => b - a);

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Erros por Contexto</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4 text-center">Sem dados de contexto</p>
        </CardContent>
      </Card>
    );
  }

  const maxCount = entries[0]?.[1] || 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Erros por Contexto</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {entries.map(([context, count]) => {
          const pct = (count / maxCount) * 100;
          return (
            <div key={context} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-mono text-xs text-foreground">{context}</span>
                <span className="font-mono text-xs text-muted-foreground">{count}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
