import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { useUIStore } from "@/lib/stores";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      {!isMobile && <AppSidebar />}

      {/* Mobile Sidebar Drawer */}
      {isMobile && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <AppSidebar />
          </SheetContent>
        </Sheet>
      )}
      
      <div className={cn(
        "transition-all duration-200",
        !isMobile && sidebarOpen ? "ml-64" : !isMobile ? "ml-12" : "ml-0"
      )}>
        <AppHeader />
        
        <main className={cn(
          "p-6",
          isMobile ? "p-4" : "p-6"
        )}>
          {children}
        </main>
      </div>
    </div>
  );
}