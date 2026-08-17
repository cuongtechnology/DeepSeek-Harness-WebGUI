import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard, CurrentUser, type JwtPayload } from '../common/jwt-auth.guard';
import { projectWorkspace } from '../common/workspace';
import { DockerSandboxManager } from './sandbox.service';

class CreateSandboxDto {
  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsBoolean()
  networkDisabled?: boolean;
}

class ExecDto {
  @IsString()
  command!: string;
}

@ApiTags('sandbox')
@Controller()
@UseGuards(JwtAuthGuard)
export class SandboxController {
  constructor(private readonly sandbox: DockerSandboxManager) {}

  @Post('projects/:projectId/sandbox')
  create(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string, @Body() dto: CreateSandboxDto) {
    return this.sandbox.create({
      ownerId: user.sub,
      projectId,
      image: dto.image,
      networkDisabled: dto.networkDisabled,
      workspacePath: projectWorkspace(projectId),
    });
  }

  @Post('sandbox/:id/start')
  start(@Param('id') id: string) {
    return this.sandbox.start(id);
  }

  @Post('sandbox/:id/stop')
  stop(@Param('id') id: string) {
    return this.sandbox.stop(id);
  }

  @Post('sandbox/:id/destroy')
  destroy(@Param('id') id: string) {
    return this.sandbox.destroy(id);
  }

  @Post('sandbox/:id/exec')
  exec(@Param('id') id: string, @Body() dto: ExecDto) {
    return this.sandbox.exec(id, dto.command);
  }
}
