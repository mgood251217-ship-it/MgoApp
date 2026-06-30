import { useId } from "react";
import "./Input.css";

export default function Input({
    label,
    type = "text",
    value,
    onChange,
    placeholder,
    error,
    disabled = false,
    autoFocus = false,
    required = false
}) {
    const id = useId();

    return (
        <div className="input-wrapper">
            {label && (
                <label htmlFor={id} className="input-label">
                    {label} {required && <span className="required">*</span>}
                </label>
            )}

            <input
                id={id}
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                disabled={disabled}
                autoFocus={autoFocus}
                className={`input ${error ? "input-error" : ""}`}
            />

            {error && <div className="input-error-text">{error}</div>}
        </div>
    );
}