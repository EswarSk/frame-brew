import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Grid3X3, 
  List, 
  Kanban, 
  Filter,
  Download,
  Trash2,
  MoreHorizontal,
  Play,
  Search,
  SortAsc
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useFilterStore, useSelectionStore } from "@/lib/stores";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatusChip } from "@/components/video/StatusChip";
import { ScoreDial } from "@/components/video/ScoreDial";
import { Video } from "@/lib/types";

export default function Library() {
  const navigate = useNavigate();
  const { 
    viewMode, 
    setViewMode, 
    query, 
    setQuery,
    status,
    setStatus,
    sortBy,
    setSortBy,
    minScore,
    setMinScore,
    sourceType,
    setSourceType,
    projectId,
    setProjectId,
    resetFilters
  } = useFilterStore();
  
  const { 
    selectedVideoIds, 
    toggleSelection, 
    clearSelection,
    selectAll 
  } = useSelectionStore();

  const [showFilters, setShowFilters] = useState(false);

  const { data: videosResponse, isLoading } = useQuery({
    queryKey: ['videos', { query, status, minScore, sortBy, sourceType, projectId }],
    queryFn: () => api.getVideos({ 
      query: query || undefined,
      status: status.length > 0 ? status : undefined,
      minScore: minScore > 0 ? minScore : undefined,
      sourceType: sourceType || undefined,
      projectId: projectId || undefined,
      sortBy: sortBy || undefined,
    }),
  });

  const videos = videosResponse?.items || [];
  const hasSelection = selectedVideoIds.size > 0;

  const handleSelectAll = () => {
    if (hasSelection) {
      clearSelection();
    } else {
      selectAll(videos.map(v => v.id));
    }
  };

  const renderVideoCard = (video: Video) => (
    <Card 
      key={video.id}
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate(`/videos/${video.id}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={selectedVideoIds.has(video.id)}
            onCheckedChange={(checked) => {
              if (checked) toggleSelection(video.id);
            }}
            onClick={(e) => e.stopPropagation()}
          />
          
          <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center shrink-0">
            {video.urls.thumb ? (
              <img
                src={video.urls.thumb}
                alt={video.title}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <Play className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{video.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <StatusChip status={video.status} />
              <Badge variant="outline">{video.durationSec}s</Badge>
              {video.score && (
                <div className="flex items-center gap-1">
                  <ScoreDial value={video.score.overall} size="sm" />
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {new Date(video.createdAt).toLocaleDateString()}
            </p>
          </div>
          
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderGridView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {videos.map(renderVideoCard)}
    </div>
  );

  const renderListView = () => (
    <div className="space-y-2">
      {videos.map(renderVideoCard)}
    </div>
  );

  const renderKanbanView = () => {
    const columns = [
      { status: 'queued', title: 'Queued' },
      { status: 'running', title: 'Processing' },
      { status: 'transcoding', title: 'Transcoding' },
      { status: 'scoring', title: 'Scoring' },
      { status: 'ready', title: 'Ready' },
      { status: 'failed', title: 'Failed' },
    ];

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {columns.map((column) => {
          const columnVideos = videos.filter(v => v.status === column.status);
          
          return (
            <div key={column.status} className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-sm">{column.title}</h3>
                <Badge variant="secondary" className="text-xs">{columnVideos.length}</Badge>
              </div>
              
              <div className="space-y-2">
                {columnVideos.map(renderVideoCard)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Library</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-muted-foreground text-sm">
                {videos.length} videos • {selectedVideoIds.size} selected
              </p>
              {/* Active Filter Badges */}
              {sourceType && (
                <Badge variant="secondary" className="text-xs">
                  {sourceType}
                </Badge>
              )}
              {status.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  Status: {status.join(', ')}
                </Badge>
              )}
              {projectId && (
                <Badge variant="secondary" className="text-xs">
                  Project: {projectId}
                </Badge>
              )}
              {minScore > 0 && (
                <Badge variant="secondary" className="text-xs">
                  Score: {minScore}+
                </Badge>
              )}
              {query && (
                <Badge variant="secondary" className="text-xs">
                  "{query}"
                </Badge>
              )}
            </div>
          </div>
          
          {hasSelection && (
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                <Download className="mr-2 h-4 w-4" />
                Download ({selectedVideoIds.size})
              </Button>
              <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          )}
        </div>

        {/* Filters & Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex-1 sm:flex-none"
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="score-high">Highest Score</SelectItem>
                <SelectItem value="score-low">Lowest Score</SelectItem>
                <SelectItem value="title-az">Title A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-1 w-full sm:w-auto sm:ml-auto">
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('list')}
              className="flex-1 sm:flex-none"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('grid')}
              className="flex-1 sm:flex-none"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('kanban')}
              className="flex-1 sm:flex-none"
            >
              <Kanban className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Search</label>
                  <Input
                    placeholder="Search videos..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">Min Score</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={minScore || ''}
                    onChange={(e) => setMinScore(Number(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
                
                <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
                  <Button
                    variant="outline"
                    onClick={resetFilters}
                    className="w-full"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Selection Controls */}
        {videos.length > 0 && (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={hasSelection}
              onCheckedChange={handleSelectAll}
            />
            <span className="text-sm text-muted-foreground">
              Select all visible videos
            </span>
          </div>
        )}

        {/* Videos */}
        {isLoading ? (
          <div className="text-center py-8">
            <p>Loading videos...</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-8">
            <Play className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No videos found</h3>
            <p className="text-muted-foreground">
              Try adjusting your filters or create your first video.
            </p>
          </div>
        ) : (
          <div>
            {viewMode === 'grid' && renderGridView()}
            {viewMode === 'list' && renderListView()}
            {viewMode === 'kanban' && renderKanbanView()}
          </div>
        )}
      </div>
    </AppLayout>
  );
}