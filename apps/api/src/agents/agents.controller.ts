import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser, type JwtPayload } from '../common/jwt-auth.guard';
import { AgentsService } from './agents.service';
import { CreateSessionDto, SendMessageDto, ResolveApprovalDto } from './dto/agent.dto';
import type { AgentEvent as AgentEventRecord } from '@deepseek-harness/database';

@ApiTags('agents')
@Controller()
@UseGuards(JwtAuthGuard)
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get('agents')
  listRuntimes() {
    return this.agents.listRuntimes();
  }

  @Post('projects/:projectId/sessions')
  startSession(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string, @Body() dto: CreateSessionDto) {
    return this.agents.startSession(user.sub, projectId, dto);
  }

  @Get('sessions')
  listSessions(@CurrentUser() user: JwtPayload) {
    return this.agents.listSessions(user.sub);
  }

  @Get('sessions/:id')
  getSession(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.agents.getSession(user.sub, id);
  }

  @Get('sessions/:id/messages')
  getMessages(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.agents.getMessages(user.sub, id);
  }

  @Get('sessions/:id/events')
  getEvents(@CurrentUser() user: JwtPayload, @Param('id') id: string): Promise<AgentEventRecord[]> {
    return this.agents.getEvents(user.sub, id);
  }

  @Post('sessions/:id/messages')
  sendMessage(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.agents.sendMessage(user.sub, id, dto.message);
  }

  @Post('sessions/:id/stop')
  stopSession(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.agents.stopSession(user.sub, id);
  }

  @Get('approvals')
  listApprovals(@CurrentUser() user: JwtPayload) {
    return this.agents.listPendingApprovals(user.sub);
  }

  @Post('approvals/:id')
  resolveApproval(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: ResolveApprovalDto) {
    return this.agents.resolveApproval(user.sub, id, dto.decision);
  }
}
