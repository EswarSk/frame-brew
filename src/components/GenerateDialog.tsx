
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import { api } from "@/lib/api";
import { useUIStore } from "@/lib/stores";
import { useToast } from "@/components/ui/use-toast";

type GenerateDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const schema = z.object({
  projectId: z.string().min(1, "Select a project"),
  prompt: z.string().min(10, "Prompt must be at least 10 characters"),
  stylePreset: z.string().optional(),
  durationSec: z.number().min(10).max(30),
  captions: z.boolean().default(true),
  watermark: z.boolean().default(false),
});

type FormValues = z.infer<typeof schema>;

const STYLE_PRESETS = [
  { value: "cinematic", label: "Cinematic" },
  { value: "tutorial", label: "Tutorial" },
  { value: "ad-energetic", label: "Ad • Energetic" },
  { value: "chill", label: "Chill" },
];

export function GenerateDialog({ open, onOpenChange }: GenerateDialogProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const storeOpen = useUIStore((s) => s.generateDialogOpen);
  const setStoreOpen = useUIStore((s) => s.setGenerateDialogOpen);

  const effectiveOpen = open ?? storeOpen;
  const handleOpenChange = onOpenChange ?? setStoreOpen;

  const { data: projects, isLoading: loadingProjects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.getProjects(),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      projectId: "",
      prompt: "",
      stylePreset: "cinematic",
      durationSec: 20,
      captions: true,
      watermark: false,
    },
  });

  useEffect(() => {
    if (!loadingProjects && projects && projects.length > 0) {
      const current = form.getValues("projectId");
      if (!current) form.setValue("projectId", projects[0].id);
    }
  }, [loadingProjects, projects, form]);

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.createGeneration({
        projectId: values.projectId,
        prompt: values.prompt,
        stylePreset: values.stylePreset,
        durationSec: values.durationSec,
        captions: values.captions,
      }),
    onSuccess: () => {
      toast({ title: "Generation created", description: "Your video has been queued." });
      handleOpenChange(false);
      navigate("/library?status=queued");
    },
    onError: (err: any) => {
      toast({ title: "Failed to create job", description: err?.message || "Please try again.", variant: "destructive" as any });
    },
    retry: 2,
  });

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(values);
  };

  const durationLabel = `${form.watch("durationSec")}s`;

  return (
    <Dialog open={effectiveOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate video</DialogTitle>
          <DialogDescription>Describe what you want to create. Jobs run asynchronously.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange} disabled={loadingProjects}>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingProjects ? "Loading projects..." : "Select a project"} />
                      </SelectTrigger>
                      <SelectContent>
                        {projects?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
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
                    <Textarea rows={5} placeholder="Describe the video to generate..." {...field} />
                  </FormControl>
                  <FormDescription>Be specific. Minimum 10 characters.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="stylePreset"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Style preset</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose style" />
                        </Trigger>
                        <SelectContent>
                          {STYLE_PRESETS.map((sp) => (
                            <SelectItem key={sp.value} value={sp.value}>
                              {sp.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <Label>Aspect</Label>
                <div className="text-sm text-muted-foreground">9:16 (fixed)</div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="durationSec"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Duration</FormLabel>
                    <span className="text-sm text-muted-foreground">{durationLabel}</span>
                  </div>
                  <FormControl>
                    <Slider
                      value={[field.value]}
                      onValueChange={(vals) => field.onChange(vals[0])}
                      min={10}
                      max={30}
                      step={1}
                    />
                  </FormControl>
                  <FormDescription>Between 10 and 30 seconds.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="captions"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <FormLabel>Captions</FormLabel>
                      <FormDescription>Auto-generate subtitles</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="watermark"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <FormLabel>Watermark</FormLabel>
                      <FormDescription>Add brand watermark</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={createMutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Job"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default GenerateDialog;
