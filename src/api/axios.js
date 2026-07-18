import axios from "axios";

const api = axios.create({
	baseURL: "http://localhost/MgoAll/admin/api/",
	// baseURL: "https://mgood.my.id/admin/api/",
	timeout: 10000,
	withCredentials: true
});

export default api;