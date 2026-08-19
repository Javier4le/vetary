import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./prisma";

// 🏗️ ARQUITECTURA: PrismaService — Single database connection pool
// ⚡ PRINCIPIO: Singleton Pattern — una conexión compartida, no una por request
// OnModuleInit: conecta al arrancar, OnModuleDestroy: desconecta al cerrar

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(PrismaService.name);

	constructor() {
		const adapter = new PrismaPg({
			connectionString: process.env.DATABASE_URL,
		});
		super({ adapter });
	}

	async onModuleInit(): Promise<void> {
		// 📐 PATRÓN: Connection Lifecycle Management
		// Conectar al inicializar el módulo, no en cada query
		await this.$connect();
		this.logger.log("Database connection established");
	}

	async onModuleDestroy(): Promise<void> {
		// 📐 PATRÓN: Graceful Shutdown
		// Cerrar la conexión limpiamente al apagar la app
		await this.$disconnect();
		this.logger.log("Database connection closed");
	}
}
