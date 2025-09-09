import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useUIStore } from "@/lib/stores";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Copy, 
  Sparkles,
  FileText,
  Clock
} from "lucide-react";

const templateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  prompt: z.string().min(10, "Prompt must be at least 10 characters"),
  stylePreset: z.string().optional(),
});

type TemplateFormData = z.infer<typeof templateSchema>;

export default function Templates() {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { setGenerateDialogOpen } = useUIStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: api.getTemplates,
  });

  const createMutation = useMutation({
    mutationFn: api.createTemplate,
    onSuccess: () => {
      toast({
        title: "Template created",
        description: "Your template has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setIsCreateOpen(false);
      form.reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TemplateFormData }) =>
      api.updateTemplate(id, data),
    onSuccess: () => {
      toast({
        title: "Template updated",
        description: "Your changes have been saved.",
      });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setEditingTemplate(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteTemplate,
    onSuccess: () => {
      toast({
        title: "Template deleted",
        description: "The template has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (template: any) =>
      api.createTemplate({
        name: `${template.name} (Copy)`,
        prompt: template.prompt,
        stylePreset: template.stylePreset,
      }),
    onSuccess: () => {
      toast({
        title: "Template duplicated",
        description: "A copy of the template has been created.",
      });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: "",
      prompt: "",
      stylePreset: "",
    },
  });

  const onSubmit = (data: TemplateFormData) => {
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (template: any) => {
    setEditingTemplate(template);
    form.setValue("name", template.name);
    form.setValue("prompt", template.prompt);
    form.setValue("stylePreset", template.stylePreset || "");
  };

  const handleUseTemplate = (template: any) => {
    // Store template data in localStorage for the generate dialog to pick up
    localStorage.setItem('selectedTemplate', JSON.stringify(template));
    setGenerateDialogOpen(true);
    toast({
      title: "Template loaded",
      description: "The template has been loaded into the generator.",
    });
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.prompt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stylePresets = [
    { value: "cinematic", label: "Cinematic" },
    { value: "anime", label: "Anime" },
    { value: "photorealistic", label: "Photorealistic" },
    { value: "cartoon", label: "Cartoon" },
    { value: "sketch", label: "Sketch" },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Templates</h1>
            <p className="text-muted-foreground">
              Save and reuse your favorite prompts and settings.
            </p>
          </div>

          <Dialog 
            open={isCreateOpen || !!editingTemplate} 
            onOpenChange={(open) => {
              if (!open) {
                setIsCreateOpen(false);
                setEditingTemplate(null);
                form.reset();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Template
              </Button>
            </DialogTrigger>
            
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? "Edit Template" : "Create Template"}
                </DialogTitle>
                <DialogDescription>
                  {editingTemplate 
                    ? "Update your template details below." 
                    : "Save a prompt as a template for future use."}
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Template Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Product Showcase, Travel Montage..." 
                            {...field} 
                          />
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
                          <Textarea
                            placeholder="Describe the video style, mood, and content..."
                            className="min-h-[120px] resize-none"
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

                  <FormField
                    control={form.control}
                    name="stylePreset"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Style Preset (Optional)</FormLabel>
                        <FormControl>
                          <select 
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            {...field}
                          >
                            <option value="">Default</option>
                            {stylePresets.map((preset) => (
                              <option key={preset.value} value={preset.value}>
                                {preset.label}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsCreateOpen(false);
                        setEditingTemplate(null);
                        form.reset();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                    >
                      {editingTemplate ? "Update Template" : "Create Template"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Templates Grid */}
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-12">
            {templates.length === 0 ? (
              <>
                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No templates yet</h3>
                <p className="text-muted-foreground">
                  Create your first template to save time on future videos.
                </p>
                <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Template
                </Button>
              </>
            ) : (
              <>
                <Search className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No results found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search terms.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <Card key={template.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg line-clamp-1">
                        {template.name}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Clock className="h-3 w-3" />
                        {new Date(template.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(template)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => duplicateMutation.mutate(template)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => deleteMutation.mutate(template.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                
                <CardContent className="flex-1 flex flex-col">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                      {template.prompt}
                    </p>
                    
                    {template.stylePreset && (
                      <Badge variant="secondary" className="mb-4">
                        {stylePresets.find(p => p.value === template.stylePreset)?.label || template.stylePreset}
                      </Badge>
                    )}
                  </div>
                  
                  <Button 
                    onClick={() => handleUseTemplate(template)}
                    className="w-full"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Use Template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}