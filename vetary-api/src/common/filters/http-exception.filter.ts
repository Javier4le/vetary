import {
	type ArgumentsHost,
	Catch,
	type ExceptionFilter,
	HttpException,
	HttpStatus,
} from "@nestjs/common";
import type { Request, Response } from "express";

// 🏗️ ARQUITECTURA: Global HTTP Exception Filter — formato consistente de errores
// 📐 PATRÓN: Exception Filter Pattern — captura y transforma excepciones antes de responder
// 🔒 SEGURIDAD: NO expone stack traces en producción

/**
 * HttpExceptionFilter
 *
 * Captura todas las HttpException y las formatea consistentemente:
 * {
 *   statusCode: number,
 *   message: string | string[],
 *   error: string,
 *   timestamp: string,
 *   path: string
 * }
 *
 * ⚡ PRINCIPIO: Consistent Error Format — el frontend siempre recibe la misma estructura
 * No hay sorpresas: siempre hay statusCode, message, error
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
	catch(exception: HttpException, host: ArgumentsHost): void {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest<Request>();
		const status = exception.getStatus();

		const exceptionResponse = exception.getResponse();
		const message =
			typeof exceptionResponse === "object" &&
			"message" in exceptionResponse &&
			exceptionResponse.message
				? exceptionResponse.message
				: exception.message;

		// 🔒 SEGURIDAD: En producción, NO exponer stack traces ni detalles internos
		const errorResponse = {
			statusCode: status,
			message,
			error: HttpStatus[status] || "Error",
			timestamp: new Date().toISOString(),
			path: request.url,
		};

		response.status(status).json(errorResponse);
	}
}
