import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

// 📐 PATRÓN DTO: Update — solo campos opcionales
// ⚡ PRINCIPIO: Partial Updates — el cliente solo envía lo que quiere cambiar
// Validación: si se envía un campo, debe cumplir con las restricciones

export class UpdateUserDto {
	@ApiProperty({ example: "Juan Carlos", required: false })
	@IsOptional()
	@IsString()
	@MinLength(2, { message: "First name must be at least 2 characters" })
	@MaxLength(50, { message: "First name cannot exceed 50 characters" })
	firstName?: string;

	@ApiProperty({ example: "Pérez García", required: false })
	@IsOptional()
	@IsString()
	@MinLength(2, { message: "Last name must be at least 2 characters" })
	@MaxLength(50, { message: "Last name cannot exceed 50 characters" })
	lastName?: string;

	@ApiProperty({ example: "NewSecurePass123", required: false })
	@IsOptional()
	@IsString()
	@MinLength(8, { message: "Password must be at least 8 characters" })
	@Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]+$/, {
		message: "Password must contain at least one letter and one number",
	})
	password?: string;
}
