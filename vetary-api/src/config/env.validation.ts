// 🏗️ ARQUITECTURA: Environment validation with class-validator
// ⚡ PRINCIPIO: Fail Fast — validar variables al arrancar, no en runtime
// Si falta un secreto, la app debe fallar de inmediato con mensaje claro

import {
  IsString,
  IsNumber,
  IsEnum,
  IsNotEmpty,
  Min,
  Max,
  MinLength,
  validateSync,
} from 'class-validator';
import { plainToInstance, Type } from 'class-transformer';

// 📐 PATRÓN: DTO de validación con decoradores class-validator
// Cada variable de entorno tiene su tipo y restricciones explícitas
export class EnvironmentVariables {
  @IsEnum(['development', 'production', 'test'])
  NODE_ENV!: 'development' | 'production' | 'test';

  @IsNumber()
  @Min(1)
  @Max(65535)
  @Type(() => Number)
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(32, {
    message: 'JWT_SECRET must be at least 32 characters for security',
  })
  JWT_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_EXPIRATION!: string;

  @IsString()
  @IsNotEmpty()
  REFRESH_TOKEN_EXPIRATION!: string;

  @IsNumber()
  @Min(8, { message: 'BCRYPT_ROUNDS must be at least 8' })
  @Max(12, { message: 'BCRYPT_ROUNDS must be at most 12 for performance' })
  @Type(() => Number)
  BCRYPT_ROUNDS!: number;

  @IsString()
  @IsNotEmpty()
  ALLOWED_ORIGINS!: string;

  // Opcional: solo para desarrollo local
  DEFAULT_TENANT_SUBDOMAIN?: string;

  RATE_LIMIT_ENABLED?: string;

  // 🔒 SEGURIDAD: Propiedad computada - array de origins parseado
  get allowedOrigins(): string[] {
    return this.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim());
  }
}

// 🔒 SEGURIDAD: Función de validación que NestJS llama al arrancar
// Si la validación falla, la app no arranca
export function validate(
  config: Record<string, unknown>,
): EnvironmentVariables {
  // Transform plain object to class instance
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  // Validate using class-validator decorators
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
    forbidUnknownValues: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors
      .map((error) => {
        const constraints = error.constraints || {};
        return Object.values(constraints).join(', ');
      })
      .join('\n');

    throw new Error(`Environment validation failed:\n${errorMessages}`);
  }

  // 🔒 SEGURIDAD: Custom validation - CORS wildcard in production
  if (
    validatedConfig.NODE_ENV === 'production' &&
    validatedConfig.ALLOWED_ORIGINS === '*'
  ) {
    throw new Error(
      'CORS wildcard (*) is not allowed in production for security reasons',
    );
  }

  return validatedConfig;
}
