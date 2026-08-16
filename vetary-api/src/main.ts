import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ConfigService } from "./config/config.service";

// 🏗️ ARQUITECTURA: Bootstrap function — punto de entrada de la aplicación
// Configura toda la línea base de seguridad antes de empezar a escuchar requests.
//
// ⚡ PRINCIPIO: Defence in Depth — seguridad en múltiples capas:
//   1. Helmet (headers HTTP seguros)
//   2. CORS (orígenes controlados)
//   3. ValidationPipe (whitelist + forbidNonWhitelisted + transform)
//   4. ExceptionFilter (formato consistente de errores)
//   5. Global prefix (versionado de API: /api/v1)
//   6. Swagger (documentación de contrato)

async function bootstrap(): Promise<void> {
	const app = await NestFactory.create(AppModule);

	// ─── 1. Security Headers (Helmet) ───
	// 🔒 X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Strict-Transport-Security, etc.
	app.use(helmet());

	// ─── 2. CORS ───
	// 🔒 Orígenes configurados por variable de entorno (nunca '*' en producción)
	const configService = app.get(ConfigService);
	const allowedOrigins = configService.allowedOrigins;
	app.enableCors({
		origin: allowedOrigins.length > 0 ? allowedOrigins : undefined,
		credentials: true,
	});

	// ─── 3. Validación global de DTOs ───
	// ⚡ whitelist: ignora campos no declarados en el DTO
	// ⚡ forbidNonWhitelisted: rechaza requests con campos extra (fuerza contrato exacto)
	// ⚡ transform: convierte tipos automáticamente (e.g., string -> number con @Type())
	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			forbidNonWhitelisted: true,
			transform: true,
		}),
	);

	// ─── 4. Filtro global de excepciones ───
	// Formato consistente: { statusCode, message, error }
	app.useGlobalFilters(new HttpExceptionFilter());

	// ─── 5. Prefijo global de API ───
	app.setGlobalPrefix("api/v1");

	// ─── 6. Swagger / OpenAPI ───
	// Documentación interactiva disponible en /docs
	const swaggerConfig = new DocumentBuilder()
		.setTitle("Vetary API")
		.setDescription("Multi-tenant veterinary clinic management system")
		.setVersion("1.0.0")
		.addBearerAuth()
		.build();
	const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
	SwaggerModule.setup("docs", app, swaggerDocument);

	// ─── Start server ───
	const port = configService.port ?? 3000;
	await app.listen(port);

	console.log(`🚀 Vetary API running on http://localhost:${port}`);
	console.log(`📘 Swagger docs available at http://localhost:${port}/docs`);
}

bootstrap();
