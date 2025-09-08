import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { useUIStore } from "@/lib/stores";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { sidebarOpen } = useUIStore();

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      
      <div className={cn(
        "transition-all duration-200",
        sidebarOpen ? "ml-64" : "ml-12"
      )}>
        <AppHeader />
        
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}