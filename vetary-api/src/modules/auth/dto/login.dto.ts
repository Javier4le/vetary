import { IsEmail, IsNotEmpty, IsString, IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

// 📐 PATRÓN DTO: Data Transfer Object — define el contrato de entrada del login
// ⚡ PRINCIPIO: Validate at the Border — nunca confiar en que el cliente manda datos bien formados

export class LoginDto {
	@ApiProperty({ example: "vet@clinica.com" })
	@IsEmail({}, { message: "Email must be a valid email address" })
	@IsNotEmpty()
	email!: string;

	@ApiProperty({ example: "SecurePass123!" })
	@IsString()
	@IsNotEmpty()
	password!: string;

	@ApiProperty({
		example: "tenant-uuid-123",
		description: "Tenant ID for the clinic",
	})
	@IsUUID()
	@IsNotEmpty()
	tenantId!: string;
}
