import { useId, useRef, useState, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import "./Select.css";

const TYPEAHEAD_RESET_MS = 600;

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
    required = false,
    margin,
    style,
    className = "",
    ...rest
}) {
    const id = useId();
    const triggerRef = useRef(null);
    const listRef = useRef(null);
    const optionRefs = useRef([]);
    const typeaheadRef = useRef({ text: "", timeoutId: null });

    const [open, setOpen] = useState(false);
    const [highlighted, setHighlighted] = useState(-1);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

    const selected = options.find((o) => o.value === value);

    const updateCoords = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        setCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };

    useLayoutEffect(() => {
        if (open) updateCoords();
    }, [open]);

    useEffect(() => {
        if (!open) return;

        const onScrollOrResize = () => updateCoords();
        const onClickOutside = (e) => {
            if (triggerRef.current?.contains(e.target)) return;
            if (listRef.current?.contains(e.target)) return;
            setOpen(false);
        };

        window.addEventListener("scroll", onScrollOrResize, true);
        window.addEventListener("resize", onScrollOrResize);
        document.addEventListener("mousedown", onClickOutside);

        return () => {
            window.removeEventListener("scroll", onScrollOrResize, true);
            window.removeEventListener("resize", onScrollOrResize);
            document.removeEventListener("mousedown", onClickOutside);
        };
    }, [open]);

    useEffect(() => {
        if (!open || highlighted < 0) return;
        optionRefs.current[highlighted]?.scrollIntoView({ block: "nearest" });
    }, [open, highlighted]);

    useEffect(() => {
        return () => clearTimeout(typeaheadRef.current.timeoutId);
    }, []);

    const openList = () => {
        if (disabled) return;
        const idx = options.findIndex((o) => o.value === value);
        setHighlighted(idx >= 0 ? idx : 0);
        setOpen(true);
    };

    const commit = (option) => {
        onChange?.({ target: { name, value: option.value } });
        setOpen(false);
        triggerRef.current?.focus();
    };

    const handleTypeahead = (key) => {
        clearTimeout(typeaheadRef.current.timeoutId);

        const nextText = typeaheadRef.current.text + key.toLowerCase();
        typeaheadRef.current.text = nextText;
        typeaheadRef.current.timeoutId = setTimeout(() => {
            typeaheadRef.current.text = "";
        }, TYPEAHEAD_RESET_MS);

        const matchIdx = options.findIndex((o) =>
            o.label.toLowerCase().startsWith(nextText)
        );
        if (matchIdx === -1) return;

        if (open) {
            setHighlighted(matchIdx);
        } else {
            commit(options[matchIdx]);
        }
    };

    const onKeyDown = (e) => {
        if (disabled) return;

        const isPrintable =
            e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey;

        if (!open) {
            if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
                e.preventDefault();
                openList();
                return;
            }
            if (isPrintable) {
                e.preventDefault();
                handleTypeahead(e.key);
            }
            return;
        }

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlighted((i) => Math.min(i + 1, options.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlighted((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (highlighted >= 0 && options[highlighted]) commit(options[highlighted]);
        } else if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
        } else if (e.key === "Tab") {
            setOpen(false);
        } else if (isPrintable) {
            e.preventDefault();
            handleTypeahead(e.key);
        }
    };

    const handleBlur = () => {
        requestAnimationFrame(() => {
            if (listRef.current?.contains(document.activeElement)) return;
            setOpen(false);
        });
    };

    return (
        <div
            className={`select-wrapper select-${labelPosition} ${className}`}
            style={{
                "--label-width": `${labelWidth}px`,
                margin: margin,
                ...(style || {})
            }}
        >
            {label && (
                <label htmlFor={id} className="select-label">
                    {label}
                    {required && <span className="required">*</span>}
                </label>
            )}

            <div className="select-control">
                <button
                    type="button"
                    id={id}
                    name={name}
                    ref={triggerRef}
                    disabled={disabled}
                    autoFocus={autoFocus}
                    className={`select ${error ? "select-error" : ""} ${open ? "select-open" : ""}`}
                    onClick={() => (open ? setOpen(false) : openList())}
                    onKeyDown={onKeyDown}
                    onBlur={handleBlur}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    aria-required={required}
                    {...rest}
                >
                    <span className={`select-value ${!selected ? "select-placeholder" : ""}`}>
                        {selected ? selected.label : placeholder}
                    </span>
                    <span className="select-arrow" aria-hidden="true" />
                </button>

                {name && <input type="hidden" name={name} value={value ?? ""} readOnly />}

                {error && <div className="select-error-text">{error}</div>}
            </div>

            {open && !disabled &&
                createPortal(
                    <ul
                        ref={listRef}
                        role="listbox"
                        className="select-options"
                        style={{ top: coords.top, left: coords.left, width: coords.width }}
                        onMouseDown={(e) => e.preventDefault()}
                    >
                        {options.length === 0 && (
                            <li className="select-option select-option-empty">Tidak ada opsi</li>
                        )}
                        {options.map((option, idx) => (
                            <li
                                key={option.value}
                                ref={(el) => (optionRefs.current[idx] = el)}
                                role="option"
                                aria-selected={option.value === value}
                                className={`select-option ${option.value === value ? "select-option-selected" : ""} ${idx === highlighted ? "select-option-highlighted" : ""}`}
                                onMouseEnter={() => setHighlighted(idx)}
                                onClick={() => commit(option)}
                            >
                                {option.label}
                            </li>
                        ))}
                    </ul>,
                    document.body
                )}
        </div>
    );
}