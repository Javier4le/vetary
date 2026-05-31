import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// 🏗️ ARQUITECTURA: Bootstrap function — punto de entrada de la aplicación
// Aquí se configurará: Helmet, CORS, ValidationPipe, Swagger, Exception Filters
// Por ahora, solo arranca en el puerto configurado
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`🚀 Vetary API running on http://localhost:${port}`);
}

bootstrap();
