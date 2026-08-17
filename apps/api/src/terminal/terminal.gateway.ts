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
import { TerminalService } from './terminal.service';

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
@WebSocketGateway({ namespace: '/terminal', cors: { origin: true, credentials: true } })
export class TerminalGateway implements OnGatewayConnection, OnModuleInit {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly terminal: TerminalService,
  ) {}

  onModuleInit(): void {
    this.terminal.events.on('output', (sessionId: string, data: string) => {
      this.server.to(`terminal:${sessionId}`).emit('terminal:output', { sessionId, data });
    });
    this.terminal.events.on('exit', (sessionId: string, exitCode: number | null) => {
      this.server.to(`terminal:${sessionId}`).emit('terminal:exit', { sessionId, exitCode });
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

  @SubscribeMessage('terminal:subscribe')
  async onSubscribe(client: AuthenticatedSocket, payload: { sessionId: string }): Promise<void> {
    await this.terminal.spawn(payload.sessionId).catch(() => undefined);
    client.join(`terminal:${payload.sessionId}`);
  }

  @SubscribeMessage('terminal:input')
  onInput(_client: AuthenticatedSocket, payload: { sessionId: string; data: string }): void {
    this.terminal.write(payload.sessionId, payload.data);
  }

  @SubscribeMessage('terminal:resize')
  onResize(_client: AuthenticatedSocket, payload: { sessionId: string; cols: number; rows: number }): void {
    this.terminal.resize(payload.sessionId, payload.cols, payload.rows);
  }
}
