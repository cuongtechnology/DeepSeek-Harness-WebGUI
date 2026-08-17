import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser, type JwtPayload } from '../common/jwt-auth.guard';
import { GitApiService } from './git.service';

class GitPathsDto {
  paths!: string[];
}

class GitCommitDto {
  message!: string;
}

class GitBranchDto {
  branch!: string;
}

@ApiTags('git')
@Controller('projects/:projectId/git')
@UseGuards(JwtAuthGuard)
export class GitController {
  constructor(private readonly git: GitApiService) {}

  @Get('status')
  status(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.git.status(user.sub, projectId);
  }

  @Get('diff')
  diff(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string, @Query('path') path?: string, @Query('staged') staged?: string) {
    return this.git.diff(user.sub, projectId, path, staged === 'true');
  }

  @Get('diff-pair')
  diffPair(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string, @Query('path') path: string, @Query('staged') staged?: string) {
    return this.git.diffPair(user.sub, projectId, path, staged === 'true');
  }

  @Get('log')
  log(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string, @Query('count') count?: string) {
    return this.git.log(user.sub, projectId, count ? Number.parseInt(count, 10) : 50);
  }

  @Get('branches')
  branches(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.git.branches(user.sub, projectId);
  }

  @Post('checkout')
  checkout(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string, @Body() dto: GitBranchDto) {
    return this.git.checkout(user.sub, projectId, dto.branch);
  }

  @Post('stage')
  stage(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string, @Body() dto: GitPathsDto) {
    return this.git.stage(user.sub, projectId, dto.paths);
  }

  @Post('unstage')
  unstage(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string, @Body() dto: GitPathsDto) {
    return this.git.unstage(user.sub, projectId, dto.paths);
  }

  @Post('commit')
  commit(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string, @Body() dto: GitCommitDto) {
    return this.git.commit(user.sub, projectId, dto.message);
  }

  @Post('pull')
  pull(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.git.pull(user.sub, projectId);
  }

  @Post('push')
  push(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.git.push(user.sub, projectId);
  }
}
