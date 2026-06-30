import { useNavigate } from "react-router-dom";
import LoginForm from "./LoginForm";
import "./Login.css";
import { authStore } from "../../store/auth.store";

export default function Login() {
    const navigate = useNavigate();

    function handleSuccess(data) {
        authStore.login(data);
        navigate("/dashboard", { replace: true });
    }

    return (
        <div className="login-page">
            <div className="login-box">
                <div className="login-header">
                    <div className="app-title">MGO Desktop</div>
                    <div className="app-subtitle">Sign in to continue</div>
                </div>

                <LoginForm onSuccess={handleSuccess} />
            </div>
        </div>
    );
}