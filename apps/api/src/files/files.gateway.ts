import { Injectable, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { SESSION_COOKIE_NAME } from '@deepseek-harness/shared';
import { ProjectsService } from '../projects/projects.service';
import { FileWatcherService } from './file-watcher.service';

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
@WebSocketGateway({ namespace: '/files', cors: { origin: true, credentials: true } })
export class FilesGateway implements OnGatewayConnection, OnModuleInit {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly projects: ProjectsService,
    private readonly watcher: FileWatcherService,
  ) {}

  onModuleInit(): void {
    this.watcher.events.on('change', ({ projectId }: { projectId: string }) => {
      this.server.to(`files:${projectId}`).emit('files:changed', { projectId });
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

  @SubscribeMessage('files:subscribe')
  async onSubscribe(client: AuthenticatedSocket, payload: { projectId: string }): Promise<void> {
    const userId = client.data.user?.sub;
    if (!userId) {
      client.disconnect(true);
      return;
    }
    try {
      const workspacePath = await this.projects.assertOwner(userId, payload.projectId);
      this.watcher.watch(payload.projectId, workspacePath);
      client.join(`files:${payload.projectId}`);
    } catch {
      client.disconnect(true);
    }
  }
}
