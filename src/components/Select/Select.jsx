import { useId } from "react";
import "./Select.css";

export default function Select({
    name,
    label,
    labelPosition = "top",
    labelWidth = 140,
    value,
    onChange,
    options = [],
    placeholder = "Pilih...",
    error,
    disabled = false,
    autoFocus = false,
    required = false
}) {
    const id = useId();

    return (
        <div
            className={`select-wrapper select-${labelPosition}`}
            style={{
                "--label-width": `${labelWidth}px`
            }}
        >
            {label && (
                <label htmlFor={id} className="select-label">
                    {label}
                    {required && <span className="required">*</span>}
                </label>
            )}

            <div className="select-control">
                <select
                    id={id}
                    name={name}
                    value={value}
                    onChange={onChange}
                    disabled={disabled}
                    autoFocus={autoFocus}
                    className={`select ${error ? "select-error" : ""}`}
                >
                    <option value="">{placeholder}</option>

                    {options.map((option) => (
                        <option
                            key={option.value}
                            value={option.value}
                        >
                            {option.label}
                        </option>
                    ))}
                </select>

                {error && (
                    <div className="select-error-text">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
}