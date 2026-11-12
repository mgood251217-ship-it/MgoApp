import { testConnection } from "../api/testApi";

export async function checkServer() {
	try {
		const result = await testConnection();
		return result.success === true;
	} catch (error) {
		if (["HOSTING_CHALLENGE", "SERVER_RESPONSE_INVALID"].includes(error.code)) throw error;
		return false;
	}
}
