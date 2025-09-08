import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  MoreHorizontal, 
  Play, 
  Download, 
  Trash2, 
  Copy,
  ExternalLink
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusChip } from "./StatusChip";
import { ScoreDial } from "./ScoreDial";
import { Video } from "@/lib/types";
import { useSelectionStore } from "@/lib/stores";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface VideoCardProps {
  video: Video;
  onDelete?: (id: string) => void;
  onDownload?: (id: string) => void;
}

export function VideoCard({ video, onDelete, onDownload }: VideoCardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedVideoIds, toggleSelection } = useSelectionStore();
  
  const isSelected = selectedVideoIds.has(video.id);

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements
    if ((e.target as HTMLElement).closest('button, input, [role="button"]')) {
      return;
    }
    navigate(`/videos/${video.id}`);
  };

  const handleDownload = () => {
    if (video.urls.mp4) {
      const link = document.createElement('a');
      link.href = video.urls.mp4;
      link.download = `${video.title}.mp4`;
      link.click();
    }
    toast({
      title: "Download started",
      description: `Downloading ${video.title}`,
    });
    onDownload?.(video.id);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/videos/${video.id}`);
    toast({
      title: "Link copied",
      description: "Video link copied to clipboard",
    });
  };

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-all duration-200 group"
      onClick={handleCardClick}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header with selection and actions */}
          <div className="flex items-center justify-between">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => toggleSelection(video.id)}
              onClick={(e) => e.stopPropagation()}
            />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/videos/${video.id}`)}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open
                </DropdownMenuItem>
                {video.status === 'ready' && (
                  <DropdownMenuItem onClick={handleDownload}>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleCopyLink}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Link
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => onDelete?.(video.id)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Thumbnail */}
          <div className="aspect-[9/16] bg-muted rounded-lg flex items-center justify-center overflow-hidden">
            {video.urls.thumb ? (
              <img
                src={video.urls.thumb}
                alt={video.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <Play className="h-8 w-8 text-muted-foreground" />
            )}
          </div>

          {/* Content */}
          <div className="space-y-2">
            <h3 className="font-medium truncate" title={video.title}>
              {video.title}
            </h3>
            
            <div className="flex items-center gap-2 flex-wrap">
              <StatusChip status={video.status} />
              <Badge variant="outline">{video.durationSec}s</Badge>
              <Badge variant="outline" className="capitalize">
                {video.sourceType}
              </Badge>
            </div>

            {video.score && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Score</span>
                <ScoreDial value={video.score.overall} size="sm" showLabel={false} />
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Created {new Date(video.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}