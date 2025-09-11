import { cn } from "@/lib/utils";
import { useUIStore, useFilterStore } from "@/lib/stores";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  LayoutDashboard, 
  Library, 
  FileVideo, 
  Settings, 
  ChevronDown,
  Filter,
  Clock,
  CheckCircle,
  AlertCircle,
  Star,
  X,
  Plus,
  MoreHorizontal,
  Trash2,
  Menu
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocation, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

const navigationItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Library",
    href: "/library",
    icon: Library,
  },
  {
    title: "Templates",
    href: "/templates", 
    icon: FileVideo,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

const filterViews = [
  {
    title: "All Videos",
    value: "",
    icon: Library,
  },
  {
    title: "Generated",
    value: "generated",
    icon: Filter,
  },
  {
    title: "Uploaded", 
    value: "uploaded",
    icon: Filter,
  },
  {
    title: "In Progress",
    value: "queued,running,transcoding,scoring",
    icon: Clock,
  },
  {
    title: "Ready",
    value: "ready",
    icon: CheckCircle,
  },
  {
    title: "Failed",
    value: "failed", 
    icon: AlertCircle,
  },
  {
    title: "High Score (80+)",
    value: "high-score",
    icon: Star,
  },
];

export function AppSidebar() {
  const { sidebarOpen, setSidebarOpen, setProjectCreateDialogOpen } = useUIStore();
  const isMobile = useIsMobile();
  const { 
    setStatus, 
    setMinScore, 
    setSourceType, 
    setProjectId, 
    resetFilters,
    status,
    minScore,
    sourceType,
    projectId 
  } = useFilterStore();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: api.getProjects,
  });

  const deleteProjectMutation = useMutation({
    mutationFn: api.deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({
        title: "Project Deleted",
        description: "Project has been deleted successfully.",
      });
      // Reset project filter if the deleted project was selected
      if (projectId === deleteProjectId) {
        resetFilters();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete project.",
        variant: "destructive",
      });
    },
  });

  const handleFilterView = (view: typeof filterViews[0]) => {
    resetFilters();
    
    if (view.value === "high-score") {
      setMinScore(80);
    } else if (view.value === "generated") {
      setSourceType('generated');
    } else if (view.value === "uploaded") {
      setSourceType('uploaded');
    } else if (view.value) {
      setStatus(view.value.split(','));
    }
    
    navigate('/library');
  };

  const handleProjectClick = (project: any) => {
    resetFilters();
    setProjectId(project.id);
    navigate('/library');
  };

  const handleDeleteProject = (projectId: string) => {
    setDeleteProjectId(projectId);
  };

  const confirmDeleteProject = () => {
    if (deleteProjectId) {
      deleteProjectMutation.mutate(deleteProjectId);
      setDeleteProjectId(null);
    }
  };

  // Helper to check if a filter view is currently active
  const isViewActive = (view: typeof filterViews[0]) => {
    if (location.pathname !== '/library') return false;
    
    if (view.value === "") {
      return !status.length && !sourceType && !projectId && minScore === 0;
    } else if (view.value === "high-score") {
      return minScore >= 80;
    } else if (view.value === "generated") {
      return sourceType === 'generated';
    } else if (view.value === "uploaded") {
      return sourceType === 'uploaded';
    } else {
      return status.join(',') === view.value;
    }
  };

  // Helper to check if a project is currently active
  const isProjectActive = (project: any) => {
    return location.pathname === '/library' && projectId === project.id;
  };

  // On mobile, sidebar is always full width in a drawer, no collapsed state
  if (!isMobile && !sidebarOpen) {
    return (
      <div className="fixed left-0 top-0 z-50 h-full w-12 border-r bg-card">
        <div className="flex h-full flex-col items-center py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="mb-4"
          >
            <LayoutDashboard className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "h-full w-64 border-r bg-card",
      !isMobile && "fixed left-0 top-0 z-50"
    )}>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4">
          <h2 className="text-lg font-semibold">Shorts Studio</h2>
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <Separator />

        {/* Workspace Selector */}
        <div className="p-4">
          <Button variant="outline" className="w-full justify-between">
            <span>My Workspace</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation - Scrollable Content */}
        <div className="flex-1 overflow-hidden">
          <nav className="h-full overflow-y-auto space-y-1 p-4">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            
            return (
              <Button
                key={item.href}
                variant={isActive ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => navigate(item.href)}
              >
                <Icon className="mr-2 h-4 w-4" />
                {item.title}
              </Button>
            );
          })}

          <Separator className="my-4" />

          {/* Projects */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-muted-foreground">Projects</h4>
              <div className="flex items-center gap-1">
                <Badge variant="secondary" className="text-xs">
                  {projects.length}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setProjectCreateDialogOpen(true)}
                  title="Create new project"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            {projects.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-xs text-muted-foreground mb-2">No projects yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setProjectCreateDialogOpen(true)}
                  className="text-xs"
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Create Project
                </Button>
              </div>
            ) : (
              projects.map((project) => (
                <div key={project.id} className="flex items-center gap-1">
                  <Button
                    variant={isProjectActive(project) ? "secondary" : "ghost"}
                    size="sm"
                    className="flex-1 justify-start text-sm"
                    onClick={() => handleProjectClick(project)}
                  >
                    {project.name}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-muted"
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleDeleteProject(project.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </div>

          <Separator className="my-4" />

          {/* Filter Views */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Views</h4>
            
            {filterViews.map((view) => {
              const Icon = view.icon;
              const isActive = isViewActive(view);
              
              return (
                <Button
                  key={view.value}
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className="w-full justify-start text-sm"
                  onClick={() => handleFilterView(view)}
                >
                  <Icon className="mr-2 h-3 w-3" />
                  {view.title}
                </Button>
              );
            })}
          </div>
          </nav>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteProjectId} onOpenChange={(open) => !open && setDeleteProjectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this project? This action cannot be undone.
              You can only delete projects that don't have any videos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteProject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}