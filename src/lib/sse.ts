import { ID, Status, Video } from './types';
import { subscribeToSSE } from './api';

export type SseStatusEvent = {
  type: 'status';
  jobId: ID;
  videoId: ID;
  status: Status;
  video?: Video;
};

export type SseEvent = SseStatusEvent;

// Subscribe to the mock in-memory SSE stream provided by the API layer
// Returns an unsubscribe function
export function subscribeToMockSse(onEvent: (event: SseEvent) => void): () => void {
  return subscribeToSSE((event: any) => {
    if (event && event.type === 'status') {
      onEvent(event as SseStatusEvent);
    }
  });
}
