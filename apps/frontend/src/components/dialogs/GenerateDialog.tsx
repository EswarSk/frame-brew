import { useState } from "react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useUIStore } from "@/lib/stores";
import { api } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Loader2, Plus, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const generateSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  prompt: z.string().min(10, "Prompt must be at least 10 characters").max(2000, "Prompt too long"),
  stylePreset: z.string().optional(),
  durationSec: z.number().min(5, "Minimum 5 seconds").max(60, "Maximum 60 seconds"),
  captions: z.boolean().default(true),
  watermark: z.boolean().default(false),
  // Veo3 specific parameters
  negativePrompt: z.string().max(1000, "Negative prompt too long").optional(),
  aspectRatio: z.enum(["16:9", "9:16"]).default("16:9"),
  resolution: z.enum(["720p", "1080p"]).default("720p"),
  model: z.enum(["stable", "fast"]).default("fast"),
});

type GenerateFormData = z.infer<typeof generateSchema>;

export function GenerateDialog() {
  const { generateDialogOpen, setGenerateDialogOpen, setProjectCreateDialogOpen } = useUIStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreatingDefaultProject, setIsCreatingDefaultProject] = React.useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = React.useState(false);

  // Load projects from API
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: api.getProjects,
  });

  const form = useForm<GenerateFormData>({
    resolver: zodResolver(generateSchema),
    defaultValues: {
      projectId: "",
      prompt: "",
      durationSec: 8, // Veo3 generates 8-second videos
      captions: true,
      watermark: false,
      negativePrompt: "",
      aspectRatio: "16:9" as const,
      resolution: "720p" as const,
      model: "fast" as const,
    },
  });

  // Auto-create default project mutation
  const createDefaultProjectMutation = useMutation({
    mutationFn: () => api.createProject({
      name: "My First Project",
      description: "Default project for getting started"
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      form.setValue('projectId', data.id);
      toast({
        title: "Project Created",
        description: "Created your first project to get you started!",
      });
    },
    onError: (error: any) => {
      console.error('Default project creation error:', error);
      toast({
        title: "Project Creation Failed",
        description: error.message || "Failed to create default project.",
        variant: "destructive",
      });
    },
  });

  // Auto-create default project or set default project when projects load
  React.useEffect(() => {
    if (generateDialogOpen && !projectsLoading && projects.length === 0 && !isCreatingDefaultProject) {
      // Auto-create default project for solo users
      setIsCreatingDefaultProject(true);
      createDefaultProjectMutation.mutate();
    } else if (projects.length > 0 && !form.getValues('projectId')) {
      // Set first project as default
      form.setValue('projectId', projects[0].id);
      setIsCreatingDefaultProject(false);
    }
  }, [projects, form, generateDialogOpen, projectsLoading, isCreatingDefaultProject]);

  const generateMutation = useMutation({
    mutationFn: api.createGeneration,
    onSuccess: (data) => {
      toast({
        title: "Generation Started",
        description: `Creating "${data.video.title}" - check the library for progress.`,
      });
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      setGenerateDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      console.error('Generation error:', error);
      
      // Try to extract specific error message
      let errorMessage = "Something went wrong. Please try again.";
      
      if (error.message) {
        errorMessage = error.message;
      }
      
      // Handle validation errors specifically
      if (error.message === "Invalid input data") {
        errorMessage = "Please check your input fields and try again.";
      }
      
      toast({
        title: "Generation Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: GenerateFormData) => {
    // Validate that a real project is selected
    if (!data.projectId || data.projectId === 'loading' || data.projectId === 'no-projects') {
      toast({
        title: "Project Required",
        description: "Please wait for your project to be created or create a new one.",
        variant: "destructive",
      });
      return;
    }
    
    generateMutation.mutate(data);
  };

  const stylePresets = [
    { value: "cinematic", label: "Cinematic" },
    { value: "anime", label: "Anime" },
    { value: "photorealistic", label: "Photorealistic" },
    { value: "cartoon", label: "Cartoon" },
    { value: "sketch", label: "Sketch" },
  ];

  return (
    <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate Video
          </DialogTitle>
          <DialogDescription>
            Create a new video from your prompt using Google Veo3. Generation typically takes 1-6 minutes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Project</FormLabel>
                    {projects.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setProjectCreateDialogOpen(true)}
                        className="h-6 px-2 text-xs"
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        New
                      </Button>
                    )}
                  </div>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue 
                          placeholder={
                            projectsLoading ? "Loading projects..." :
                            createDefaultProjectMutation.isPending || isCreatingDefaultProject ? "Creating your first project..." :
                            projects.length === 0 ? "No projects yet" :
                            "Select a project"
                          } 
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projectsLoading || createDefaultProjectMutation.isPending ? (
                        <SelectItem value="loading" disabled>
                          <div className="flex items-center">
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            {createDefaultProjectMutation.isPending ? "Creating project..." : "Loading..."}
                          </div>
                        </SelectItem>
                      ) : projects.length === 0 ? (
                        <div className="p-4 text-center">
                          <p className="text-sm text-muted-foreground mb-3">No projects yet</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setProjectCreateDialogOpen(true)}
                          >
                            <Plus className="mr-2 h-3 w-3" />
                            Create Project
                          </Button>
                        </div>
                      ) : (
                        projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {projects.length === 0 && !projectsLoading && !createDefaultProjectMutation.isPending && (
                    <p className="text-xs text-muted-foreground">
                      A project will be created automatically when you generate your first video.
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prompt</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the video you want to create... Be specific about style, mood, and content."
                      className="min-h-[80px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <div className="text-xs text-muted-foreground">
                    {field.value?.length || 0}/2000 characters
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Essential Options */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="aspectRatio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aspect Ratio</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                        <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="fast">Fast (1-3 minutes)</SelectItem>
                        <SelectItem value="stable">Stable (3-6 minutes)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Advanced Options */}
            <Collapsible open={showAdvancedOptions} onOpenChange={setShowAdvancedOptions}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
                  size="sm"
                >
                  Advanced Options
                  <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedOptions ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="negativePrompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Negative Prompt</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What you DON'T want (e.g., blurry, text, watermarks)"
                          className="min-h-[60px] resize-none"
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

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="resolution"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Resolution</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="720p">720p (Faster)</SelectItem>
                            <SelectItem value="1080p">1080p (Higher Quality)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="stylePreset"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Style Preset</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Default" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {stylePresets.map((preset) => (
                              <SelectItem key={preset.value} value={preset.value}>
                                {preset.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex items-center p-2 bg-muted rounded-md">
                  <div className="text-sm text-muted-foreground">
                    ℹ️ Veo3 generates 8-second videos. Duration is fixed.
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            <div className="space-y-3">
              <h4 className="text-sm font-medium">Processing Options</h4>
              
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="captions"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-2">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Auto Captions</FormLabel>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="watermark"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-2">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Watermark</FormLabel>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
            </form>
          </Form>
        </div>

        {/* Fixed Footer with Buttons */}
        <div className="flex-shrink-0 border-t pt-4 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setGenerateDialogOpen(false)}
            disabled={generateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={generateMutation.isPending}
            className="min-w-[120px]"
            onClick={form.handleSubmit(onSubmit)}
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}