import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser, type JwtPayload } from '../common/jwt-auth.guard';
import { FilesService } from './files.service';

class WriteFileDto {
  content!: string;
}

class RenameDto {
  oldPath!: string;
  newPath!: string;
}

@ApiTags('files')
@Controller('projects/:projectId/files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string, @Query('path') path = '') {
    return this.files.list(user.sub, projectId, path);
  }

  @Get('tree')
  tree(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.files.tree(user.sub, projectId);
  }

  @Get('read')
  read(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string, @Query('path') path: string) {
    return this.files.read(user.sub, projectId, path);
  }

  @Put('write')
  write(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string, @Body() body: WriteFileDto & { path: string }) {
    return this.files.write(user.sub, projectId, body.path, body.content);
  }

  @Post('create-file')
  createFile(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string, @Body() body: { path: string }) {
    return this.files.createFile(user.sub, projectId, body.path);
  }

  @Post('create-dir')
  createDir(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string, @Body() body: { path: string }) {
    return this.files.createDir(user.sub, projectId, body.path);
  }

  @Delete()
  remove(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string, @Query('path') path: string) {
    return this.files.remove(user.sub, projectId, path);
  }

  @Post('rename')
  rename(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string, @Body() body: RenameDto) {
    return this.files.rename(user.sub, projectId, body.oldPath, body.newPath);
  }
}
