import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  Loader2 
} from "lucide-react";

const uploadSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  files: z.array(z.any()).min(1, "At least one file is required"),
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

  const form = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      projectId: "proj_default",
      files: [],
    },
  });

  const projects = [
    { value: "proj_default", label: "Personal Project" },
    { value: "proj_work", label: "Work Content" },
    { value: "proj_social", label: "Social Media" },
  ];

  // Mock file validation
  const validateFile = useCallback((file: File): Promise<{ valid: boolean; duration?: number; error?: string }> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Mock validation logic
        const isVideo = file.type.startsWith('video/');
        const sizeOk = file.size <= 100 * 1024 * 1024; // 100MB
        const mockDuration = Math.random() * 25 + 5; // 5-30 seconds
        
        if (!isVideo) {
          resolve({ valid: false, error: 'Not a video file' });
        } else if (!sizeOk) {
          resolve({ valid: false, error: 'File too large (max 100MB)' });
        } else if (mockDuration > 30) {
          resolve({ valid: false, error: 'Video too long (max 30s)', duration: mockDuration });
        } else {
          resolve({ valid: true, duration: mockDuration });
        }
      }, 1000 + Math.random() * 1000); // 1-2 second delay
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

  const uploadMutation = useMutation({
    mutationFn: async (data: UploadFormData) => {
      const validFiles = files.filter(f => f.status === 'valid');
      const results = [];

      for (const fileObj of validFiles) {
        // Update file status to uploading
        setFiles(prev => prev.map(f => 
          f.id === fileObj.id ? { ...f, status: 'uploading', progress: 0 } : f
        ));

        // Simulate upload progress
        for (let progress = 0; progress <= 100; progress += 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          setFiles(prev => prev.map(f => 
            f.id === fileObj.id ? { ...f, progress } : f
          ));
        }

        // Complete upload
        const result = await api.completeUpload({
          filename: fileObj.file.name,
          projectId: data.projectId,
          duration: fileObj.duration || 15,
        });

        setFiles(prev => prev.map(f => 
          f.id === fileObj.id ? { ...f, status: 'complete' } : f
        ));

        results.push(result);
      }

      return results;
    },
    onSuccess: (results) => {
      toast({
        title: "Upload Complete",
        description: `Successfully uploaded ${results.length} video(s).`,
      });
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      
      // Reset after delay
      setTimeout(() => {
        setFiles([]);
        setUploadDrawerOpen(false);
        form.reset();
      }, 2000);
    },
    onError: () => {
      toast({
        title: "Upload Failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UploadFormData) => {
    const validFiles = files.filter(f => f.status === 'valid');
    if (validFiles.length === 0) {
      toast({
        title: "No Valid Files",
        description: "Please add at least one valid video file.",
        variant: "destructive",
      });
      return;
    }
    
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
            Upload video files (max 30 seconds, 100MB each). Supported formats: MP4, MOV, AVI.
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-6 pb-6 overflow-y-auto">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-[280px]">
                          <SelectValue placeholder="Select a project" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {projects.map((project) => (
                          <SelectItem key={project.value} value={project.value}>
                            {project.label}
                          </SelectItem>
                        ))}
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

                        {fileObj.status !== 'uploading' && fileObj.status !== 'complete' && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(fileObj.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
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