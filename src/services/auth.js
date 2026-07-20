import api from "../api/axios";

export async function logout() {
	const { data } = await api.post(
		"/index.php?action=logout"
	);

	return data;
}