import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CustomerInputDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 80)
  fullName!: string;

  @ApiProperty()
  @IsString()
  @Length(7, 16)
  phone!: string;

  @ApiProperty()
  @IsString()
  @Length(4, 20)
  legalId!: string;

  @ApiProperty({ enum: ['CC', 'CE', 'NIT', 'PP', 'TI', 'DNI', 'RG', 'OTHER'] })
  @IsEnum(['CC', 'CE', 'NIT', 'PP', 'TI', 'DNI', 'RG', 'OTHER'])
  legalIdType!: 'CC' | 'CE' | 'NIT' | 'PP' | 'TI' | 'DNI' | 'RG' | 'OTHER';
}

export class DeliveryInputDto {
  @ApiProperty()
  @IsString()
  @Length(5, 100)
  addressLine1!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 100)
  addressLine2?: string;

  @ApiProperty()
  @IsString()
  @Length(2, 60)
  city!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 60)
  region!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiProperty({ default: 'CO' })
  @IsString()
  @Length(2, 2)
  country!: string;

  @ApiProperty()
  @IsString()
  @Length(7, 16)
  phone!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 80)
  recipientName!: string;
}

export class StartCheckoutDto {
  @ApiProperty()
  @IsString()
  @Length(1, 40)
  productId!: string;

  @ApiProperty({ minimum: 1, maximum: 48 })
  @IsInt()
  @Min(1)
  @Max(48)
  hours!: number;

  @ApiProperty({ type: CustomerInputDto })
  @ValidateNested()
  @Type(() => CustomerInputDto)
  customer!: CustomerInputDto;

  @ApiProperty({ type: DeliveryInputDto })
  @ValidateNested()
  @Type(() => DeliveryInputDto)
  delivery!: DeliveryInputDto;
}

export class PayTransactionDto {
  @ApiProperty()
  @IsString()
  @Length(10, 120)
  cardToken!: string;

  @ApiProperty({ minimum: 1, maximum: 36 })
  @IsInt()
  @Min(1)
  @Max(36)
  installments!: number;

  @ApiProperty()
  @IsString()
  acceptanceToken!: string;

  @ApiProperty()
  @IsString()
  acceptPersonalAuth!: string;

  @ApiProperty({ enum: ['visa', 'mastercard', 'unknown'] })
  @IsEnum(['visa', 'mastercard', 'unknown'])
  cardBrand!: 'visa' | 'mastercard' | 'unknown';

  @ApiProperty()
  @IsString()
  @Length(4, 4)
  cardLast4!: string;
}

export class UpdateDeliveryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(5, 100)
  addressLine1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recipientName?: string;
}
