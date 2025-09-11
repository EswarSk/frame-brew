import { Search, Plus, User, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUIStore, useFilterStore } from "@/lib/stores";
import { useAuthStore } from "@/lib/auth-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";

export function AppHeader() {
  const { setCommandOpen, setGenerateDialogOpen, setUploadDrawerOpen, setSidebarOpen } = useUIStore();
  const { query, setQuery } = useFilterStore();
  const { user, logout } = useAuthStore();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSearch = (value: string) => {
    setQuery(value);
    if (location.pathname !== '/library') {
      navigate('/library');
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-4 px-4">
        {/* Mobile Menu Button */}
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="shrink-0"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}

        {/* Search */}
        <div className={isMobile ? "flex-1" : "max-w-md"}>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={isMobile ? "Search..." : "Search videos... (⌘K)"}
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-8"
              onKeyDown={(e) => {
                if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  setCommandOpen(true);
                }
              }}
            />
          </div>
        </div>

        {/* New Button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size={isMobile ? "icon" : "default"}>
              <Plus className={isMobile ? "h-4 w-4" : "mr-2 h-4 w-4"} />
              {!isMobile && "New"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setGenerateDialogOpen(true)}>
              Generate Video
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setUploadDrawerOpen(true)}>
              Upload Video
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/templates')}>
              New Template
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Spacer to push user menu to the end */}
        <div className="flex-1" />

        {/* User Menu - aligned to the far right */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <div className="px-2 py-1.5 text-sm font-medium">
              {user?.name || 'User'}
            </div>
            <div className="px-2 pb-2 text-xs text-muted-foreground">
              {user?.email}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}