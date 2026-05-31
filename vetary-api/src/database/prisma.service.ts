import { Injectable, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// 🏗️ ARQUITECTURA: PrismaService — Single database connection pool
// ⚡ PRINCIPIO: Singleton Pattern — una conexión compartida, no una por request
// OnModuleInit: conecta al arrancar, OnModuleDestroy: desconecta al cerrar

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    // 📐 PATRÓN: Connection Lifecycle Management
    // Conectar al inicializar el módulo, no en cada query
    await this.$connect();
    console.log('✅ Database connection established');
  }

  async onModuleDestroy(): Promise<void> {
    // 📐 PATRÓN: Graceful Shutdown
    // Cerrar la conexión limpiamente al apagar la app
    await this.$disconnect();
    console.log('🔌 Database connection closed');
  }
}
