import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { VetProfileRepository } from "./repositories/vet-profile.repository";

// 🏗️ ARQUITECTURA: VetProfilesModule — módulo de soporte para perfiles de veterinarios
// No expone controller ni service; solo provee VetProfileRepository para inyección en UsersModule
// ⚡ PRINCIPIO: Módulos como fronteras — el repositorio se comparte donde se necesite

@Module({
	imports: [DatabaseModule],
	providers: [VetProfileRepository],
	exports: [VetProfileRepository],
})
export class VetProfilesModule {}
