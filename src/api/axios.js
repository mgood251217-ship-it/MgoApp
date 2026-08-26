import axios from "axios";
import config from "../services/config";

const api = axios.create({
	baseURL: `${config.serverUrl}/api/`,
	timeout: 10000,
	withCredentials: true,
	headers: {
		"X-Client-Type": "desktop-app"
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
