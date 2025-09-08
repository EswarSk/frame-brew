import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Video, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  TrendingUp,
  Play,
  Upload,
  Sparkles
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useUIStore } from "@/lib/stores";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";

export default function Dashboard() {
  const { setGenerateDialogOpen, setUploadDrawerOpen } = useUIStore();
  const navigate = useNavigate();

  const { data: videos = [] } = useQuery({
    queryKey: ['videos'],
    queryFn: () => api.getVideos({}),
    select: (data) => data.items,
  });

  const stats = {
    total: videos.length,
    ready: videos.filter(v => v.status === 'ready').length,
    processing: videos.filter(v => ['queued', 'running', 'transcoding', 'scoring'].includes(v.status)).length,
    failed: videos.filter(v => v.status === 'failed').length,
    avgScore: videos.filter(v => v.score).reduce((acc, v) => acc + (v.score?.overall || 0), 0) / videos.filter(v => v.score).length || 0,
  };

  const recentVideos = videos
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back! Here's what's happening with your videos.
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={() => setGenerateDialogOpen(true)}>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate
            </Button>
            <Button variant="outline" onClick={() => setUploadDrawerOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Videos</CardTitle>
              <Video className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                All time
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ready</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.ready}</div>
              <p className="text-xs text-muted-foreground">
                Available for download
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Processing</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.processing}</div>
              <p className="text-xs text-muted-foreground">
                In progress
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(stats.avgScore) || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Out of 100
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Videos */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Videos</CardTitle>
              <Button variant="outline" onClick={() => navigate('/library')}>
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentVideos.length === 0 ? (
              <div className="text-center py-8">
                <Video className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No videos yet</h3>
                <p className="text-muted-foreground">
                  Get started by generating or uploading your first video.
                </p>
                <div className="flex gap-2 justify-center mt-4">
                  <Button onClick={() => setGenerateDialogOpen(true)}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Video
                  </Button>
                  <Button variant="outline" onClick={() => setUploadDrawerOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Video
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {recentVideos.map((video) => (
                  <div
                    key={video.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/videos/${video.id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
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
                      
                      <div>
                        <h4 className="font-medium">{video.title}</h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant={
                            video.status === 'ready' ? 'default' :
                            video.status === 'failed' ? 'destructive' :
                            'secondary'
                          }>
                            {video.status}
                          </Badge>
                          <span>{video.durationSec}s</span>
                          {video.score && (
                            <span>Score: {video.score.overall}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {new Date(video.createdAt).toLocaleDateString()}
                      </p>
                      {video.status !== 'ready' && video.status !== 'failed' && (
                        <Progress value={50} className="w-24 mt-1" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}