import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TopErrorsListProps {
  errors: Array<{ message: string; count: number }>;
}

export default function TopErrorsList({ errors }: TopErrorsListProps) {
  if (errors.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Top 5 Erros Mais Frequentes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum erro registrado</p>
        </CardContent>
      </Card>
    );
  }

  const maxCount = errors[0]?.count || 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Top 5 Erros Mais Frequentes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {errors.map((err, i) => {
          const pct = (err.count / maxCount) * 100;
          return (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate max-w-[70%] text-foreground" title={err.message}>
                  {i + 1}. {err.message}
                </span>
                <span className="font-mono text-xs text-muted-foreground whitespace-nowrap ml-2">
                  {err.count}x
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all"
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
