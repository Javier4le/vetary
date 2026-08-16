import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsString, Matches, Max, Min } from "class-validator";

// 📐 PATRÓN DTO: Define el contrato de entrada para un bloque de disponibilidad
// ⚡ PRINCIPIO: Validar en el borde — día de la semana y rango horario bien formados

export class CreateAvailabilityDto {
	@ApiProperty({ example: 1, description: "Day of week (0=Sunday, 6=Saturday)" })
	@IsInt()
	@Min(0)
	@Max(6)
	dayOfWeek!: number;

	@ApiProperty({ example: "09:00", description: "Start time in HH:mm format" })
	@IsString()
	@Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
	startTime!: string;

	@ApiProperty({ example: "13:00", description: "End time in HH:mm format" })
	@IsString()
	@Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
	endTime!: string;
}
