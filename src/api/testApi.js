import api from "./axios";

let cachedConnectionResult = null;
let cachedConnectionPromise = null;

function getHostingChallengeError(data) {
	if (typeof data !== "string") return null;
	const html = data.slice(0, 50000);
	if (!/<(?:!doctype|html|head|body|script|form|div|title)\b/i.test(html)
		|| !/recaptcha|hcaptcha|turnstile|lsrecaptcha|cf-chl-|challenge-platform|checking your browser|bot verification|verify (?:that )?you are (?:a )?human/i.test(html)) return null;
	const error = new Error("Akses server memerlukan verifikasi keamanan hosting.");
	error.code = "HOSTING_CHALLENGE";
	return error;
}

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
			const challenge = getHostingChallengeError(data);
			if (challenge) throw challenge;
			if (!data || typeof data !== "object" || Array.isArray(data) || data.success !== true) {
				const error = new Error("Respons pemeriksaan server tidak valid.");
				error.code = data && typeof data === "object" && data.success === false ? "SERVER_UNAVAILABLE" : "SERVER_RESPONSE_INVALID";
				throw error;
			}
			cachedConnectionResult = data;
			return data;
		})
		.catch((error) => {
			const challenge = getHostingChallengeError(error.response?.data);
			if (challenge) throw challenge;
			throw error;
		})
		.finally(() => {
			cachedConnectionPromise = null;
		});

	return cachedConnectionPromise;
}
