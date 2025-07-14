import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/utils/date";

interface FinancialSummaryCardProps {
    title: string;
    value: string | number;
    description?: string;
    icon: React.ReactNode;
    trend?: {
        value: number;
        isPositive: boolean;
    };
}

export function FinancialSummaryCard({
    title,
    value,
    description,
    icon,
    trend,
}: FinancialSummaryCardProps) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <div className="h-5 w-5 text-muted-foreground">{icon}</div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {description && (
                    <p className="text-xs text-muted-foreground">{description}</p>
                )}
                {trend && (
                    <div className="flex items-center pt-1">
                        <span
                            className={`text-xs ${trend.isPositive ? "text-green-500" : "text-red-500"
                                }`}
                        >
                            {trend.isPositive ? "+" : "-"}
                            {trend.value}%
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">
                            em relação ao período anterior
                        </span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
} 