import React from "react";
import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
    title: string;
    value: string | number;
    change?: {
        value: number;
        type: 'increase' | 'decrease' | 'neutral';
        period?: string;
    };
    icon: LucideIcon;
    gradient?: boolean;
    className?: string;
}

interface DashboardStatsProps {
    stats: StatCardProps[];
    className?: string;
}

export function StatCard({ 
    title, 
    value, 
    change, 
    icon: Icon, 
    gradient = false,
    className 
}: StatCardProps) {
    const getChangeColor = (type: 'increase' | 'decrease' | 'neutral') => {
        switch (type) {
            case 'increase':
                return 'text-green-500';
            case 'decrease':
                return 'text-red-500';
            default:
                return 'text-muted-foreground';
        }
    };

    const getChangeIcon = (type: 'increase' | 'decrease' | 'neutral') => {
        switch (type) {
            case 'increase':
                return '+';
            case 'decrease':
                return '-';
            default:
                return '';
        }
    };

    return (
        <Card className={cn(
            "relative overflow-hidden transition-all duration-300 hover:shadow-lg banking-hover",
            gradient && "bg-gradient-to-br from-card to-muted/50",
            className
        )}>
            <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between space-x-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider truncate">
                            {title}
                        </p>
                        <p className="text-xl font-bold text-foreground mt-1 sm:mt-2 truncate">
                            {value}
                        </p>
                        {change && (
                            <div className="flex items-center mt-2 sm:mt-3">
                                <span className={cn(
                                    "text-xs sm:text-sm font-medium",
                                    getChangeColor(change.type)
                                )}>
                                    {getChangeIcon(change.type)}{Math.abs(change.value)}%
                                </span>
                                <span className="text-xs text-muted-foreground ml-1 sm:ml-2 truncate">
                                    {change.period || 'vs mês anterior'}
                                </span>
                            </div>
                        )}
                    </div>
                    
                    <div className={cn(
                        "flex-shrink-0 p-2 sm:p-3 rounded-lg transition-all duration-200",
                        gradient 
                            ? "bg-primary/10 text-primary" 
                            : "bg-muted/50 text-muted-foreground"
                    )}>
                        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export function DashboardStats({ stats, className }: DashboardStatsProps) {
    return (
        <div className={cn(
            "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6",
            className
        )}>
            {stats.map((stat, index) => (
                <StatCard 
                    key={index} 
                    {...stat} 
                    gradient={index === 0} // Primeiro card com gradiente para destaque
                />
            ))}
        </div>
    );
} 