import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

export interface AuditParams {
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: unknown;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(private readonly prisma: PrismaService) {}

  async log(params: AuditParams): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: params.userId,
          action: params.action,
          resourceType: params.resourceType,
          resourceId: params.resourceId,
          metadata: params.metadata as object | undefined,
          ipAddress: params.ipAddress,
        },
      });
    } catch (error) {
      // Audit failure must never break the primary operation.
      this.logger.warn(`audit write failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
