# STACK-nestjs.md — Traducción al stack NestJS
> Cómo se aplican los principios de AGENTS.md en NestJS + TypeScript + Prisma.
> Reutilizable en cualquier proyecto NestJS. Se lee en sesiones de backend.
> **Vive en:** la raíz del subproyecto backend (`vetary-api/`)

---

## Arquitectura en capas mapeada a NestJS

```
Presentation  → Controllers · Guards · Interceptors · Filters
Application   → Services · Use Cases · DTOs
Domain        → Entities · Business Rules · Domain Events
Infrastructure → Repositories · PrismaService · External APIs
```

Regla de dependencia: cada capa solo depende de las que están debajo. El dominio no conoce Prisma ni HTTP.

---

## TypeScript (cómo se aplica "máxima seguridad de tipos")

- Strict mode activado, sin excepciones
- Prohibido `any` — usar `unknown` y narrar el tipo
- Todas las funciones y métodos con tipo de retorno explícito
- Prohibido `as` sin un comentario que justifique el assertion
- Los tipos se definen donde se originan y se importan donde se usan

---

## Gestor de paquetes (regla del proyecto)

- Este proyecto usa **pnpm** como gestor de paquetes oficial.
- No usar `npm install` ni `yarn` para agregar dependencias en este repo.
- Comandos esperados: `pnpm install`, `pnpm add`, `pnpm remove`, `pnpm run <script>`.
- La fuente de verdad está en la raíz del monorepo: `packageManager: "pnpm@11.5.0"`.

---

## Calidad obligatoria antes de commit (backend)

- Todo cambio debe pasar lint y type-check antes de commit.
- Lint y tipado son barreras tempranas para detectar bugs de integración y regresiones.
- Comandos mínimos:
  - `pnpm --filter vetary-api lint`
  - `pnpm --filter vetary-api exec tsc --noEmit`

---

## Imports: preferir alias absoluto

- Preferir imports absolutos del proyecto (`@/...`) sobre rutas relativas profundas (`../../../...`).
- Motivo: código más legible y refactors más seguros al mover archivos/carpetas.

---

## Estructura interna de un módulo

```
modules/[feature]/
├── dto/              ← validación de entrada con class-validator
├── entities/         ← clases de dominio (no conocen Prisma)
├── repositories/     ← único lugar donde vive Prisma
├── services/         ← lógica de negocio
├── controllers/      ← HTTP handlers, sin lógica
├── events/           ← domain events (si aplica)
├── factories/        ← creación de objetos complejos (si aplica)
└── [feature].module.ts
```

Cada módulo es autocontenido. Un módulo no importa el service de otro directamente; se comunican vía eventos o a través de abstracciones.

---

## Reglas de capas en NestJS

- **Controllers** solo reciben, delegan al service y responden. Cero lógica de negocio.
- **Services** no importan `PrismaService` directamente — usan repositorios.
- **Repositories** no contienen lógica de negocio — solo acceso a datos.
- **Entities** del dominio no conocen ni Prisma ni HTTP.

---

## Repository Pattern: aquí es la elección correcta

A diferencia de Laravel (donde Eloquent es Active Record y el Repository sobra), en NestJS con Prisma el Repository tiene sentido real:

- Aísla Prisma: si cambia el ORM, solo se toca la carpeta `repositories/`
- Centraliza filtros de seguridad: cualquier filtro obligatorio (como aislamiento de datos) vive en un solo lugar y es imposible de olvidar

Cuando el proyecto requiere un filtro obligatorio en todas las queries, usar un `BaseRepository` del que heredan todos los repositorios concretos.

---

## DTOs y validación en el borde

Los DTOs validan con `class-validator` y `class-transformer`. Nunca confiar en que el cliente manda los datos bien formados.

```typescript
export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsEnum(Role)
  role: Role;
}
```

El `ValidationPipe` global (configurado en `main.ts`) aplica estas validaciones automáticamente con `whitelist: true` para rechazar campos no declarados.

---

## Configuración obligatoria de main.ts (seguridad baseline)

Antes de la primera feature, `main.ts` debe tener:

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cabeceras de seguridad HTTP
  app.use(helmet());

  // CORS explícito desde variable de entorno — nunca '*' en producción
  app.enableCors({ origin: process.env.CORS_ORIGIN?.split(','), credentials: true });

  // Validación global en el borde
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Prefijo de versión de API
  app.setGlobalPrefix('api/v1');

  // Swagger / OpenAPI desde el inicio (define el contrato front-back)
  const config = new DocumentBuilder().setTitle('API').setVersion('1.0').build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT ?? 3000);
}
```

---

## Validación de variables de entorno al arrancar

Si falta `JWT_SECRET` o `DATABASE_URL`, la app debe fallar al arrancar con un mensaje claro — no a mitad del primer login. Validar el `process.env` con un schema (class-validator o Zod) en el módulo de configuración.

---

## OpenAPI / Swagger desde el inicio

Gratis con los decoradores de NestJS. Define el contrato entre backend y frontend, lo que evita que el agente invente tipos al construir el frontend. Decorar DTOs y controllers con `@ApiProperty`, `@ApiResponse`, etc.

---

## Manejo de errores

- Usar las `HttpException` estándar de NestJS (`NotFoundException`, `BadRequestException`, etc.)
- Un `ExceptionFilter` global formatea todas las respuestas de error de forma consistente
- Nunca exponer stack traces ni detalles internos al cliente en producción

---

## Naming en NestJS

- Archivos y carpetas: `kebab-case` (`create-user.dto.ts`, `bookings.service.ts`)
- Clases: `PascalCase` (`BookingService`, `BookingRepository`)
- Repositorios: `BookingRepository`, no `BookingRepo` ni `BookingDAO`
- Services: `BookingService`, no `BookingManager`

---

## ✅ Checklist de cierre de feature (backend NestJS)

- [ ] La estructura sigue las capas: controller → service → repository
- [ ] El controller no tiene lógica de negocio
- [ ] El service no importa `PrismaService` directamente
- [ ] Los DTOs validan con class-validator y el ValidationPipe los aplica
- [ ] Los endpoints sensibles tienen rate limiting
- [ ] No hay `any` sin justificación comentada
- [ ] Las variables de entorno nuevas están validadas al arranque y en `.env.example`
- [ ] Los endpoints están documentados en Swagger
- [ ] Hay tests para la lógica crítica y el aislamiento de datos
- [ ] No hay secretos hardcodeados
