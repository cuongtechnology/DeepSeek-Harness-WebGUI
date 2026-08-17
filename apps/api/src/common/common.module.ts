import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit.service';
import { PermissionsService } from './permissions.service';
import { RuntimeConfigService } from './runtime-config.service';

/**
 * Globally-available infrastructure providers (database, audit, permissions,
 * runtime config). Marked `@Global()` so every feature module can inject them
 * without importing this module explicitly.
 */
@Global()
@Module({
  providers: [PrismaService, AuditService, PermissionsService, RuntimeConfigService],
  exports: [PrismaService, AuditService, PermissionsService, RuntimeConfigService],
})
export class CommonModule {}
