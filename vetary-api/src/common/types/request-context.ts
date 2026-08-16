import type { Role } from "@prisma/client";

export interface TenantContext {
	id: string;
	name: string;
	subdomain: string;
	status: string;
}

export interface AuthenticatedUser {
	userId: string;
	tenantId: string;
	role: Role;
	email: string;
}
