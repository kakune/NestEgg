import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class CreatePersonalAccessTokenDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}
