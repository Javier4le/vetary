import axios, { type AxiosInstance } from "axios";

export function createApiClient(getToken: () => string | null): AxiosInstance {
	const client = axios.create({
		baseURL: import.meta.env.VITE_API_URL ?? "/api/v1",
	});

	client.interceptors.request.use((config) => {
		const token = getToken();
		if (token) {
			config.headers.set("Authorization", `Bearer ${token}`);
		}
		return config;
	});

	return client;
}

export const apiClient: AxiosInstance = createApiClient(() => null);
