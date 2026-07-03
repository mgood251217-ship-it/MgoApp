import api from "./axios";

export async function login(username, password, recaptcha = "") {
	const formData = new FormData();

	formData.append("usernames", username);
	formData.append("password", password);
	formData.append("g-recaptcha-response", recaptcha);

	const { data } = await api.post(
		"/index.php?action=login",
		formData
	);

	return data;
}