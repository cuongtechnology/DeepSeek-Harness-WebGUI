import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit.service';
import { PermissionsService } from './permissions.service';

/**
 * Globally-available infrastructure providers (database, audit, permissions).
 * Marked `@Global()` so every feature module can inject them without importing
 * this module explicitly.
 */
@Global()
@Module({
  providers: [PrismaService, AuditService, PermissionsService],
  exports: [PrismaService, AuditService, PermissionsService],
})
export class CommonModule {}
