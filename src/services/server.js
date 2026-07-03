import { testConnection } from "../api/testApi";

export async function checkServer() {
	try {
		const result = await testConnection();
		return result.success === true;
	} catch (error) {
		return false;
	}
}