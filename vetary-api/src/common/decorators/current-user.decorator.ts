import { type ExecutionContext, createParamDecorator } from "@nestjs/common";

// 🏗️ ARQUITECTURA: @CurrentUser() decorator inyecta el usuario autenticado
// 📐 PATRÓN: Parameter Decorator — extrae data del request sin boilerplate

/**
 * @CurrentUser() decorator
 * Inyecta el usuario actual (del JWT) como parámetro del método
 *
 * Uso:
 * ```typescript
 * @Get('me')
 * async getProfile(@CurrentUser() user: JwtPayload) {
 *   return this.userService.findById(user.userId);
 * }
 * ```
 *
 * ⚡ PRINCIPIO: Clean Code — elimina boilerplate (req.user) del controller
 * El developer ve directamente qué data necesita el método
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
	const request = ctx.switchToHttp().getRequest();
	return request.user; // Set by AuthGuard after JWT validation
});
