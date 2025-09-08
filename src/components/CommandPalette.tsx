import { useEffect } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { 
  Sparkles, 
  Upload, 
  FileVideo, 
  LayoutDashboard, 
  Library, 
  Settings,
  Search
} from "lucide-react";
import { useUIStore } from "@/lib/stores";
import { useNavigate } from "react-router-dom";

export function CommandPalette() {
  const { 
    commandOpen, 
    setCommandOpen, 
    setGenerateDialogOpen, 
    setUploadDrawerOpen 
  } = useUIStore();
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen(!commandOpen);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [commandOpen, setCommandOpen]);

  const handleAction = (action: () => void) => {
    action();
    setCommandOpen(false);
  };

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => handleAction(() => setGenerateDialogOpen(true))}>
            <Sparkles className="mr-2 h-4 w-4" />
            <span>Generate Video</span>
          </CommandItem>
          <CommandItem onSelect={() => handleAction(() => setUploadDrawerOpen(true))}>
            <Upload className="mr-2 h-4 w-4" />
            <span>Upload Video</span>
          </CommandItem>
          <CommandItem onSelect={() => handleAction(() => navigate('/templates'))}>
            <FileVideo className="mr-2 h-4 w-4" />
            <span>New Template</span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => handleAction(() => navigate('/dashboard'))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => handleAction(() => navigate('/library'))}>
            <Library className="mr-2 h-4 w-4" />
            <span>Library</span>
          </CommandItem>
          <CommandItem onSelect={() => handleAction(() => navigate('/templates'))}>
            <FileVideo className="mr-2 h-4 w-4" />
            <span>Templates</span>
          </CommandItem>
          <CommandItem onSelect={() => handleAction(() => navigate('/settings'))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Search">
          <CommandItem onSelect={() => handleAction(() => navigate('/library?q=ready'))}>
            <Search className="mr-2 h-4 w-4" />
            <span>Ready Videos</span>
          </CommandItem>
          <CommandItem onSelect={() => handleAction(() => navigate('/library?q=processing'))}>
            <Search className="mr-2 h-4 w-4" />
            <span>Processing Videos</span>
          </CommandItem>
          <CommandItem onSelect={() => handleAction(() => navigate('/library?q=high-score'))}>
            <Search className="mr-2 h-4 w-4" />
            <span>High Score Videos</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}