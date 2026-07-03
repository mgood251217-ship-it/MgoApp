import api from "../api/axios";

export async function login(payload) {
	const formData = new FormData();

	formData.append("username", payload.username);
	formData.append("password", payload.password);

	const { data } = await api.post(
		"/index.php?action=login",
		formData
	);

	return data;
}

export async function logout() {
	const { data } = await api.post(
		"/index.php?action=logout"
	);

	return data;
}