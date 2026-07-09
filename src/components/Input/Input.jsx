import { useId, forwardRef } from "react";
import "./Input.css";

const Input = forwardRef(({
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
    readOnly = false,
    style,
    className = "",
    ...rest
}, ref) => {
    const id = useId();

    return (
        <div
            className={`input-wrapper input-${labelPosition} ${className}`}
            style={{
                "--label-width": `${labelWidth}px`,
                ...(style || {})
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
                    ref={ref}
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
                    {...rest}
                />

                {error && (
                    <div className="input-error-text">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
});

export default Input;