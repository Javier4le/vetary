import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { UsersModule } from "../users/users.module";
import { AvailabilityController } from "./controllers/availability.controller";
import { AvailabilityRepository } from "./repositories/availability.repository";
import { AvailabilityService } from "./services/availability.service";

// 🏗️ ARQUITECTURA: AvailabilityModule — módulo autocontenido para disponibilidad
// Depende de UsersModule para verificar membresía del veterinario en el tenant
// ⚡ PRINCIPIO: Módulos como fronteras — solo expone lo necesario

@Module({
	imports: [DatabaseModule, UsersModule],
	controllers: [AvailabilityController],
	providers: [AvailabilityService, AvailabilityRepository],
	exports: [AvailabilityService, AvailabilityRepository],
})
export class AvailabilityModule {}
