import api from "./axios";

export async function testConnection() {
	const { data } = await api.get("", { params: { action: "test_connection" } });
	return data;
}