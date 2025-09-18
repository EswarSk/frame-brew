import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Edit3, Loader2 } from "lucide-react";
import type { Project } from "@/lib/types";

const projectEditSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100, "Name too long"),
  description: z.string().max(500, "Description too long").optional(),
});

type ProjectEditFormData = z.infer<typeof projectEditSchema>;

interface ProjectEditDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectEditDialog({ project, open, onOpenChange }: ProjectEditDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ProjectEditFormData>({
    resolver: zodResolver(projectEditSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Reset form when project changes
  useEffect(() => {
    if (project) {
      form.reset({
        name: project.name,
        description: project.description || "",
      });
    }
  }, [project, form]);

  const updateProjectMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProjectEditFormData }) =>
      api.updateProject(id, data),
    onSuccess: (data) => {
      toast({
        title: "Project Updated",
        description: `Project "${data.name}" has been updated successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('Project update error:', error);

      let errorMessage = "Something went wrong. Please try again.";
      if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Project Update Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProjectEditFormData) => {
    if (!project) return;
    updateProjectMutation.mutate({ id: project.id, data });
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
            Edit Project
          </DialogTitle>
          <DialogDescription>
            Update the project name and description.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter project name..."
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
                      placeholder="Describe what this project is for..."
                      className="min-h-[80px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <div className="text-xs text-muted-foreground">
                    {field.value?.length || 0}/500 characters
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={updateProjectMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateProjectMutation.isPending || !project}
                className="min-w-[120px]"
              >
                {updateProjectMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Edit3 className="mr-2 h-4 w-4" />
                    Update Project
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