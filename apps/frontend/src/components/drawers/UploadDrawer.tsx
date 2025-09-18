import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useUIStore } from "@/lib/stores";
import { api } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  FileVideo,
  Loader2,
  RefreshCw
} from "lucide-react";

const uploadSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
});

type UploadFormData = z.infer<typeof uploadSchema>;

interface FileWithValidation {
  file: File;
  id: string;
  status: 'pending' | 'validating' | 'valid' | 'invalid' | 'uploading' | 'complete';
  error?: string;
  duration?: number;
  progress?: number;
}

export function UploadDrawer() {
  const { uploadDrawerOpen, setUploadDrawerOpen } = useUIStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<FileWithValidation[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Load projects from API
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: api.getProjects,
  });

  const form = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      projectId: "",
    },
  });

  // Real file validation
  const validateFile = useCallback((file: File): Promise<{ valid: boolean; duration?: number; error?: string }> => {
    return new Promise((resolve) => {
      // Basic validation checks
      const isVideo = file.type.startsWith('video/');
      const sizeOk = file.size <= 500 * 1024 * 1024; // 500MB max (same as backend)

      if (!isVideo) {
        resolve({ valid: false, error: 'Not a video file' });
        return;
      }

      if (!sizeOk) {
        resolve({ valid: false, error: 'File too large (max 500MB)' });
        return;
      }

      // Create video element to check duration and dimensions
      const video = document.createElement('video');
      const objectUrl = URL.createObjectURL(file);

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(objectUrl);
        const duration = video.duration;

        if (duration > 300) { // 5 minutes max
          resolve({ valid: false, error: 'Video too long (max 5 minutes)', duration });
        } else {
          resolve({ valid: true, duration });
        }
      };

      video.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({ valid: false, error: 'Invalid video file' });
      };

      video.src = objectUrl;
    });
  }, []);

  const handleFiles = useCallback(async (fileList: FileList) => {
    const newFiles: FileWithValidation[] = Array.from(fileList).map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'validating',
    }));

    setFiles(prev => [...prev, ...newFiles]);

    // Validate each file
    for (const fileObj of newFiles) {
      const validation = await validateFile(fileObj.file);
      
      setFiles(prev => prev.map(f => 
        f.id === fileObj.id 
          ? {
              ...f,
              status: validation.valid ? 'valid' : 'invalid',
              error: validation.error,
              duration: validation.duration,
            }
          : f
      ));
    }
  }, [validateFile]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const retryFile = useCallback(async (id: string) => {
    const fileToRetry = files.find(f => f.id === id);
    if (!fileToRetry) return;

    // Reset file status to validating and revalidate
    setFiles(prev => prev.map(f =>
      f.id === id ? { ...f, status: 'validating', error: undefined, progress: undefined } : f
    ));

    const validation = await validateFile(fileToRetry.file);
    setFiles(prev => prev.map(f =>
      f.id === id ? {
        ...f,
        status: validation.valid ? 'valid' : 'invalid',
        error: validation.error,
        duration: validation.duration,
      } : f
    ));
  }, [files, validateFile]);

  const uploadMutation = useMutation({
    mutationFn: async (data: UploadFormData) => {
      console.log('Upload mutation started with data:', data);
      const validFiles = files.filter(f => f.status === 'valid');
      console.log('Processing valid files:', validFiles.length);
      const results = [];

      for (const fileObj of validFiles) {
        try {
          // Update status to uploading
          setFiles(prev => prev.map(f =>
            f.id === fileObj.id ? { ...f, status: 'uploading', progress: 0 } : f
          ));

          // Create progress callback
          const onProgress = (progress: number) => {
            setFiles(prev => prev.map(f =>
              f.id === fileObj.id ? { ...f, progress } : f
            ));
          };

          // Upload the file
          console.log('Calling api.uploadVideo for file:', fileObj.file.name, 'to project:', data.projectId);
          const result = await api.uploadVideo(
            fileObj.file,
            data.projectId,
            onProgress
          );
          console.log('Upload result:', result);

          setFiles(prev => prev.map(f =>
            f.id === fileObj.id ? { ...f, status: 'complete', progress: 100 } : f
          ));

          results.push(result);
        } catch (error) {
          console.error('Upload error for file:', fileObj.file.name, error);

          // Mark this file as failed
          setFiles(prev => prev.map(f =>
            f.id === fileObj.id ? {
              ...f,
              status: 'invalid',
              error: error instanceof Error ? error.message : 'Upload failed'
            } : f
          ));
        }
      }

      return results;
    },
    onSuccess: (results) => {
      const successCount = results.length;
      const failedCount = files.filter(f => f.status === 'valid').length - successCount;

      toast({
        title: "Upload Complete",
        description: successCount > 0
          ? `Successfully uploaded ${successCount} video(s).${failedCount > 0 ? ` ${failedCount} failed.` : ''}`
          : "All uploads failed.",
        variant: failedCount > 0 && successCount === 0 ? "destructive" : "default",
      });

      queryClient.invalidateQueries({ queryKey: ["videos"] });

      // Reset after delay if all succeeded
      if (successCount > 0) {
        setTimeout(() => {
          setFiles([]);
          setUploadDrawerOpen(false);
          form.reset();
        }, 2000);
      }
    },
    onError: (error) => {
      console.error('Upload mutation error:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UploadFormData) => {
    console.log('Form submitted with data:', data);
    console.log('Files state:', files);

    const validFiles = files.filter(f => f.status === 'valid');
    console.log('Valid files count:', validFiles.length);

    if (validFiles.length === 0) {
      console.log('No valid files, showing error toast');
      toast({
        title: "No Valid Files",
        description: "Please add at least one valid video file.",
        variant: "destructive",
      });
      return;
    }

    console.log('Starting upload mutation with:', data);
    uploadMutation.mutate(data);
  };

  const getStatusIcon = (status: FileWithValidation['status']) => {
    switch (status) {
      case 'validating':
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
      case 'valid':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'invalid':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <FileVideo className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: FileWithValidation['status']) => {
    switch (status) {
      case 'valid':
        return 'default';
      case 'invalid':
        return 'destructive';
      case 'uploading':
        return 'secondary';
      case 'complete':
        return 'default';
      default:
        return 'secondary';
    }
  };

  return (
    <Drawer open={uploadDrawerOpen} onOpenChange={setUploadDrawerOpen}>
      <DrawerContent className="h-[80vh]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Upload Videos
          </DrawerTitle>
          <DrawerDescription>
            Upload video files (max 5 minutes, 500MB each). Supported formats: MP4, MOV, AVI, WebM.
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-6 pb-6 overflow-y-auto">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
              console.log('Form validation errors:', errors);
            })} className="space-y-6">
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-[280px]">
                          <SelectValue
                            placeholder={
                              projectsLoading ? "Loading projects..." :
                              projects.length === 0 ? "No projects available" :
                              "Select a project"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {projectsLoading ? (
                          <SelectItem value="loading" disabled>
                            <div className="flex items-center">
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                              Loading...
                            </div>
                          </SelectItem>
                        ) : projects.length === 0 ? (
                          <SelectItem value="no-projects" disabled>
                            No projects available
                          </SelectItem>
                        ) : (
                          projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Drop Zone */}
              <div
                className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive 
                    ? 'border-primary bg-primary/5' 
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  Drop your video files here
                </h3>
                <p className="text-muted-foreground mb-4">
                  or click to browse your computer
                </p>
                <Button type="button" variant="outline">
                  Choose Files
                </Button>
                <Input
                  type="file"
                  multiple
                  accept="video/*"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => {
                    if (e.target.files) {
                      handleFiles(e.target.files);
                    }
                  }}
                />
              </div>

              {/* File List */}
              {files.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium">Files ({files.length})</h4>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {files.map((fileObj) => (
                      <div
                        key={fileObj.id}
                        className="flex items-center gap-3 p-3 border rounded-lg"
                      >
                        {getStatusIcon(fileObj.status)}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">
                              {fileObj.file.name}
                            </p>
                            <Badge variant={getStatusColor(fileObj.status)}>
                              {fileObj.status}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{(fileObj.file.size / 1024 / 1024).toFixed(1)} MB</span>
                            {fileObj.duration && (
                              <span>{fileObj.duration.toFixed(1)}s</span>
                            )}
                          </div>
                          
                          {fileObj.error && (
                            <p className="text-sm text-destructive mt-1">
                              {fileObj.error}
                            </p>
                          )}
                          
                          {fileObj.status === 'uploading' && (
                            <Progress 
                              value={fileObj.progress || 0} 
                              className="mt-2 h-1" 
                            />
                          )}
                        </div>

                        <div className="flex gap-1">
                          {fileObj.status === 'invalid' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => retryFile(fileObj.id)}
                              title="Retry validation"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}
                          {fileObj.status !== 'uploading' && fileObj.status !== 'complete' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(fileObj.id)}
                              title="Remove file"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setUploadDrawerOpen(false)}
                  disabled={uploadMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={uploadMutation.isPending || files.filter(f => f.status === 'valid').length === 0}
                  className="min-w-[120px]"
                  onClick={() => {
                    console.log('Upload button clicked');
                    console.log('Form state:', form.formState);
                    console.log('Form values:', form.getValues());
                    console.log('Button disabled?', uploadMutation.isPending || files.filter(f => f.status === 'valid').length === 0);
                  }}
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload ({files.filter(f => f.status === 'valid').length})
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DrawerContent>
    </Drawer>
  );
}