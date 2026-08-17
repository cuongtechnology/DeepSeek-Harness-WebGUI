import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser, type JwtPayload } from '../common/jwt-auth.guard';
import { TerminalService } from './terminal.service';

class CreateTerminalDto {
  title?: string;
}

@ApiTags('terminal')
@Controller()
@UseGuards(JwtAuthGuard)
export class TerminalController {
  constructor(private readonly terminal: TerminalService) {}

  @Post('projects/:projectId/terminal')
  create(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string, @Body() dto: CreateTerminalDto) {
    return this.terminal.create(user.sub, projectId, dto.title);
  }

  @Get('projects/:projectId/terminal')
  list(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.terminal.list(user.sub, projectId);
  }

  @Delete('terminal/:id')
  kill(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.terminal.kill(user.sub, id);
  }
}
