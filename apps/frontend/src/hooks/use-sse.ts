import { useEffect, useRef, useState } from 'react';
import { subscribeToSSE } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface SSEEvent {
  type: 'status' | 'progress' | 'error' | 'complete' | 'connected';
  jobId?: string;
  videoId?: string;
  status?: string;
  progress?: number;
  message?: string;
  video?: any;
  error?: string;
  data?: any;
}

export function useSSE(enabled: boolean = true) {
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const handleEvent = (event: SSEEvent) => {
      console.log('SSE Event received:', event);
      
      setEvents(prev => [...prev.slice(-9), event]); // Keep last 10 events

      switch (event.type) {
        case 'connected':
          setIsConnected(true);
          break;
          
        case 'status':
          // Invalidate video queries when status changes
          queryClient.invalidateQueries({ queryKey: ['videos'] });
          if (event.videoId) {
            queryClient.invalidateQueries({ queryKey: ['video', event.videoId] });
          }
          break;
          
        case 'progress':
          // Progress updates don't need to invalidate queries
          break;
          
        case 'complete':
          queryClient.invalidateQueries({ queryKey: ['videos'] });
          if (event.videoId) {
            queryClient.invalidateQueries({ queryKey: ['video', event.videoId] });
          }
          if (event.video) {
            toast({
              title: "Video Ready",
              description: `${event.video.title} has been processed successfully.`,
            });
          }
          break;
          
        case 'error':
          queryClient.invalidateQueries({ queryKey: ['videos'] });
          if (event.videoId) {
            queryClient.invalidateQueries({ queryKey: ['video', event.videoId] });
          }
          toast({
            variant: "destructive",
            title: "Processing Error",
            description: event.error || event.message || "An error occurred during processing.",
          });
          break;
      }
    };

    const handleConnectionError = () => {
      setIsConnected(false);
      // Auto-retry connection after 5 seconds
      setTimeout(() => {
        if (enabled) {
          const unsubscribe = subscribeToSSE(handleEvent);
          unsubscribeRef.current = unsubscribe;
        }
      }, 5000);
    };

    try {
      const unsubscribe = subscribeToSSE((event) => {
        handleEvent(event);
      });
      
      unsubscribeRef.current = unsubscribe;
    } catch (error) {
      console.error('Failed to establish SSE connection:', error);
      handleConnectionError();
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      setIsConnected(false);
    };
  }, [enabled, toast, queryClient]);

  // Function to get events for a specific job/video
  const getEventsForJob = (jobId: string) => {
    return events.filter(event => event.jobId === jobId);
  };

  const getEventsForVideo = (videoId: string) => {
    return events.filter(event => event.videoId === videoId);
  };

  return {
    isConnected,
    events,
    getEventsForJob,
    getEventsForVideo,
  };
}