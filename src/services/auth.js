import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

export async function login({ username, password, recaptchaToken = null }) {
    try {
        const response = await axios.post(`${API_URL}/auth/login`, {
            username,
            password,
            recaptchaToken
        });

        return response.data;
    } catch (error) {
        if (error.response) {
            return {
                success: false,
                message: error.response.data?.message || "Login failed"
            };
        }

        return {
            success: false,
            message: "Network error"
        };
    }
}