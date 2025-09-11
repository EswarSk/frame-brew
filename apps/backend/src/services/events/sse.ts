import { Request, Response } from 'express';
import { AuthService } from '../../shared/utils/auth';
import { logger } from '../../shared/utils/logger';

interface SSEClient {
  id: string;
  userId: string;
  orgId: string;
  response: Response;
  lastHeartbeat: number;
}

class SSEManager {
  private clients: Map<string, SSEClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startHeartbeat();
  }

  // Add a new SSE client connection
  addClient(req: Request, res: Response): string | null {
    try {
      // Extract token from query params (fallback for SSE since headers are limited)
      const token = req.query.token as string;
      if (!token) {
        logger.warn('SSE connection attempt without token');
        return null;
      }

      // Verify the JWT token
      const payload = AuthService.verifyToken(token);
      const clientId = `${payload.userId}_${Date.now()}`;

      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || 'http://localhost:8080',
        'Access-Control-Allow-Credentials': 'true'
      });

      // Send initial connection message
      this.sendEvent(res, {
        type: 'connected',
        data: { message: 'SSE connection established', clientId }
      });

      // Store client
      const client: SSEClient = {
        id: clientId,
        userId: payload.userId,
        orgId: payload.orgId,
        response: res,
        lastHeartbeat: Date.now()
      };

      this.clients.set(clientId, client);

      // Handle client disconnect
      req.on('close', () => {
        this.removeClient(clientId);
      });

      req.on('end', () => {
        this.removeClient(clientId);
      });

      logger.info('SSE client connected', { clientId, userId: payload.userId });
      return clientId;

    } catch (error) {
      logger.error('Failed to establish SSE connection', { error: (error as Error).message });
      return null;
    }
  }

  // Remove a client
  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.response.end();
      } catch (error) {
        // Client already disconnected
      }
      this.clients.delete(clientId);
      logger.info('SSE client disconnected', { clientId, userId: client.userId });
    }
  }

  // Send event to specific client
  sendToClient(clientId: string, event: SSEEvent): boolean {
    const client = this.clients.get(clientId);
    if (client) {
      return this.sendEvent(client.response, event);
    }
    return false;
  }

  // Send event to all clients of a user
  sendToUser(userId: string, event: SSEEvent): number {
    let sentCount = 0;
    for (const client of this.clients.values()) {
      if (client.userId === userId) {
        if (this.sendEvent(client.response, event)) {
          sentCount++;
        }
      }
    }
    return sentCount;
  }

  // Send event to all clients of an organization
  sendToOrganization(orgId: string, event: SSEEvent): number {
    let sentCount = 0;
    for (const client of this.clients.values()) {
      if (client.orgId === orgId) {
        if (this.sendEvent(client.response, event)) {
          sentCount++;
        }
      }
    }
    return sentCount;
  }

  // Send event to all clients
  broadcast(event: SSEEvent): number {
    let sentCount = 0;
    for (const client of this.clients.values()) {
      if (this.sendEvent(client.response, event)) {
        sentCount++;
      }
    }
    return sentCount;
  }

  // Send raw event to response
  private sendEvent(res: Response, event: SSEEvent): boolean {
    try {
      const data = JSON.stringify(event.data || {});
      
      if (event.id) {
        res.write(`id: ${event.id}\n`);
      }
      
      if (event.type) {
        res.write(`event: ${event.type}\n`);
      }
      
      res.write(`data: ${data}\n\n`);
      return true;
    } catch (error) {
      logger.error('Failed to send SSE event', { error: (error as Error).message });
      return false;
    }
  }

  // Start heartbeat to keep connections alive
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const heartbeatEvent: SSEEvent = {
        type: 'heartbeat',
        data: { timestamp: now }
      };

      // Send heartbeat to all clients and remove stale ones
      const staleClients: string[] = [];
      for (const [clientId, client] of this.clients.entries()) {
        if (now - client.lastHeartbeat > 30000) { // 30 seconds timeout
          staleClients.push(clientId);
        } else {
          if (this.sendEvent(client.response, heartbeatEvent)) {
            client.lastHeartbeat = now;
          } else {
            staleClients.push(clientId);
          }
        }
      }

      // Remove stale clients
      staleClients.forEach(clientId => this.removeClient(clientId));

    }, 15000); // Send heartbeat every 15 seconds
  }

  // Get connection stats
  getStats() {
    return {
      totalConnections: this.clients.size,
      connections: Array.from(this.clients.values()).map(client => ({
        id: client.id,
        userId: client.userId,
        orgId: client.orgId,
        lastHeartbeat: client.lastHeartbeat
      }))
    };
  }

  // Cleanup on shutdown
  cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    for (const clientId of this.clients.keys()) {
      this.removeClient(clientId);
    }
  }
}

// SSE Event interface
export interface SSEEvent {
  type: string;
  id?: string;
  data?: any;
}

// Singleton SSE manager
export const sseManager = new SSEManager();

// SSE route handler
export const handleSSEConnection = (req: Request, res: Response) => {
  const clientId = sseManager.addClient(req, res);
  
  if (!clientId) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Valid authentication token required for SSE connection'
      }
    });
    return;
  }

  // Connection established, client will be managed by SSEManager
};

// Helper functions for common SSE events

export const emitVideoStatusUpdate = (orgId: string, videoId: string, status: string, video?: any) => {
  const event: SSEEvent = {
    type: 'video_status_update',
    id: `video_${videoId}_${Date.now()}`,
    data: {
      videoId,
      status,
      timestamp: new Date().toISOString(),
      ...(video && { video })
    }
  };
  
  return sseManager.sendToOrganization(orgId, event);
};

export const emitJobProgress = (orgId: string, jobId: string, progress: number, stage: string) => {
  const event: SSEEvent = {
    type: 'job_progress',
    id: `job_${jobId}_${Date.now()}`,
    data: {
      jobId,
      progress,
      stage,
      timestamp: new Date().toISOString()
    }
  };
  
  return sseManager.sendToOrganization(orgId, event);
};

export const emitJobComplete = (orgId: string, jobId: string, videoId: string, success: boolean, error?: string) => {
  const event: SSEEvent = {
    type: 'job_complete',
    id: `job_${jobId}_complete_${Date.now()}`,
    data: {
      jobId,
      videoId,
      success,
      timestamp: new Date().toISOString(),
      ...(error && { error })
    }
  };
  
  return sseManager.sendToOrganization(orgId, event);
};