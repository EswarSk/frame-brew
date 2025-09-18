import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusChip } from "@/components/video/StatusChip";
import { ScoreDial } from "@/components/video/ScoreDial";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { VideoUrls } from "@/lib/types";
import { 
  ArrowLeft, 
  Download, 
  Repeat, 
  RotateCcw, 
  Copy, 
  Trash2, 
  Play, 
  Pause,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Maximize,
  ExternalLink
} from "lucide-react";
import { useState, useRef } from "react";

export default function VideoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(true);

  // Helper function to validate URL
  const isValidUrl = (url: string | undefined | null): boolean => {
    if (!url || typeof url !== 'string' || url.trim() === '') return false;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Helper function to get the best available video URL
  const getVideoUrl = (urls: VideoUrls | string | undefined | null): string | null => {
    // If it's already a string URL, validate and return it
    if (typeof urls === 'string') {
      return isValidUrl(urls) ? urls : null;
    }

    // If it's an object, parse through the fields
    if (!urls || typeof urls !== 'object') return null;

    // Try different URL fields in order of preference
    const urlFields = ['mp4', 'original', 'webm', 'hls'];

    for (const field of urlFields) {
      const url = urls[field];
      if (isValidUrl(url)) {
        return url;
      }
    }

    return null;
  };

  // Helper function to get thumbnail URL
  const getThumbnailUrl = (urls: VideoUrls | undefined | null): string | null => {
    if (!urls || typeof urls !== 'object') return null;

    // Try both thumbnail field names
    const thumbnailFields = ['thumbnail', 'thumb'];

    for (const field of thumbnailFields) {
      const url = urls[field];
      if (isValidUrl(url)) {
        return url;
      }
    }

    return null;
  };

  const { data: videoData, isLoading } = useQuery({
    queryKey: ['video', id],
    queryFn: () => api.getVideo(id!),
    enabled: !!id,
  });

  const rescoreMutation = useMutation({
    mutationFn: () => api.rescoreVideo(id!),
    onSuccess: () => {
      toast({
        title: "Re-scoring started",
        description: "The video is being re-scored. Check back in a moment.",
      });
      queryClient.invalidateQueries({ queryKey: ['video', id] });
    },
  });

  const rerenderMutation = useMutation({
    mutationFn: () => api.rerenderVideo(id!),
    onSuccess: () => {
      toast({
        title: "Re-render started",
        description: "A new version is being generated.",
      });
      queryClient.invalidateQueries({ queryKey: ['video', id] });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: () => api.duplicateAsTemplate(id!),
    onSuccess: () => {
      toast({
        title: "Template created",
        description: "Video has been saved as a template.",
      });
      navigate("/templates");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteVideo(id!),
    onSuccess: () => {
      toast({
        title: "Video deleted",
        description: "The video has been permanently deleted.",
      });
      navigate("/library");
    },
  });

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Download started",
      description: `${filename} is being downloaded.`,
    });
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setVideoLoading(false);
      setVideoError(null);
    }
  };

  const handleVideoError = () => {
    setVideoLoading(false);
    setVideoError("Failed to load video. The video file may be unavailable or corrupted.");
    setIsPlaying(false);
  };

  const handleVideoLoadStart = () => {
    setVideoLoading(true);
    setVideoError(null);
  };

  const seekTo = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-96 bg-muted rounded"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!videoData) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Video not found</h2>
          <p className="text-muted-foreground mt-2">
            The video you're looking for doesn't exist or has been deleted.
          </p>
          <Button onClick={() => navigate("/library")} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Library
          </Button>
        </div>
      </AppLayout>
    );
  }

  const { video, versions } = videoData;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/library")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{video.title}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <StatusChip status={video.status} />
                <span>•</span>
                <span>{video.durationSec}s</span>
                <span>•</span>
                <span>v{video.version}</span>
                <span>•</span>
                <span>{new Date(video.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {video.status === 'ready' && (
              <>
                {(() => {
                  const videoUrl = getVideoUrl(video.urls?.original);
                  return videoUrl ? (
                    <Button
                      variant="outline"
                      onClick={() => handleDownload(videoUrl, `${video.title}.mp4`)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download Video
                    </Button>
                  ) : null;
                })()}
                {video.urls?.captions && (
                  <Button
                    variant="outline"
                    onClick={() => video.urls?.captions && handleDownload(video.urls.captions, `${video.title}.vtt`)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Captions
                  </Button>
                )}
              </>
            )}
            
            <Button
              variant="outline"
              onClick={() => rescoreMutation.mutate()}
              disabled={rescoreMutation.isPending}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Re-score
            </Button>
            
            <Button
              variant="outline"
              onClick={() => rerenderMutation.mutate()}
              disabled={rerenderMutation.isPending}
            >
              <Repeat className="mr-2 h-4 w-4" />
              Re-render
            </Button>
            
            <Button
              variant="outline"
              onClick={() => duplicateMutation.mutate()}
              disabled={duplicateMutation.isPending}
            >
              <Copy className="mr-2 h-4 w-4" />
              Save as Template
            </Button>
            
            <Button
              variant="outline"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Player */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardContent className="p-0">
                <div className="relative bg-black rounded-lg overflow-hidden aspect-[9/16] max-h-[600px] mx-auto">
                  {(() => {
                    const videoUrl = getVideoUrl(video.urls?.original);
                    const thumbnailUrl = getThumbnailUrl(video.urls);

                    if (video.status === 'ready' && videoUrl) {
                      return (
                        <>
                          <video
                            ref={videoRef}
                            className="w-full h-full object-contain"
                            src={videoUrl}
                            onTimeUpdate={handleTimeUpdate}
                            onLoadedMetadata={handleLoadedMetadata}
                            onLoadStart={handleVideoLoadStart}
                            onError={handleVideoError}
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                            poster={thumbnailUrl || undefined}
                          />

                          {/* Loading overlay */}
                          {videoLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                              <div className="text-white text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                                <p>Loading video...</p>
                              </div>
                            </div>
                          )}

                          {/* Error overlay */}
                          {videoError && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                              <div className="text-white text-center p-4">
                                <ExternalLink className="mx-auto h-12 w-12 mb-4 opacity-50" />
                                <p className="text-lg mb-2">Video Error</p>
                                <p className="text-sm opacity-75 max-w-sm">{videoError}</p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="mt-4 text-white border-white hover:bg-white hover:text-black"
                                  onClick={() => {
                                    setVideoError(null);
                                    if (videoRef.current) {
                                      videoRef.current.load();
                                    }
                                  }}
                                >
                                  Retry
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Video Controls */}
                          {!videoLoading && !videoError && (
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                        <div className="space-y-2">
                          {/* Progress Bar */}
                          <div 
                            className="w-full h-1 bg-white/20 rounded-full cursor-pointer"
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const pos = (e.clientX - rect.left) / rect.width;
                              seekTo(pos * duration);
                            }}
                          >
                            <div 
                              className="h-full bg-white rounded-full transition-all"
                              style={{ width: `${(currentTime / duration) * 100}%` }}
                            />
                          </div>
                          
                          {/* Controls */}
                          <div className="flex items-center justify-between text-white">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => seekTo(Math.max(0, currentTime - 5))}
                                className="text-white hover:bg-white/20"
                              >
                                <SkipBack className="h-4 w-4" />
                              </Button>
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={togglePlay}
                                className="text-white hover:bg-white/20"
                              >
                                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                              </Button>
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => seekTo(Math.min(duration, currentTime + 5))}
                                className="text-white hover:bg-white/20"
                              >
                                <SkipForward className="h-4 w-4" />
                              </Button>
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={toggleMute}
                                className="text-white hover:bg-white/20"
                              >
                                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                              </Button>
                              
                              <span className="text-sm">
                                {formatTime(currentTime)} / {formatTime(duration)}
                              </span>
                            </div>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (videoRef.current) {
                                  if (videoRef.current.requestFullscreen) {
                                    videoRef.current.requestFullscreen();
                                  }
                                }
                              }}
                              className="text-white hover:bg-white/20"
                            >
                              <Maximize className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                            </div>
                          )}
                        </>
                      );
                    } else {
                      return (
                        <div className="flex items-center justify-center h-full text-white">
                          <div className="text-center">
                            <Play className="mx-auto h-12 w-12 mb-4 opacity-50" />
                            <p className="text-lg">
                              {video.status === 'ready' ? 'No video available' : 'Video processing...'}
                            </p>
                            {video.status !== 'ready' && video.status !== 'failed' && (
                              <Progress value={50} className="w-32 mx-auto mt-4" />
                            )}
                          </div>
                        </div>
                      );
                    }
                  })()}
                </div>
              </CardContent>
            </Card>

            {/* Thumbnail Strip */}
            {(() => {
              const thumbnailUrl = getThumbnailUrl(video.urls);
              return thumbnailUrl ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Thumbnail</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <img
                      src={thumbnailUrl}
                      alt="Video thumbnail"
                      className="rounded-lg w-full max-w-xs"
                    />
                  </CardContent>
                </Card>
              ) : null;
            })()}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Score Card */}
            {video.score && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Quality Score
                    <ScoreDial value={video.score.overall} size="lg" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries({
                      Hook: video.score.hook,
                      Pacing: video.score.pacing,
                      Clarity: video.score.clarity,
                      'Brand Safety': video.score.brandSafety,
                      'Duration Fit': video.score.durationFit,
                      'Visual Quality': video.score.visualQoe,
                      'Audio Quality': video.score.audioQoe,
                    }).map(([label, value]) => (
                      <div key={label} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{label}</span>
                          <span className="font-medium">{value}</span>
                        </div>
                        <Progress value={value} className="h-2" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Video Info */}
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Source</h4>
                  <Badge variant={video.sourceType === 'generated' ? 'default' : 'secondary'}>
                    {video.sourceType}
                  </Badge>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium mb-2">Project</h4>
                  <p className="text-sm text-muted-foreground">{video.projectId}</p>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium mb-2">Created</h4>
                  <p className="text-sm text-muted-foreground">
                    {new Date(video.createdAt).toLocaleString()}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Updated</h4>
                  <p className="text-sm text-muted-foreground">
                    {new Date(video.updatedAt).toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Versions */}
            {versions && versions.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Versions ({versions.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {versions.map((version) => (
                        <div
                          key={version.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            version.id === video.id 
                              ? 'bg-primary/10 border-primary' 
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => navigate(`/videos/${version.id}`)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">v{version.version}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(version.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <StatusChip status={version.status} />
                              {version.score && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  Score: {version.score.overall}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Tabs Section */}
        <Tabs defaultValue="feedback" className="w-full">
          <TabsList>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
            <TabsTrigger value="prompt">Prompt & Parameters</TabsTrigger>
            <TabsTrigger value="assets">Assets</TabsTrigger>
          </TabsList>
          
          <TabsContent value="feedback" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Feedback</CardTitle>
              </CardHeader>
              <CardContent>
                {video.feedbackSummary ? (
                  <div className="prose prose-sm max-w-none">
                    <p>{video.feedbackSummary}</p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No feedback available yet.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="prompt" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Generation Parameters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Prompt</h4>
                    <p className="text-sm bg-muted p-3 rounded-lg">
                      {video.sourceType === 'generated' 
                        ? "A stunning cinematic video showcasing the beauty of nature..." 
                        : "Uploaded video file"}
                    </p>
                  </div>
                  
                  {video.sourceType === 'generated' && (
                    <>
                      <div>
                        <h4 className="font-medium mb-2">Style Preset</h4>
                        <Badge>Cinematic</Badge>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-2">Settings</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>Duration: {video.durationSec}s</div>
                          <div>Aspect: 9:16</div>
                          <div>Captions: Enabled</div>
                          <div>Watermark: Disabled</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="assets" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Available Assets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(() => {
                    const videoUrl = getVideoUrl(video.urls?.original);
                    return videoUrl ? (
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <ExternalLink className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium">Video File</p>
                            <p className="text-sm text-muted-foreground">High quality download</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(videoUrl, `${video.title}.mp4`)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Button>
                      </div>
                    ) : null;
                  })()}
                  
                  {video.urls?.captions && (
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <ExternalLink className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">Captions (VTT)</p>
                          <p className="text-sm text-muted-foreground">Subtitle file</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => video.urls?.captions && handleDownload(video.urls.captions, `${video.title}.vtt`)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                    </div>
                  )}
                  
                  {(() => {
                    const thumbnailUrl = getThumbnailUrl(video.urls);
                    return thumbnailUrl ? (
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <ExternalLink className="h-4 w-4 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-medium">Thumbnail</p>
                            <p className="text-sm text-muted-foreground">Preview image</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(thumbnailUrl, `${video.title}_thumb.jpg`)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Button>
                      </div>
                    ) : null;
                  })()}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}