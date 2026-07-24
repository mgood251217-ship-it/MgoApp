import "./UpdatePrompt.css";
import logo from "/logo.png";

export default function UpdatePrompt({ latestVersion, downloading, progress, onContinueOld, onUpdateNow }) {
    return (
        <div className="update-prompt">
            <div className="update-prompt-container">
                <img src={logo} alt="MGO" className="update-prompt-logo" />

                <h1 className="update-prompt-title">Update Tersedia</h1>

                <p className="update-prompt-message">
                    Versi baru ({latestVersion}) sudah tersedia. Update sekarang atau lanjutkan dengan versi yang ada?
                </p>

                {downloading ? (
                    <div className="update-prompt-progress">
                        <div className="update-prompt-progress-track">
                            <div className="update-prompt-progress-bar" style={{ width: `${progress}%` }}></div>
                        </div>
                        <span className="update-prompt-progress-text">{progress}%</span>
                    </div>
                ) : (
                    <div className="update-prompt-actions">
                        <button className="update-prompt-button-secondary" onClick={onContinueOld}>
                            Lanjutkan Versi Lama
                        </button>
                        <button className="update-prompt-button-primary" onClick={onUpdateNow}>
                            Update Sekarang
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
