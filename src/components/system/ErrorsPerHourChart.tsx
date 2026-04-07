import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface ErrorsPerHourChartProps {
  perHour: Record<string, number>;
}

export default function ErrorsPerHourChart({ perHour }: ErrorsPerHourChartProps) {
  const data = Object.entries(perHour)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, count]) => ({
      hour: hour.slice(11, 16), // "2026-04-07T10:00" -> "10:00"
      count,
    }));

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Erros por Hora (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4 text-center">Sem dados de erros por hora</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Erros por Hora (24h)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                labelFormatter={(label) => `Hora: ${label}`}
                formatter={(value: number) => [value, 'Erros']}
              />
              <Bar dataKey="count" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
