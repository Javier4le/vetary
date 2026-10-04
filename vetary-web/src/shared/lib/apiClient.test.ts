import { createApiClient } from "@/shared/lib/apiClient";
import type { AxiosAdapter, AxiosResponse } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";

function createHeaderSinkAdapter(sink: { authorization: string | null }): AxiosAdapter {
	return async (config) => {
		const value = config.headers?.get("Authorization");
		sink.authorization = typeof value === "string" ? value : null;
		const response: AxiosResponse = {
			data: {},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
		return response;
	};
}

describe("createApiClient", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("reads the token dynamically on every request", async () => {
		let currentToken: string | null = null;
		const client = createApiClient(() => currentToken);
		const sink: { authorization: string | null } = { authorization: null };
		client.defaults.adapter = createHeaderSinkAdapter(sink);

		await client.get("/ping");
		expect(sink.authorization).toBeNull();

		currentToken = "token-a";
		await client.get("/ping");
		expect(sink.authorization).toBe("Bearer token-a");

		currentToken = "token-b";
		await client.get("/ping");
		expect(sink.authorization).toBe("Bearer token-b");
	});

	it("attaches the header in the request phase, before the adapter runs", async () => {
		const client = createApiClient(() => "request-phase-token");
		const sink: { authorization: string | null } = { authorization: null };
		client.defaults.adapter = createHeaderSinkAdapter(sink);

		await client.get("/ping");
		expect(sink.authorization).toBe("Bearer request-phase-token");
	});

	it("defaults the baseURL to the same-origin /api/v1", () => {
		const client = createApiClient(() => null);
		expect(client.defaults.baseURL).toBe("/api/v1");
	});

	it("lets VITE_API_URL override the baseURL at construction time", () => {
		vi.stubEnv("VITE_API_URL", "https://staging.vetary.app/api/v1");
		const client = createApiClient(() => null);
		expect(client.defaults.baseURL).toBe("https://staging.vetary.app/api/v1");
	});
});
