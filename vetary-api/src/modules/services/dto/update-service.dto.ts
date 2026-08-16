import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString, Min } from "class-validator";

// 📐 PATRÓN DTO: Update — solo campos opcionales
// ⚡ PRINCIPIO: Partial Updates — el cliente solo envía lo que quiere cambiar
// Validación: si se envía un campo, debe cumplir con las restricciones

export class UpdateServiceDto {
	@ApiProperty({ example: "Consulta General — Actualizada", required: false })
	@IsOptional()
	@IsString()
	name?: string;

	@ApiProperty({ example: "Nueva descripción del servicio", required: false })
	@IsOptional()
	@IsString()
	description?: string;

	@ApiProperty({ example: 45, required: false })
	@IsOptional()
	@IsInt({ message: "Duration must be an integer" })
	@Min(1, { message: "Duration must be at least 1 minute" })
	durationMinutes?: number;

	@ApiProperty({ example: 30000, required: false })
	@IsOptional()
	@IsInt({ message: "Price must be an integer" })
	@Min(0, { message: "Price cannot be negative" })
	priceClp?: number;

	@ApiProperty({ example: false, required: false, description: "Activo o inactivo" })
	@IsOptional()
	@IsBoolean()
	isActive?: boolean;
}
