import { Card, CardContent } from '@/components/ui/card';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';

type ThresholdLevel = 'green' | 'yellow' | 'red';

interface MetricCardProps {
  label: string;
  value: number | string;
  unit?: string;
  history: number[];
  thresholdLevel?: ThresholdLevel;
}

const LEVEL_COLORS: Record<ThresholdLevel, { text: string; stroke: string; fill: string }> = {
  green: { text: 'text-emerald-500', stroke: '#10b981', fill: '#10b98120' },
  yellow: { text: 'text-yellow-500', stroke: '#eab308', fill: '#eab30820' },
  red: { text: 'text-red-500', stroke: '#ef4444', fill: '#ef444420' },
};

export function getThresholdLevel(
  value: number,
  thresholds: { green: number; yellow: number },
): ThresholdLevel {
  if (value < thresholds.green) return 'green';
  if (value < thresholds.yellow) return 'yellow';
  return 'red';
}

export default function MetricCard({
  label,
  value,
  unit = '',
  history,
  thresholdLevel = 'green',
}: MetricCardProps) {
  const colors = LEVEL_COLORS[thresholdLevel];
  const chartData = history.map((v, i) => ({ i, v }));

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-bold tabular-nums ${colors.text}`}>
          {typeof value === 'number' ? value.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : value}
          {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
        </p>
        {chartData.length > 1 && (
          <div className="h-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <YAxis domain={['dataMin', 'dataMax']} hide />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={colors.stroke}
                  fill={colors.fill}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
