import { Module } from '@nestjs/common';

// 🏗️ ARQUITECTURA: AppModule es el módulo raíz
// Aquí se importan todos los módulos de funcionalidad (Tenants, Auth, Users)
// Se configura en fases: primero infraestructura (Config, Prisma), luego features
@Module({
  imports: [],
  controllers: [],
  providers: [],
})
export class AppModule {}
