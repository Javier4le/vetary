import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from "class-validator";

// 📐 PATRÓN DTO: Data Transfer Object para creación de personal administrativo
// ⚡ PRINCIPIO: Válida en el borde — nunca confiar en que el cliente manda datos bien formados
// 🏗️ ARQUITECTURA: No incluye rol; el rol se fija como STAFF server-side

export class CreateStaffDto {
	@ApiProperty({ example: "staff@example.com" })
	@IsEmail({}, { message: "Email must be a valid email address" })
	email!: string;

	@ApiProperty({ example: "SecurePass123!", description: "Minimum 8 characters" })
	@IsNotEmpty()
	@MinLength(8, { message: "Password must be at least 8 characters" })
	@Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]+$/, {
		message: "Password must contain at least one letter and one number",
	})
	password!: string;

	@ApiProperty({ example: "Ana" })
	@IsString()
	@IsNotEmpty()
	@MinLength(2, { message: "First name must be at least 2 characters" })
	@MaxLength(50, { message: "First name cannot exceed 50 characters" })
	firstName!: string;

	@ApiProperty({ example: "Torres" })
	@IsString()
	@IsNotEmpty()
	@MinLength(2, { message: "Last name must be at least 2 characters" })
	@MaxLength(50, { message: "Last name cannot exceed 50 characters" })
	lastName!: string;
}
