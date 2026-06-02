import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { UserController } from "./controllers/user.controller";
import { UserRepository } from "./repositories/user.repository";
import { UserService } from "./services/user.service";

// 🏗️ ARQUITECTURA: UsersModule — módulo autocontenido para gestión de usuarios
// Exporta UserService para que AuthModule pueda buscar usuarios por email al login
// ⚡ PRINCIPIO: Módulos como fronteras — solo se exporta lo necesario

@Module({
	imports: [DatabaseModule],
	controllers: [UserController],
	providers: [UserService, UserRepository],
	exports: [UserService, UserRepository],
})
export class UsersModule {}
