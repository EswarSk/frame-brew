import { cn } from "@/lib/utils";
import { useUIStore, useFilterStore } from "@/lib/stores";
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
  X
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocation, useNavigate } from "react-router-dom";

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
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const { setStatus, setMinScore, resetFilters } = useFilterStore();
  const location = useLocation();
  const navigate = useNavigate();

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: api.getProjects,
  });

  const handleFilterView = (view: typeof filterViews[0]) => {
    resetFilters();
    
    if (view.value === "high-score") {
      setMinScore(80);
    } else if (view.value === "generated" || view.value === "uploaded") {
      // This would filter by source type in a real implementation
    } else if (view.value) {
      setStatus(view.value.split(','));
    }
    
    navigate('/library');
  };

  if (!sidebarOpen) {
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
    <div className="fixed left-0 top-0 z-50 h-full w-64 border-r bg-card">
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4">
          <h2 className="text-lg font-semibold">Shorts Studio</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Separator />

        {/* Workspace Selector */}
        <div className="p-4">
          <Button variant="outline" className="w-full justify-between">
            <span>My Workspace</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
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
              <Badge variant="secondary" className="text-xs">
                {projects.length}
              </Badge>
            </div>
            
            {projects.map((project) => (
              <Button
                key={project.id}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-sm"
                onClick={() => {
                  resetFilters();
                  navigate('/library');
                }}
              >
                {project.name}
              </Button>
            ))}
          </div>

          <Separator className="my-4" />

          {/* Filter Views */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Views</h4>
            
            {filterViews.map((view) => {
              const Icon = view.icon;
              
              return (
                <Button
                  key={view.value}
                  variant="ghost"
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
  );
}