import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { GitController } from './git.controller';
import { GitApiService } from './git.service';

@Module({
  imports: [ProjectsModule],
  controllers: [GitController],
  providers: [GitApiService],
})
export class GitModule {}
