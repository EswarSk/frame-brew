import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Status } from "@/lib/types";
import { 
  Clock, 
  Loader2, 
  Film, 
  Target, 
  CheckCircle, 
  AlertCircle 
} from "lucide-react";

interface StatusChipProps {
  status: Status;
  className?: string;
}

const statusConfig = {
  queued: {
    label: 'Queued',
    variant: 'secondary' as const,
    icon: Clock,
  },
  running: {
    label: 'Processing',
    variant: 'secondary' as const,
    icon: Loader2,
  },
  transcoding: {
    label: 'Transcoding',
    variant: 'secondary' as const,
    icon: Film,
  },
  scoring: {
    label: 'Scoring',
    variant: 'secondary' as const,
    icon: Target,
  },
  ready: {
    label: 'Ready',
    variant: 'default' as const,
    icon: CheckCircle,
  },
  failed: {
    label: 'Failed',
    variant: 'destructive' as const,
    icon: AlertCircle,
  },
};

export function StatusChip({ status, className }: StatusChipProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  
  return (
    <Badge 
      variant={config.variant}
      className={cn("flex items-center gap-1", className)}
    >
      <Icon className={cn(
        "h-3 w-3",
        status === 'running' && "animate-spin"
      )} />
      {config.label}
    </Badge>
  );
}