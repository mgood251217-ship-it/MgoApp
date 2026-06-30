import { useId, useState } from "react";
import "./PasswordInput.css";

export default function PasswordInput({
    label,
    value,
    onChange,
    placeholder,
    error,
    disabled = false,
    required = false,
    autoFocus = false
}) {
    const id = useId();
    const [show, setShow] = useState(false);

    return (
        <div className="password-wrapper">
            {label && (
                <label htmlFor={id} className="password-label">
                    {label} {required && <span className="required">*</span>}
                </label>
            )}

            <div className="password-input-container">
                <input
                    id={id}
                    type={show ? "text" : "password"}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    disabled={disabled}
                    autoFocus={autoFocus}
                    className={`password-input ${error ? "password-error" : ""}`}
                />

                <button
                    type="button"
                    className="toggle-btn"
                    onClick={() => setShow(!show)}
                    disabled={disabled}
                >
                    {show ? "Hide" : "Show"}
                </button>
            </div>

            {error && <div className="password-error-text">{error}</div>}
        </div>
    );
}