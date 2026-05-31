import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

// 🏗️ ARQUITECTURA: @CurrentTenant() decorator inyecta el tenant actual
// 📐 PATRÓN: Parameter Decorator — extrae tenant del request sin boilerplate

/**
 * @CurrentTenant() decorator
 * Inyecta el tenant actual (del subdomain) como parámetro del método
 *
 * Uso:
 * ```typescript
 * @Get('bookings')
 * async getBookings(@CurrentTenant() tenant: Tenant) {
 *   return this.bookingService.findAll(tenant.id);
 * }
 * ```
 *
 * ⚡ PRINCIPIO: Clean Code — elimina boilerplate (req.tenant) del controller
 * El tenant viene del TenantMiddleware (que resuelve el subdomain)
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenant; // Set by TenantMiddleware
  },
);
