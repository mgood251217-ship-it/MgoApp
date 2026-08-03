import "./UpdatePrompt.css";
import logo from "/logo.png";

export default function UpdatePrompt({ latestVersion, downloading, progress, mandatory, onContinueOld, onUpdateNow }) {
    return (
        <div className="update-prompt">
            <div className="update-prompt-container">
                <img src={logo} alt="MGO" className="update-prompt-logo" />

                <h1 className="update-prompt-title">
                    {mandatory ? "Update Wajib" : "Update Tersedia"}
                </h1>

                <p className="update-prompt-message">
                    {mandatory
                        ? `Versi baru (${latestVersion}) wajib diinstall untuk melanjutkan menggunakan aplikasi.`
                        : `Versi baru (${latestVersion}) sudah tersedia. Update sekarang atau lanjutkan dengan versi yang ada?`}
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
                        {!mandatory && (
                            <button className="update-prompt-button-secondary" onClick={onContinueOld}>
                                Lanjutkan Versi Lama
                            </button>
                        )}
                        <button className="update-prompt-button-primary" onClick={onUpdateNow}>
                            Update Sekarang
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
