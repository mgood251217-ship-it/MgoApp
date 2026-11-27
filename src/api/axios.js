import axios from "axios";
import config from "../services/config";
import { isDesktop } from "../services/platform";

export const PRODUCT_UNIT_SCHEMA = 4;

const api = axios.create({
	baseURL: `${config.serverUrl}/api/`,
	timeout: 10000,
	params: { unit_schema: PRODUCT_UNIT_SCHEMA },
	withCredentials: true,
	headers: {
		"X-Client-Type": isDesktop ? "desktop-app" : "mobile-app"
	}
});

api.interceptors.request.use((requestConfig) => {
	const raw = localStorage.getItem("mgo_session");

	if (raw) {
		try {
			const session = JSON.parse(raw);

			if (session?.token) {
				requestConfig.headers.Authorization = `Bearer ${session.token}`;
			}
		} catch (e) {
			localStorage.removeItem("mgo_session");
		}
	}

	return requestConfig;
});

export default api;
