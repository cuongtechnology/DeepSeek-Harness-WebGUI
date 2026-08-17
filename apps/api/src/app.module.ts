import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './common/prisma.service';
import { AuditService } from './common/audit.service';
import { PermissionsService } from './common/permissions.service';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { FilesModule } from './files/files.module';
import { AgentsModule } from './agents/agents.module';
import { TerminalModule } from './terminal/terminal.module';
import { GitModule } from './git/git.module';
import { McpModule } from './mcp/mcp.module';
import { SandboxModule } from './sandbox/sandbox.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: Number.parseInt(process.env.RATE_LIMIT_PER_MINUTE ?? '120', 10),
      },
    ]),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'insecure-dev-secret-change-me',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' },
    }),
    AuthModule,
    ProjectsModule,
    FilesModule,
    AgentsModule,
    TerminalModule,
    GitModule,
    McpModule,
    SandboxModule,
    HealthModule,
  ],
  providers: [
    PrismaService,
    AuditService,
    PermissionsService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
