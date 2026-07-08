import { useId } from "react";
import "./Input.css";

export default function Input({
    name,
    label,
    labelPosition = "top",
    labelWidth = 140,
    type = "text",
    value,
    onChange,
    placeholder,
    error,
    disabled = false,
    autoFocus = false,
    required = false,
    readOnly = false
}) {
    const id = useId();

    return (
        <div
            className={`input-wrapper input-${labelPosition}`}
            style={{
                "--label-width": `${labelWidth}px`
            }}
        >
            {label && (
                <label htmlFor={id} className="input-label">
                    {label}
                    {required && <span className="required">*</span>}
                </label>
            )}

            <div className="input-control">
                <input
                    id={id}
                    name={name}
                    type={type}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    disabled={disabled}
                    autoFocus={autoFocus}
                    readOnly={readOnly}
                    className={`input ${error ? "input-error" : ""}`}
                />

                {error && (
                    <div className="input-error-text">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
}