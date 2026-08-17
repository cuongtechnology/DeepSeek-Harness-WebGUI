import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FileWatcherService } from './file-watcher.service';
import { FilesGateway } from './files.gateway';

@Module({
  imports: [ProjectsModule],
  controllers: [FilesController],
  providers: [FilesService, FileWatcherService, FilesGateway],
  exports: [FilesService],
})
export class FilesModule {}
