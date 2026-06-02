import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { TenantController } from "./controllers/tenant.controller";
import { TenantRepository } from "./repositories/tenant.repository";
import { TenantService } from "./services/tenant.service";

// 🏗️ ARQUITECTURA: TenantsModule — módulo autocontenido para gestión de clínicas
// Exporta TenantService para que AuthModule pueda verificar si un tenant existe al login
// ⚡ PRINCIPIO: Módulos como fronteras — solo se exporta lo necesario

@Module({
	imports: [DatabaseModule], // ← PrismaService disponible para TenantService y TenantRepository
	controllers: [TenantController],
	providers: [TenantService, TenantRepository],
	exports: [TenantService, TenantRepository],
})
export class TenantsModule {}
