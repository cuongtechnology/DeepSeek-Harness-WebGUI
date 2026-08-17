import { Injectable, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { SESSION_COOKIE_NAME, type PermissionDecision } from '@deepseek-harness/shared';
import { AgentsService } from './agents.service';

interface AuthenticatedSocket extends Socket {
  data: { user?: { sub: string } };
}

function extractCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return undefined;
}

@Injectable()
@WebSocketGateway({ namespace: '/agent', cors: { origin: true, credentials: true } })
export class AgentsGateway implements OnGatewayConnection, OnModuleInit {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly agents: AgentsService,
  ) {}

  onModuleInit(): void {
    this.agents.events.on('session', (sessionId: string, event: unknown) => {
      this.server.to(`session:${sessionId}`).emit('agent:event', { sessionId, event });
    });
  }

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    const token = extractCookie(client.handshake.headers.cookie, SESSION_COOKIE_NAME);
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const user = await this.jwt.verifyAsync<{ sub: string }>(token);
      client.data.user = user;
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('agent:subscribe')
  onSubscribe(client: AuthenticatedSocket, payload: { sessionId: string }): void {
    client.join(`session:${payload.sessionId}`);
  }

  @SubscribeMessage('agent:input')
  async onInput(client: AuthenticatedSocket, payload: { sessionId: string; message: string }): Promise<void> {
    const userId = client.data.user?.sub;
    if (!userId) return;
    await this.agents.sendMessage(userId, payload.sessionId, payload.message).catch(() => undefined);
  }

  @SubscribeMessage('agent:stop')
  async onStop(client: AuthenticatedSocket, payload: { sessionId: string }): Promise<void> {
    const userId = client.data.user?.sub;
    if (!userId) return;
    await this.agents.stopSession(userId, payload.sessionId).catch(() => undefined);
  }

  @SubscribeMessage('approval:respond')
  async onApproval(
    client: AuthenticatedSocket,
    payload: { requestId: string; decision: PermissionDecision },
  ): Promise<void> {
    const userId = client.data.user?.sub;
    if (!userId) return;
    await this.agents.resolveApproval(userId, payload.requestId, payload.decision).catch(() => undefined);
  }
}
