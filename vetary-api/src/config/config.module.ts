import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ConfigService } from './config.service';
import { validate } from './env.validation';

// 🏗️ ARQUITECTURA: ConfigModule global - disponible en toda la app sin importarlo
// ⚡ PRINCIPIO: Fail Fast — valida variables al arrancar con la función validate()
// Si falta JWT_SECRET o DATABASE_URL, la app falla de inmediato con mensaje claro

@Global() // ← Hace que ConfigService esté disponible globalmente
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validate, // ← Función que valida env vars al arrancar
      envFilePath: '.env',
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
