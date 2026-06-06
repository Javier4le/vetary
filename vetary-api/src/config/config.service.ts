import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from './env.validation';

// 🏗️ ARQUITECTURA: ConfigService centraliza acceso tipado a variables de entorno
// ⚡ PRINCIPIO: Single Source of Truth — un solo lugar para leer configuración
// Evita process.env.VAR esparcido por el código — difícil de trackear y testear

@Injectable()
export class ConfigService {
  constructor(
    private readonly nestConfigService: NestConfigService<
      EnvironmentVariables,
      true
    >,
  ) {}

  get nodeEnv(): 'development' | 'production' | 'test' {
    return this.nestConfigService.get('NODE_ENV', { infer: true });
  }

  get port(): number {
    return this.nestConfigService.get('PORT', { infer: true });
  }

  get databaseUrl(): string {
    return this.nestConfigService.get('DATABASE_URL', { infer: true });
  }

  get jwtSecret(): string {
    return this.nestConfigService.get('JWT_SECRET', { infer: true });
  }

  get jwtExpiration(): string {
    return this.nestConfigService.get('JWT_EXPIRATION', { infer: true });
  }

  get refreshTokenExpiration(): string {
    return this.nestConfigService.get('REFRESH_TOKEN_EXPIRATION', {
      infer: true,
    });
  }

  get bcryptRounds(): number {
    return this.nestConfigService.get('BCRYPT_ROUNDS', { infer: true });
  }

  get allowedOrigins(): string[] {
    const origins = this.nestConfigService.get('ALLOWED_ORIGINS', {
      infer: true,
    });
    return origins.split(',').map((origin) => origin.trim());
  }

  get defaultTenantSubdomain(): string | undefined {
    return this.nestConfigService.get('DEFAULT_TENANT_SUBDOMAIN', {
      infer: true,
    });
  }

  get rateLimitEnabled(): boolean {
    const value = this.nestConfigService.get('RATE_LIMIT_ENABLED', {
      infer: true,
    });
    return value !== 'false';
  }

  // 🔧 Helper: check if running in production
  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  // 🔧 Helper: check if running in development
  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  // 🔧 Helper: check if running in test
  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }
}
