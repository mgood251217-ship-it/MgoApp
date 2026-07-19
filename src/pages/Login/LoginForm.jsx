import { useState, useCallback } from "react";
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from "react-google-recaptcha-v3";

import Input from "../../components/Input/Input";
import PasswordInput from "../../components/PasswordInput/PasswordInput";
import Button from "../../components/Button/Button";
import Alert from "../../components/Alert/Alert";
import { authStore } from "../../store/auth.store";
import { getSession as fetchSession } from "../../services/session";
import { login } from "../../services/auth";

function LoginFormInternal({ onSuccess }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const { executeRecaptcha } = useGoogleReCaptcha();

    async function handleLogin() {
        setError("");

        if (!username || !password) {
            setError("Username dan password wajib diisi.");
            return;
        }

        // reCAPTCHA v3 tidak butuh pengecekan localhost di sisi client, 
        // tapi pastikan Anda menangani validasi token di sisi server PHP Anda
        if (!executeRecaptcha) {
            setError("reCAPTCHA belum siap.");
            return;
        }

        try {
            setLoading(true);

            // Mendapatkan token v3
            const token = await executeRecaptcha("login");

            const response = await login({
                username,
                password,
                "g-recaptcha-response": token // Token dikirim ke PHP
            });

            if (!response.success) {
                setError(response.message || "Login gagal.");
                return;
            }

            const sessionResp = await fetchSession();
            if (sessionResp?.success) {
                authStore.login(sessionResp.data);
                if (onSuccess) onSuccess(sessionResp.data);
            } else {
                authStore.login(response.data);
                if (onSuccess) onSuccess(response.data);
            }

        } catch (err) {
            setError("Server tidak dapat dihubungi.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="login-form">
            {error && <Alert type="error" message={error} onClose={() => setError("")} />}

            <Input
                label="Username"
                placeholder="Masukkan username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                required
            />

            <PasswordInput
                label="Password"
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
            />

            <Button
                size="full-lg"
                loading={loading}
                disabled={loading}
                onClick={handleLogin}
            >
                Login
            </Button>
        </div>
    );
}

// Wrapper agar Provider bisa digunakan
export default function LoginForm({ onSuccess }) {
    return (
        <GoogleReCaptchaProvider reCaptchaKey="6LfKclYtAAAAAD9zWKtWXNNl-n3hahu0GmNXthVE">
            <LoginFormInternal onSuccess={onSuccess} />
        </GoogleReCaptchaProvider>
    );
}