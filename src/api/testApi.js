import api from "./axios";

let cachedConnectionResult = null;
let cachedConnectionPromise = null;

export async function testConnection() {
	if (cachedConnectionResult) {
		return cachedConnectionResult;
	}

	if (cachedConnectionPromise) {
		return cachedConnectionPromise;
	}

	cachedConnectionPromise = api
		.get("", { params: { action: "test_connection" } })
		.then(({ data }) => {
			cachedConnectionResult = data;
			return data;
		})
		.catch((error) => {
			cachedConnectionPromise = null;
			throw error;
		});

	return cachedConnectionPromise;
}