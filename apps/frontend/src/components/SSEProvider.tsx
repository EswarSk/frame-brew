import { useSSE } from '@/hooks/use-sse';
import { useAuthStore } from '@/lib/auth-store';

export function SSEProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  
  // Only enable SSE when user is authenticated
  useSSE(isAuthenticated);
  
  return <>{children}</>;
}