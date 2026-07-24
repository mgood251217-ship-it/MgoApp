import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from "react-google-recaptcha-v3";

import Input from "../../components/Input/Input";
import PasswordInput from "../../components/PasswordInput/PasswordInput";
import Button from "../../components/Button/Button";
import Alert from "../../components/Alert/Alert";
import { authStore, getSession as fetchSession } from "../../services/session";
import api from "../../api/axios";
import "./Login.css";

async function login(payload) {
    const formData = new FormData();
    formData.append("username", payload.username);
    formData.append("password", payload.password);
    formData.append("g-recaptcha-response", payload["g-recaptcha-response"] ?? "");

    const { data } = await api.post("/index.php?action=login", formData);
    return data;
}

function LoginInternal() {
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const { executeRecaptcha } = useGoogleReCaptcha();

    const handleFormSubmit = (e) => {
        e.preventDefault();

        if (loading) return; 

        if (!username) {
            const userInput = document.querySelector('.login-form input[type="text"]');
            if (userInput) userInput.focus();
            return;
        }

        if (!password) {
            const passInput = document.querySelector('.login-form input[type="password"]');
            if (passInput) passInput.focus();
            return;
        }

        handleLogin();
    };

    async function handleLogin() {
        setError("");

        if (!executeRecaptcha) {
            setError("reCAPTCHA sedang disiapkan. Tunggu sebentar.");
            return;
        }

        try {
            setLoading(true);

            const token = await executeRecaptcha("login");

            const response = await login({
                username,
                password,
                "g-recaptcha-response": token
            });

            if (!response.success) {
                setError(response.message || "Login gagal.");
                setPassword(""); 
                
                setTimeout(() => {
                    const passInput = document.querySelector('.login-form input[type="password"]');
                    if (passInput) passInput.focus();
                }, 100);
                
                return;
            }

            const sessionResp = await fetchSession();
            if (sessionResp?.success) {
                authStore.login(sessionResp.data);
            } else {
                authStore.login(response.data);
            }

            navigate("/store", { replace: true });
        } catch (err) {
            setError("Server tidak dapat dihubungi.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="login-page">
            <div className="login-box">
                <div className="login-header">
                    <div className="app-title">MGO Desktop</div>
                    <div className="app-subtitle">Sign in to continue</div>
                </div>

                <form className="login-form" onSubmit={handleFormSubmit}>
                    {error && <Alert type="error" message={error} onClose={() => setError("")} />}

                    <Input
                        label="Username"
                        placeholder="Masukkan username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={loading}
                    />

                    <PasswordInput
                        label="Password"
                        placeholder="Masukkan password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                    />

                    <Button
                        type="submit"
                        size="full-lg"
                        loading={loading}
                        disabled={loading}
                    >
                        Login
                    </Button>
                </form>
            </div>
        </div>
    );
}

export default function Login() {
    return (
        <GoogleReCaptchaProvider reCaptchaKey="6LfKclYtAAAAAD9zWKtWXNNl-n3hahu0GmNXthVE">
            <LoginInternal />
        </GoogleReCaptchaProvider>
    );
}