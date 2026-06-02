import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';

// 🏗️ ARQUITECTURA: AppModule es el módulo raíz
// Aquí se importan todos los módulos de funcionalidad (Tenants, Auth, Users)
// Se configura en fases: primero infraestructura (Config, Prisma), luego features
@Module({
  imports: [
    ConfigModule, // ← Valida env vars al arrancar, disponible globalmente
    DatabaseModule, // ← PrismaService global, conexión única a PostgreSQL
    TenantsModule, // ← Registro de clínicas y gestión de tenants
    UsersModule, // ← Gestión de usuarios con scope por tenant
    AuthModule, // ← Autenticación JWT + Passport
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
