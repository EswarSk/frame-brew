import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Sparkles, Loader2 } from "lucide-react";

const generateSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  prompt: z.string().min(10, "Prompt must be at least 10 characters"),
  stylePreset: z.string().optional(),
  durationSec: z.number().min(10).max(30),
  captions: z.boolean().default(true),
  watermark: z.boolean().default(false),
});

type GenerateFormData = z.infer<typeof generateSchema>;

export function GenerateDialog() {
  const { generateDialogOpen, setGenerateDialogOpen } = useUIStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<GenerateFormData>({
    resolver: zodResolver(generateSchema),
    defaultValues: {
      projectId: "proj_default",
      prompt: "",
      durationSec: 15,
      captions: true,
      watermark: false,
    },
  });

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
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: GenerateFormData) => {
    generateMutation.mutate(data);
  };

  const stylePresets = [
    { value: "cinematic", label: "Cinematic" },
    { value: "anime", label: "Anime" },
    { value: "photorealistic", label: "Photorealistic" },
    { value: "cartoon", label: "Cartoon" },
    { value: "sketch", label: "Sketch" },
  ];

  const projects = [
    { value: "proj_default", label: "Personal Project" },
    { value: "proj_work", label: "Work Content" },
    { value: "proj_social", label: "Social Media" },
  ];

  return (
    <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate Video
          </DialogTitle>
          <DialogDescription>
            Create a new video from your prompt. Generation typically takes 2-5 minutes.
          </DialogDescription>
        </DialogHeader>

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
                      <SelectTrigger>
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

            <FormField
              control={form.control}
              name="prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prompt</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the video you want to create... Be specific about style, mood, and content."
                      className="min-h-[100px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <div className="text-xs text-muted-foreground">
                    {field.value?.length || 0} characters
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
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

              <FormField
                control={form.control}
                name="durationSec"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration: {field.value}s</FormLabel>
                    <FormControl>
                      <Slider
                        min={10}
                        max={30}
                        step={1}
                        value={[field.value]}
                        onValueChange={(value) => field.onChange(value[0])}
                        className="w-full"
                      />
                    </FormControl>
                    <div className="text-xs text-muted-foreground">
                      10-30 seconds
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="text-sm font-medium">Options</h4>
              
              <FormField
                control={form.control}
                name="captions"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Auto Captions</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Generate captions automatically
                      </div>
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
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Watermark</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Add a subtle watermark
                      </div>
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

            <div className="flex justify-end gap-3">
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
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}