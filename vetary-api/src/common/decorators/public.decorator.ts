import { SetMetadata } from "@nestjs/common";

// 🏗️ ARQUITECTURA: @Public() decorator marca rutas públicas (sin autenticación)
// 📐 PATRÓN: Decorator Pattern — añade metadata sin modificar el método
// Guards leen esta metadata para decidir si validar JWT o no

export const IS_PUBLIC_KEY = "isPublic";

/**
 * @Public() decorator
 * Marca una ruta como pública (no requiere autenticación)
 *
 * Uso:
 * ```typescript
 * @Post('login')
 * @Public()
 * async login(@Body() dto: LoginDto) {
 *   return this.authService.login(dto);
 * }
 * ```
 *
 * ⚡ PRINCIPIO: Explicit over Implicit — una ruta es privada por defecto,
 * solo las marcadas con @Public() son accesibles sin JWT
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
