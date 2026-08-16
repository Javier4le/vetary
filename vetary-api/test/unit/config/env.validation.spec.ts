// 🧪 TEST: Environment variable validation (Strict TDD - RED phase)
// ⚡ PRINCIPIO: Fail Fast — validar variables al arrancar, no en runtime

import "reflect-metadata"; // Required for class-validator decorators
import { validate } from "../../../src/config/env.validation";

describe("Environment Validation (RED → GREEN → REFACTOR)", () => {
	const validEnv = {
		NODE_ENV: "development",
		PORT: "3000",
		DATABASE_URL: "postgresql://user:pass@localhost:5432/vetary_dev",
		JWT_SECRET: "this-is-a-valid-secret-with-at-least-32-characters",
		JWT_EXPIRATION: "15m",
		REFRESH_TOKEN_EXPIRATION: "7d",
		BCRYPT_ROUNDS: "10",
		ALLOWED_ORIGINS: "http://localhost:3001",
	};

	describe("✅ Valid environment with all required vars", () => {
		it("should pass validation", () => {
			expect(() => validate(validEnv)).not.toThrow();
		});
	});

	describe("❌ Missing required variables", () => {
		it("should throw error when DATABASE_URL is missing", () => {
			const { DATABASE_URL, ...envWithoutDb } = validEnv;
			expect(() => validate(envWithoutDb)).toThrow(/DATABASE_URL/);
		});

		it("should throw error when JWT_SECRET is missing", () => {
			const { JWT_SECRET, ...envWithoutSecret } = validEnv;
			expect(() => validate(envWithoutSecret)).toThrow(/JWT_SECRET/);
		});

		it("should throw error when JWT_EXPIRATION is missing", () => {
			const { JWT_EXPIRATION, ...envWithoutExpiration } = validEnv;
			expect(() => validate(envWithoutExpiration)).toThrow(/JWT_EXPIRATION/);
		});

		it("should throw error when BCRYPT_ROUNDS is missing", () => {
			const { BCRYPT_ROUNDS, ...envWithoutBcrypt } = validEnv;
			expect(() => validate(envWithoutBcrypt)).toThrow(/BCRYPT_ROUNDS/);
		});
	});

	describe("❌ JWT_SECRET too short (< 32 characters)", () => {
		it("should throw error", () => {
			const envWithShortSecret = {
				...validEnv,
				JWT_SECRET: "too-short",
			};
			expect(() => validate(envWithShortSecret)).toThrow(/JWT_SECRET/);
			expect(() => validate(envWithShortSecret)).toThrow(/at least 32 characters/);
		});
	});

	describe("❌ CORS wildcard in production", () => {
		it("should throw error when ALLOWED_ORIGINS is * and NODE_ENV is production", () => {
			const envWithWildcard = {
				...validEnv,
				NODE_ENV: "production",
				ALLOWED_ORIGINS: "*",
			};
			expect(() => validate(envWithWildcard)).toThrow(/CORS wildcard/);
			expect(() => validate(envWithWildcard)).toThrow(/not allowed in production/);
		});

		it("should allow wildcard in development", () => {
			const envWithWildcard = {
				...validEnv,
				NODE_ENV: "development",
				ALLOWED_ORIGINS: "*",
			};
			expect(() => validate(envWithWildcard)).not.toThrow();
		});
	});

	describe("✅ ALLOWED_ORIGINS as comma-separated list", () => {
		it("should parse correctly", () => {
			const envWithMultipleOrigins = {
				...validEnv,
				ALLOWED_ORIGINS: "http://localhost:3001,https://vetary.app,https://*.vetary.app",
			};
			const result = validate(envWithMultipleOrigins);
			expect(result.allowedOrigins).toEqual([
				"http://localhost:3001",
				"https://vetary.app",
				"https://*.vetary.app",
			]);
		});
	});

	describe("❌ Invalid NODE_ENV value", () => {
		it("should throw error when NODE_ENV is not development, production, or test", () => {
			const envWithInvalidNodeEnv = {
				...validEnv,
				NODE_ENV: "invalid",
			};
			expect(() => validate(envWithInvalidNodeEnv)).toThrow(/NODE_ENV/);
		});
	});

	describe("❌ Invalid PORT value", () => {
		it("should throw error when PORT is not a number", () => {
			const envWithInvalidPort = {
				...validEnv,
				PORT: "not-a-number",
			};
			expect(() => validate(envWithInvalidPort)).toThrow(/PORT/);
		});

		it("should throw error when PORT is out of range", () => {
			const envWithInvalidPort = {
				...validEnv,
				PORT: "70000", // Above 65535
			};
			expect(() => validate(envWithInvalidPort)).toThrow(/PORT/);
		});
	});

	describe("❌ Invalid BCRYPT_ROUNDS value", () => {
		it("should throw error when BCRYPT_ROUNDS is not between 8 and 12", () => {
			const envWithInvalidBcrypt = {
				...validEnv,
				BCRYPT_ROUNDS: "5", // Too low
			};
			expect(() => validate(envWithInvalidBcrypt)).toThrow(/BCRYPT_ROUNDS/);
		});
	});
});
