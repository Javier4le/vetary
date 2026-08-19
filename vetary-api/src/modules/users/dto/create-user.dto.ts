import type { Role } from "@/database/prisma";
import { ApiProperty } from "@nestjs/swagger";
import {
	IsEmail,
	IsEnum,
	IsNotEmpty,
	IsString,
	Matches,
	MaxLength,
	MinLength,
} from "class-validator";

// 📐 PATRÓN DTO: Data Transfer Object — define el contrato de entrada de la API
// ⚡ PRINCIPIO: Válida en el borde — nunca confiar en que el cliente manda datos bien formados

export class CreateUserDto {
	@ApiProperty({ example: "newvet@example.com" })
	@IsEmail({}, { message: "Email must be a valid email address" })
	email!: string;

	@ApiProperty({ example: "SecurePass123", description: "Minimum 8 characters" })
	@IsNotEmpty()
	@MinLength(8, { message: "Password must be at least 8 characters" })
	@Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]+$/, {
		message: "Password must contain at least one letter and one number",
	})
	password!: string;

	@ApiProperty({ example: "Carlos" })
	@IsString()
	@MinLength(2, { message: "First name must be at least 2 characters" })
	@MaxLength(50, { message: "First name cannot exceed 50 characters" })
	firstName!: string;

	@ApiProperty({ example: "Gómez" })
	@IsString()
	@MinLength(2, { message: "Last name must be at least 2 characters" })
	@MaxLength(50, { message: "Last name cannot exceed 50 characters" })
	lastName!: string;

	@ApiProperty({ enum: ["ADMIN", "VET", "STAFF"], example: "VET" })
	@IsEnum(["ADMIN", "VET", "STAFF"], { message: "Role must be ADMIN, VET, or STAFF" })
	role!: Role;
}
