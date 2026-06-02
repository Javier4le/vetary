import { IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

// 📐 PATRÓN DTO: Data Transfer Object — define el contrato de entrada para refresh/logout
// ⚡ PRINCIPIO: Validate at the Border — el refresh token viaja en body por seguridad (no en URL)

export class RefreshTokenDto {
	@ApiProperty({
		example: "550e8400-e29b-41d4-a716-446655440000",
		description: "Refresh token string returned by login",
	})
	@IsString()
	@IsNotEmpty({ message: "Refresh token is required" })
	refreshToken!: string;
}
