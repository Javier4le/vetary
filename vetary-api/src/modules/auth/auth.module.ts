import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule } from "../../config/config.module";
import { ConfigService } from "../../config/config.service";
import { DatabaseModule } from "../../database/database.module";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./controllers/auth.controller";
import { AuthService } from "./services/auth.service";
import { JwtStrategy } from "./strategies/jwt.strategy";

// 🏗️ ARQUITECTURA: AuthModule — módulo de autenticación
// Provee: JWT signing/verification + Passport strategy + AuthService + AuthController
// Depende de: UsersModule (para buscar usuarios al login), ConfigModule (para secret)
//
// 📐 PATRÓN: Module as Dependency Boundary
// AuthModule encapsula toda la lógica de autenticación.
// Otros módulos que necesiten auth importan AuthModule.

@Module({
	imports: [
		// 🔒 SEGURIDAD: JwtModule.firma tokens con JWT_SECRET del ConfigService
		JwtModule.registerAsync({
			imports: [ConfigModule],
			useFactory: (configService: {
				jwtSecret: string;
				jwtExpiration: string;
			}) => ({
				secret: configService.jwtSecret,
				signOptions: {
					// ⚡ PRINCIPIO: Defence in Depth — exp corto en token, largo en DB
					// Access token: 15 minutos. Refresh token: 7 días (en DB).
					expiresIn: configService.jwtExpiration,
				},
			}),
			inject: [ConfigService],
		}),
		PassportModule.register({ defaultStrategy: "jwt" }),
		ConfigModule,
		DatabaseModule,
		UsersModule,
	],
	controllers: [AuthController],
	// JwtStrategy se registra automáticamente como provider de Passport
	providers: [JwtStrategy, AuthService],
	// Exportamos AuthService para que otros módulos puedan usar métodos de auth
	exports: [AuthService],
})
export class AuthModule {}
