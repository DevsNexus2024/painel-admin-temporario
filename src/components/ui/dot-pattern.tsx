import { cn } from "@/lib/utils";

interface DotPatternProps extends React.HTMLAttributes<HTMLDivElement> {
    size?: number;
    spacing?: number;
    dotSize?: number;
    dotColor?: string;
}

export function DotPattern({
    className,
    size = 32,
    spacing = 24,
    dotSize = 2,
    dotColor = "currentColor",
    ...props
}: DotPatternProps) {
    return (
        <div
            className={cn(
                "absolute inset-0 -z-10 h-full w-full opacity-40",
                className
            )}
            {...props}
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="100%"
                height="100%"
                className="absolute inset-0"
            >
                <defs>
                    <pattern
                        id="dotPattern"
                        x="0"
                        y="0"
                        width={spacing}
                        height={spacing}
                        patternUnits="userSpaceOnUse"
                    >
                        <circle
                            cx={spacing / 2}
                            cy={spacing / 2}
                            r={dotSize}
                            fill={dotColor}
                            opacity="0.8"
                        />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#dotPattern)" />
            </svg>
        </div>
    );
} 