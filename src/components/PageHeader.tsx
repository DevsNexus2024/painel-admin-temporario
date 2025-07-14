import React from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface BreadcrumbItem {
    label: string;
    href?: string;
    isActive?: boolean;
}

interface PageHeaderProps {
    title: string;
    description?: string;
    breadcrumbs?: BreadcrumbItem[];
    actions?: React.ReactNode;
    className?: string;
}

export function PageHeader({ 
    title, 
    description, 
    breadcrumbs = [], 
    actions,
    className 
}: PageHeaderProps) {
    return (
        <div className={cn(
            "border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
            className
        )}>
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="py-4 sm:py-6">
                    {/* Breadcrumbs */}
                    {breadcrumbs.length > 0 && (
                        <nav className="flex mb-3 sm:mb-4" aria-label="Breadcrumb">
                            <ol className="inline-flex items-center space-x-1 md:space-x-3 flex-wrap">
                                {breadcrumbs.map((item, index) => (
                                    <li key={index} className="inline-flex items-center">
                                        {index > 0 && (
                                            <ChevronRight className="h-3 w-3 text-muted-foreground mx-1" />
                                        )}
                                        {item.href && !item.isActive ? (
                                            <Link
                                                to={item.href}
                                                className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                {item.label}
                                            </Link>
                                        ) : (
                                            <span className={cn(
                                                "text-xs sm:text-sm font-medium",
                                                item.isActive 
                                                    ? "text-foreground" 
                                                    : "text-muted-foreground"
                                            )}>
                                                {item.label}
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        </nav>
                    )}

                    {/* Header Content */}
                    <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                        <div className="min-w-0 flex-1">
                            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground truncate">
                                {title}
                            </h1>
                            {description && (
                                <p className="mt-1 sm:mt-2 text-sm sm:text-base text-muted-foreground line-clamp-2">
                                    {description}
                                </p>
                            )}
                        </div>

                        {/* Actions */}
                        {actions && (
                            <div className="flex-shrink-0">
                                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                                    {actions}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
} 