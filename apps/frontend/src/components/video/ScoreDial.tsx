import { cn } from "@/lib/utils";

interface ScoreDialProps {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function ScoreDial({ 
  value, 
  size = 'md', 
  showLabel = true, 
  className 
}: ScoreDialProps) {
  const radius = size === 'sm' ? 12 : size === 'md' ? 16 : 20;
  const strokeWidth = size === 'sm' ? 2 : size === 'md' ? 3 : 4;
  const normalizedRadius = radius - strokeWidth * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDasharray = `${circumference} ${circumference}`;
  const strokeDashoffset = circumference - (value / 100) * circumference;
  
  const getColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8', 
    lg: 'h-12 w-12',
  };

  const textSize = {
    sm: 'text-[8px]',
    md: 'text-[10px]',
    lg: 'text-xs',
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative">
        <svg
          className={cn(sizeClasses[size], "transform -rotate-90")}
          width={radius * 2}
          height={radius * 2}
        >
          {/* Background circle */}
          <circle
            stroke="currentColor"
            className="text-muted-foreground/20"
            fill="transparent"
            strokeWidth={strokeWidth}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          {/* Progress circle */}
          <circle
            stroke="currentColor"
            className={getColor(value)}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            style={{ strokeDashoffset }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>
        
        {/* Score text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn(
            "font-medium",
            textSize[size],
            getColor(value)
          )}>
            {Math.round(value)}
          </span>
        </div>
      </div>
      
      {showLabel && size !== 'sm' && (
        <span className="text-sm font-medium">
          {Math.round(value)}/100
        </span>
      )}
    </div>
  );
}