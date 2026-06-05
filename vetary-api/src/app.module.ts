import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "./config/config.module";
import { DatabaseModule } from "./database/database.module";
import { CommonModule } from "./common/common.module";
import { AuthModule } from "./modules/auth/auth.module";
import { TenantsModule } from "./modules/tenants/tenants.module";
import { UsersModule } from "./modules/users/users.module";
import { TenantMiddleware } from "./common/middleware/tenant.middleware";

// 🏗️ ARQUITECTURA: AppModule es el módulo raíz
// Importa todos los módulos de funcionalidad y configura middleware global.
//
// ⚡ PRINCIPIO: Fail Fast — ConfigModule valida env vars en bootstrap.
// ⚡ PRINCIPIO: Segregación de responsabilidades — cada módulo tiene su dominio.
//
// 📐 Middleware chain (orden de ejecución):
//   1. TenantMiddleware (corre PRIMERO en TODAS las requests)
//   2. AuthGuard (APP_GUARD desde CommonModule)
//   3. TenantGuard (APP_GUARD desde CommonModule)
//   4. RolesGuard (APP_GUARD desde CommonModule)
//   5. Controller

@Module({
  imports: [
    ConfigModule, // ← Valida env vars al arrancar, disponible globalmente
    DatabaseModule, // ← PrismaService global, conexión única a PostgreSQL
    CommonModule, // ← Guards globales (AuthGuard → TenantGuard → RolesGuard)
    TenantsModule, // ← Registro de clínicas y gestión de tenants
    UsersModule, // ← Gestión de usuarios con scope por tenant
    AuthModule, // ← Autenticación JWT + Passport
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // 🏗️ ARQUITECTURA: TenantMiddleware corre en TODAS las rutas
    // Resuelve el tenant desde el subdomain antes de que cualquier guard ejecute.
    consumer
      .apply(TenantMiddleware)
      .forRoutes("*");
  }
}
