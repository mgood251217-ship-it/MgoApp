import { useState } from "react";

import Input from "../../components/Input/Input";
import PasswordInput from "../../components/PasswordInput/PasswordInput";
import Button from "../../components/Button/Button";
import Alert from "../../components/Alert/Alert";
import { authStore } from "../../store/auth.store";
import { getSession as fetchSession } from "../../services/session";
import { setSession } from "../../utils/session";

import { login } from "../../services/auth";

export default function LoginForm({ onSuccess }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleLogin() {
        setError("");

        if (!username || !password) {
            setError("Username dan password wajib diisi.");
            return;
        }

        try {
            setLoading(true);

            const response = await login({
                username,
                password
            });

            if (!response.success) {
                setError(response.message || "Login gagal.");
                return;
            }

            const sessionResp = await fetchSession();
            if (sessionResp?.success) {
                setSession(sessionResp.data);
                authStore.login(sessionResp.data);
                if (onSuccess) onSuccess(sessionResp.data);
            } else {
                setSession(response.data);
                authStore.login(response.data);
                if (onSuccess) onSuccess(response.data);
            }

        } catch (err) {
            setError("Server tidak dapat dihubungi." + err);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="login-form">
            {error && (
                <Alert
                    type="error"
                    message={error}
                    onClose={() => setError("")}
                />
            )}

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
                loading={loading}
                disabled={loading}
                onClick={handleLogin}
            >
                Login
            </Button>
        </div>
    );
}
