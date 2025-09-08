import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { ViewMode, ID } from './types';

interface UIStore {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  generateDialogOpen: boolean;
  setGenerateDialogOpen: (open: boolean) => void;
  uploadDrawerOpen: boolean;
  setUploadDrawerOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStore>()(
  devtools(
    persist(
      (set) => ({
        sidebarOpen: true,
        setSidebarOpen: (open) => set({ sidebarOpen: open }),
        theme: 'system',
        setTheme: (theme) => set({ theme }),
        commandOpen: false,
        setCommandOpen: (open) => set({ commandOpen: open }),
        generateDialogOpen: false,
        setGenerateDialogOpen: (open) => set({ generateDialogOpen: open }),
        uploadDrawerOpen: false,
        setUploadDrawerOpen: (open) => set({ uploadDrawerOpen: open }),
      }),
      {
        name: 'ui-store',
        partialize: (state) => ({
          sidebarOpen: state.sidebarOpen,
          theme: state.theme,
        }),
      }
    )
  )
);

interface FilterStore {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  query: string;
  setQuery: (query: string) => void;
  status: string[];
  setStatus: (status: string[]) => void;
  projectId: string;
  setProjectId: (id: string) => void;
  minScore: number;
  setMinScore: (score: number) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
  tags: string[];
  setTags: (tags: string[]) => void;
  resetFilters: () => void;
}

export const useFilterStore = create<FilterStore>()(
  devtools(
    persist(
      (set) => ({
        viewMode: 'grid',
        setViewMode: (mode) => set({ viewMode: mode }),
        query: '',
        setQuery: (query) => set({ query }),
        status: [],
        setStatus: (status) => set({ status }),
        projectId: '',
        setProjectId: (id) => set({ projectId: id }),
        minScore: 0,
        setMinScore: (score) => set({ minScore: score }),
        sortBy: 'newest',
        setSortBy: (sort) => set({ sortBy: sort }),
        tags: [],
        setTags: (tags) => set({ tags }),
        resetFilters: () =>
          set({
            query: '',
            status: [],
            projectId: '',
            minScore: 0,
            sortBy: 'newest',
            tags: [],
          }),
      }),
      {
        name: 'filter-store',
      }
    )
  )
);

interface SelectionStore {
  selectedVideoIds: Set<ID>;
  setSelectedVideoIds: (ids: Set<ID>) => void;
  addSelection: (id: ID) => void;
  removeSelection: (id: ID) => void;
  toggleSelection: (id: ID) => void;
  clearSelection: () => void;
  selectAll: (ids: ID[]) => void;
}

export const useSelectionStore = create<SelectionStore>()(
  devtools((set, get) => ({
    selectedVideoIds: new Set(),
    setSelectedVideoIds: (ids) => set({ selectedVideoIds: ids }),
    addSelection: (id) => {
      const current = get().selectedVideoIds;
      const newSet = new Set(current);
      newSet.add(id);
      set({ selectedVideoIds: newSet });
    },
    removeSelection: (id) => {
      const current = get().selectedVideoIds;
      const newSet = new Set(current);
      newSet.delete(id);
      set({ selectedVideoIds: newSet });
    },
    toggleSelection: (id) => {
      const current = get().selectedVideoIds;
      const newSet = new Set(current);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      set({ selectedVideoIds: newSet });
    },
    clearSelection: () => set({ selectedVideoIds: new Set() }),
    selectAll: (ids) => set({ selectedVideoIds: new Set(ids) }),
  }))
);

interface PlayerStore {
  muted: boolean;
  setMuted: (muted: boolean) => void;
  loop: boolean;
  setLoop: (loop: boolean) => void;
  speed: number;
  setSpeed: (speed: number) => void;
}

export const usePlayerStore = create<PlayerStore>()(
  devtools(
    persist(
      (set) => ({
        muted: false,
        setMuted: (muted) => set({ muted }),
        loop: false,
        setLoop: (loop) => set({ loop }),
        speed: 1,
        setSpeed: (speed) => set({ speed }),
      }),
      {
        name: 'player-store',
      }
    )
  )
);