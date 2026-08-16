import { IsEmail, IsString, Matches, MaxLength, MinLength } from "class-validator";

// 📐 PATRÓN DTO: Data Transfer Object — define el contrato de entrada de la API
// class-validator valida automáticamente gracias al ValidationPipe global en main.ts
// ⚡ PRINCIPIO: Validate at the Border — nunca confiar en que el cliente manda datos bien formados

export class RegisterTenantDto {
	@IsString()
	@MinLength(2, { message: "Clinic name must be at least 2 characters" })
	@MaxLength(100, { message: "Clinic name cannot exceed 100 characters" })
	tenantName!: string;

	// 🔒 SEGURIDAD: Regex estricto para subdominios
	// Solo minúsculas, números y guiones — sin espacios ni caracteres especiales
	// Mínimo 3, máximo 63 (límite DNS)
	@IsString()
	@MinLength(3, { message: "Subdomain must be at least 3 characters" })
	@MaxLength(63, {
		message: "Subdomain cannot exceed 63 characters (DNS limit)",
	})
	@Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
		message: "Subdomain can only contain lowercase letters, numbers, and hyphens (e.g. mi-clinica)",
	})
	subdomain!: string;

	@IsEmail({}, { message: "Admin email must be a valid email address" })
	adminEmail!: string;

	@IsString()
	@MinLength(8, { message: "Password must be at least 8 characters" })
	adminPassword!: string;

	@IsString()
	@MinLength(1, { message: "First name is required" })
	adminFirstName!: string;

	@IsString()
	@MinLength(1, { message: "Last name is required" })
	adminLastName!: string;
}
