import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ enum: ['empty', 'git', 'local'], default: 'empty' })
  @IsIn(['empty', 'git', 'local'])
  sourceKind: 'empty' | 'git' | 'local' = 'empty';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  sourceUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  sourcePath?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  sourceBranch?: string;

  @ApiProperty({ enum: ['host', 'docker'], default: 'host' })
  @IsIn(['host', 'docker'])
  sandboxKind: 'host' | 'docker' = 'host';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  sandboxImage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adapterId?: string;
}

export class UpdateProjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
