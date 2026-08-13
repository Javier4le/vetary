import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { VetProfileRepository } from "./repositories/vet-profile.repository";

// 🏗️ ARQUITECTURA: VetProfilesModule — módulo de soporte para perfiles de veterinarios
// No expone controller ni service; provee VetProfileRepository para lecturas tenant-scoped
// y otros módulos. Las escrituras atómicas de createVet usan el cliente de transacción de Prisma.
// ⚡ PRINCIPIO: Módulos como fronteras — el repositorio se comparte donde se necesite

@Module({
	imports: [DatabaseModule],
	providers: [VetProfileRepository],
	exports: [VetProfileRepository],
})
export class VetProfilesModule {}
