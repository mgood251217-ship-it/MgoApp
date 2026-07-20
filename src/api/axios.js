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

export default api;