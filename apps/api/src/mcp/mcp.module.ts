import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { McpApiService } from './mcp.service';

@Module({
  controllers: [McpController],
  providers: [McpApiService],
})
export class McpModule {}
