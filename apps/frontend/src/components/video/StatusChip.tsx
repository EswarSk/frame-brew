import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { VideoStatus } from "@/lib/types";
import { 
  Clock, 
  Loader2, 
  Film, 
  Target, 
  CheckCircle, 
  AlertCircle,
  Download,
  Search
} from "lucide-react";

interface StatusChipProps {
  status: VideoStatus;
  className?: string;
}

const statusConfig: Record<VideoStatus, { label: string; variant: 'default' | 'destructive' | 'outline' | 'secondary'; icon: React.ComponentType<{ className?: string }> }> = {
  queued: {
    label: 'Queued',
    variant: 'secondary' as const,
    icon: Clock,
  },
  processing: {
    label: 'Processing',
    variant: 'secondary' as const,
    icon: Loader2,
  },
  running: {
    label: 'Running',
    variant: 'secondary' as const,
    icon: Loader2,
  },
  polling: {
    label: 'Polling',
    variant: 'secondary' as const,
    icon: Search,
  },
  downloading: {
    label: 'Downloading',
    variant: 'secondary' as const,
    icon: Download,
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
  
  // Handle unknown status gracefully
  if (!config) {
    return (
      <Badge 
        variant="outline"
        className={cn("flex items-center gap-1", className)}
      >
        <AlertCircle className="h-3 w-3" />
        {status || 'Unknown'}
      </Badge>
    );
  }
  
  const Icon = config.icon;
  
  return (
    <Badge 
      variant={config.variant}
      className={cn("flex items-center gap-1", className)}
    >
      <Icon className={cn(
        "h-3 w-3",
        (status === 'running' || status === 'processing' || status === 'polling' || status === 'downloading') && "animate-spin"
      )} />
      {config.label}
    </Badge>
  );
}