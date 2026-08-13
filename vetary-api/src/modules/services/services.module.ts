import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { ServiceController } from "./controllers/service.controller";
import { ServiceRepository } from "./repositories/service.repository";
import { ServicesService } from "./services/service.service";

// 🏗️ ARQUITECTURA: ServicesModule — módulo autocontenido para gestión de servicios
// Exporta ServicesService para que otros módulos puedan usarlo (ej: bookings)
// ⚡ PRINCIPIO: Módulos como fronteras — solo se exporta lo necesario

@Module({
	imports: [DatabaseModule],
	controllers: [ServiceController],
	providers: [ServicesService, ServiceRepository],
	exports: [ServicesService, ServiceRepository],
})
export class ServicesModule {}
