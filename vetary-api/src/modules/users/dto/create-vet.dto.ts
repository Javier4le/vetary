import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

// 📐 PATRÓN DTO: Data Transfer Object para creación de veterinarios
// ⚡ PRINCIPIO: Válida en el borde — nunca confiar en que el cliente manda datos bien formados
// 🏗️ ARQUITECTURA: No incluye password ni rol; el rol se fija como VET server-side

export class CreateVetDto {
	@ApiProperty({ example: "newvet@example.com" })
	@IsEmail({}, { message: "Email must be a valid email address" })
	email!: string;

	@ApiProperty({ example: "Carlos" })
	@IsString()
	@IsNotEmpty()
	@MinLength(2, { message: "First name must be at least 2 characters" })
	@MaxLength(50, { message: "First name cannot exceed 50 characters" })
	firstName!: string;

	@ApiProperty({ example: "Gómez" })
	@IsString()
	@IsNotEmpty()
	@MinLength(2, { message: "Last name must be at least 2 characters" })
	@MaxLength(50, { message: "Last name cannot exceed 50 characters" })
	lastName!: string;

	@ApiPropertyOptional({ example: "Cirugía veterinaria" })
	@IsString()
	@IsOptional()
	specialty?: string;

	@ApiPropertyOptional({ example: "REG-123456" })
	@IsString()
	@IsOptional()
	registrationNumber?: string;

	@ApiPropertyOptional({ example: "Especialista en cirugía de pequeños animales" })
	@IsString()
	@IsOptional()
	bio?: string;
}
