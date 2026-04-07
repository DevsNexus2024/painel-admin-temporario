import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Database } from 'lucide-react';

interface HealthStatusCardProps {
  title: string;
  type: 'api' | 'database';
  status: 'ok' | 'fail' | 'loading';
  details?: Record<string, 'ok' | 'fail'>;
}

export default function HealthStatusCard({ title, type, status, details }: HealthStatusCardProps) {
  const isOk = status === 'ok';
  const isLoading = status === 'loading';
  const Icon = type === 'api' ? Activity : Database;

  return (
    <Card className={`border ${isLoading ? 'border-muted' : isOk ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`rounded-lg p-2.5 ${isLoading ? 'bg-muted' : isOk ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
          <Icon className={`h-5 w-5 ${isLoading ? 'text-muted-foreground animate-pulse' : isOk ? 'text-emerald-500' : 'text-red-500'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {details && (
            <div className="flex gap-2 mt-1">
              {Object.entries(details).map(([check, val]) => (
                <span key={check} className="text-xs text-muted-foreground">
                  {check}: {val === 'ok' ? 'ok' : 'fail'}
                </span>
              ))}
            </div>
          )}
        </div>
        <Badge
          variant={isLoading ? 'secondary' : isOk ? 'default' : 'destructive'}
          className={isOk && !isLoading ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/15' : ''}
        >
          {isLoading ? 'Verificando...' : isOk ? 'Operacional' : 'Indisponivel'}
        </Badge>
      </CardContent>
    </Card>
  );
}
