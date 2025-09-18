import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Edit3, Loader2 } from "lucide-react";
import type { Video } from "@/lib/types";

const videoEditSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().max(1000, "Description too long").optional(),
  projectId: z.string().min(1, "Project is required"),
});

type VideoEditFormData = z.infer<typeof videoEditSchema>;

interface VideoEditDialogProps {
  video: Video | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VideoEditDialog({ video, open, onOpenChange }: VideoEditDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<VideoEditFormData>({
    resolver: zodResolver(videoEditSchema),
    defaultValues: {
      title: "",
      description: "",
      projectId: "",
    },
  });

  // Load projects from API
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: api.getProjects,
  });

  // Reset form when video changes
  useEffect(() => {
    if (video) {
      form.reset({
        title: video.title,
        description: video.description || "",
        projectId: video.projectId,
      });
    }
  }, [video, form]);

  const updateVideoMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: VideoEditFormData }) =>
      api.updateVideo(id, data),
    onSuccess: (data) => {
      toast({
        title: "Video Updated",
        description: `Video "${data.title}" has been updated successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      queryClient.invalidateQueries({ queryKey: ["video", video?.id] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('Video update error:', error);

      let errorMessage = "Something went wrong. Please try again.";
      if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Video Update Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: VideoEditFormData) => {
    if (!video) return;
    updateVideoMutation.mutate({ id: video.id, data });
  };

  const handleClose = () => {
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5 text-primary" />
            Edit Video
          </DialogTitle>
          <DialogDescription>
            Update the video title, description, and project assignment.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter video title..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what this video is about..."
                      className="min-h-[80px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <div className="text-xs text-muted-foreground">
                    {field.value?.length || 0}/1000 characters
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
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

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={updateVideoMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateVideoMutation.isPending || !video}
                className="min-w-[120px]"
              >
                {updateVideoMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Edit3 className="mr-2 h-4 w-4" />
                    Update Video
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}