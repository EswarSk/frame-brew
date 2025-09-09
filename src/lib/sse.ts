
import type { QueryClient } from '@tanstack/react-query';
import type { Video, Status, ID } from './types';
import { subscribeToSSE } from './api';

export type SseStatusEvent = {
  type: 'status';
  jobId: ID;
  videoId: ID;
  status: Status;
  video?: Video;
};

export type SseEvent = SseStatusEvent;

// Centralized subscription to the mock SSE bus (exposed in-memory via api.subscribeToSSE)
export function subscribeToMockSse(onEvent: (event: SseEvent) => void): () => void {
  return subscribeToSSE((evt: any) => {
    onEvent(evt as SseEvent);
  });
}

type NotifyFn = (evt: {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}) => void;

export function attachSseToQueryClient(
  queryClient: QueryClient,
  notify?: NotifyFn
) {
  const unsubscribe = subscribeToMockSse((event) => {
    if (event.type !== 'status') return;

    const { videoId, status, video } = event;

    // Update any queries whose keys start with ['videos']
    queryClient.setQueriesData({ queryKey: ['videos'] }, (old: any) => {
      if (!old) return old;

      const applyUpdate = (v: Video): Video =>
        v.id === videoId ? { ...v, status, ...(status === 'ready' && video ? video : {}) } : v;

      // Handle { items: Video[] } shape
      if (old && typeof old === 'object' && 'items' in old && Array.isArray((old as any).items)) {
        const items: Video[] = (old as any).items;
        const idx = items.findIndex((v) => v.id === videoId);
        if (idx >= 0) {
          const nextItems = items.map(applyUpdate);
          return { ...old, items: nextItems };
        } else if (status === 'ready' && video) {
          return { ...old, items: [video, ...items] };
        }
        return old;
      }

      // Handle plain Video[] shape
      if (Array.isArray(old)) {
        const idx = (old as Video[]).findIndex((v) => v.id === videoId);
        if (idx >= 0) {
          return (old as Video[]).map(applyUpdate);
        } else if (status === 'ready' && video) {
          return [video, ...old];
        }
        return old;
      }

      return old;
    });

    if (status === 'ready' && video && notify) {
      notify({ title: 'Render complete', description: video.title });
    }
    if (status === 'failed' && notify) {
      notify({ title: 'Render failed', description: `Job ${event.jobId} failed`, variant: 'destructive' });
    }
  });

  return unsubscribe;
}
