import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

// 🏗️ ARQUITECTURA: DatabaseModule global — PrismaService disponible en toda la app
// ⚡ PRINCIPIO: Dependency Injection — los repositorios inyectan PrismaService
// No hay new PrismaService() esparcido por el código — un solo punto de control

@Global() // ← Hace que PrismaService esté disponible globalmente sin importar el módulo
@Module({
	providers: [PrismaService],
	exports: [PrismaService], // ← Exporta para que otros módulos puedan inyectarlo
})
export class DatabaseModule {}
