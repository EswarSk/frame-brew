import { Search, Plus, User } from "lucide-react";
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
import { useNavigate } from "react-router-dom";

export function AppHeader() {
  const { setCommandOpen, setGenerateDialogOpen, setUploadDrawerOpen } = useUIStore();
  const { query, setQuery } = useFilterStore();
  const navigate = useNavigate();

  const handleSearch = (value: string) => {
    setQuery(value);
    if (location.pathname !== '/library') {
      navigate('/library');
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-4 px-4">
        {/* Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search videos... (⌘K)"
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

        {/* Actions */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New
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

          {/* User Menu */}
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
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}