import axios from "axios";

const api = axios.create({
	baseURL: "http://localhost/MgoAll-main/admin/api",
	timeout: 10000,
	withCredentials: true
});

export default api;