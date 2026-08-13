import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { ConfigModule } from "./config/config.module";
import { DatabaseModule } from "./database/database.module";
import { CommonModule } from "./common/common.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ServicesModule } from "./modules/services/services.module";
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
//   1. TenantMiddleware (corre PRIMERO en TODAS las requests, excepto rutas excluidas)
//   2. AuthGuard (APP_GUARD desde CommonModule)
//   3. TenantGuard (APP_GUARD desde CommonModule)
//   4. RolesGuard (APP_GUARD desde CommonModule)
//   5. Controller

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    CommonModule,
    // 🔒 SEGURIDAD: Rate limiting — default 10 req/60s, auth endpoints 5 req/60s
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
    TenantsModule,
    UsersModule,
    ServicesModule,
    AuthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // 🏗️ ARQUITECTURA: TenantMiddleware corre en TODAS las rutas EXCEPTO rutas públicas
    // que no requieren tenant context: register, login, refresh.
    // El propio middleware maneja estas exclusiones via PUBLIC_PATHS.
    consumer
      .apply(TenantMiddleware)
      .forRoutes("*");
  }
}
