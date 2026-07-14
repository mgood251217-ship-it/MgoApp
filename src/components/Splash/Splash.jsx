import "./Splash.css";
import logo from "/logo.png";

export default function Splash({ message = "Initializing application..." }) {
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

                <p className="splash-message">
                    {message}
                </p>

                <div className="splash-loading">
                    <div className="splash-loading-bar"></div>
                </div>

                <span className="splash-version">
                    Version 1.0.0
                </span>
            </div>
        </div>
    );
}