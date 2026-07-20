import axios from "axios";
import config from "../services/config";

const api = axios.create({
	baseURL: `${config.serverUrl}/api/`,
	timeout: 10000,
	withCredentials: true
});

export default api;