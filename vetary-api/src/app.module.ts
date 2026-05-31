import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';

// 🏗️ ARQUITECTURA: AppModule es el módulo raíz
// Aquí se importan todos los módulos de funcionalidad (Tenants, Auth, Users)
// Se configura en fases: primero infraestructura (Config, Prisma), luego features
@Module({
  imports: [
    ConfigModule, // ← Valida env vars al arrancar, disponible globalmente
    DatabaseModule, // ← PrismaService global, conexión única a PostgreSQL
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
