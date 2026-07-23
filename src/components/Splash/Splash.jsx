import "./Splash.css";
import logo from "/logo.png";

export default function Splash({ message = "Initializing application...", error = false, onRetry }) {
    return (
        <div className="splash">
            <div className="splash-container">
                <img
                    src={logo}
                    alt="MGO"
                    className="splash-logo"
                />

                <h1 className="splash-title">
                    MGO Desktop
                </h1>

                <p className={error ? "splash-message splash-message-error" : "splash-message"}>
                    {message}
                </p>

                {error ? (
                    <button className="splash-retry-button" onClick={onRetry}>
                        Coba Lagi
                    </button>
                ) : (
                    <div className="splash-loading">
                        <div className="splash-loading-bar"></div>
                    </div>
                )}

                <span className="splash-version">
                    Version 1.0.0
                </span>
            </div>
        </div>
    );
}
