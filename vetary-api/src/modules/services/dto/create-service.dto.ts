import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

// 📐 PATRÓN DTO: Data Transfer Object — define el contrato de entrada de la API para crear un servicio
// ⚡ PRINCIPIO: Válida en el borde — nunca confiar en que el cliente manda datos bien formados

export class CreateServiceDto {
	@ApiProperty({ example: "Consulta General", description: "Nombre del servicio" })
	@IsString()
	@IsNotEmpty({ message: "Name is required" })
	name!: string;

	@ApiProperty({ example: "Consulta veterinaria general", required: false })
	@IsOptional()
	@IsString()
	description?: string;

	@ApiProperty({ example: 30, description: "Duración en minutos" })
	@IsInt({ message: "Duration must be an integer" })
	@Min(1, { message: "Duration must be at least 1 minute" })
	durationMinutes!: number;

	@ApiProperty({ example: 25000, description: "Precio en CLP" })
	@IsInt({ message: "Price must be an integer" })
	@Min(0, { message: "Price cannot be negative" })
	priceClp!: number;
}
