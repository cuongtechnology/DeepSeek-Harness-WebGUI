import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { McpApiService, CreateMcpServerDto } from './mcp.service';

class McpDto implements CreateMcpServerDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsString()
  @MinLength(1)
  command!: string;

  @IsOptional()
  args?: string[];

  @IsOptional()
  env?: Record<string, string>;
}

class McpCallDto {
  tool!: string;
  arguments!: Record<string, unknown>;
}

@ApiTags('mcp')
@Controller('mcp')
@UseGuards(JwtAuthGuard)
export class McpController {
  constructor(private readonly mcp: McpApiService) {}

  @Get()
  list() {
    return this.mcp.list();
  }

  @Post()
  create(@Body() dto: McpDto) {
    return this.mcp.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<McpDto>) {
    return this.mcp.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.mcp.remove(id);
  }

  @Post(':id/connect')
  connect(@Param('id') id: string) {
    return this.mcp.connect(id);
  }

  @Post(':id/disconnect')
  disconnect(@Param('id') id: string) {
    return this.mcp.disconnect(id);
  }

  @Get(':id/tools')
  tools(@Param('id') id: string) {
    return this.mcp.getTools(id);
  }

  @Post(':id/tools/call')
  callTool(@Param('id') id: string, @Body() dto: McpCallDto) {
    return this.mcp.callTool(id, dto.tool, dto.arguments);
  }
}
