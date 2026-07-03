import api from "./axios";

export async function testConnection() {
	const { data } = await api.get("/test.php");
	return data;
}