function Svg({ size, className, children }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            {children}
        </svg>
    );
}

const icons = {
    add: (
        <>
            <path d="M12 5v14" />
            <path d="M5 12h14" />
        </>
    ),

    edit: (
        <>
            <path d="M4 20h4l10.5-10.5a2.12 2.12 0 0 0-3-3L5 17v3z" />
            <path d="M13.5 6.5l4 4" />
        </>
    ),

    delete: (
        <>
            <path d="M4 7h16" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M6 7l1 13h10l1-13" />
            <path d="M9 7V4h6v3" />
        </>
    ),

    search: (
        <>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
        </>
    ),

    save: (
        <>
            <path d="M5 3h12l2 2v16H5z" />
            <path d="M8 3v6h8V3" />
            <path d="M9 21v-7h6v7" />
        </>
    ),

    refresh: (
        <>
            <path d="M21 3v6h-6" />
            <path d="M3 21v-6h6" />
            <path d="M20 9a8 8 0 0 0-14-3" />
            <path d="M4 15a8 8 0 0 0 14 3" />
        </>
    ),

    print: (
        <>
            <path d="M7 9V4h10v5" />
            <rect x="5" y="9" width="14" height="8" rx="2" />
            <path d="M7 17h10v3H7z" />
        </>
    ),

    download: (
        <>
            <path d="M12 4v11" />
            <path d="M8 11l4 4 4-4" />
            <path d="M5 20h14" />
        </>
    ),

    upload: (
        <>
            <path d="M12 20V9" />
            <path d="M8 13l4-4 4 4" />
            <path d="M5 4h14" />
        </>
    ),

    view: (
        <>
            <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
        </>
    ),

    hide: (
        <>
            <path d="M3 3l18 18" />
            <path d="M10.5 10.5a2.2 2.2 0 0 0 3 3" />
            <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6 0 10 7 10 7a17.5 17.5 0 0 1-3.2 3.8" />
            <path d="M6.3 6.3A17.6 17.6 0 0 0 2 12s4 7 10 7c1.8 0 3.5-.5 5-1.4" />
        </>
    )
};

export default function Icon({
    name,
    size = 18,
    className = ""
}) {
    const icon = icons[name];

    if (!icon) return null;

    return (
        <Svg
            size={size}
            className={className}
        >
            {icon}
        </Svg>
    );
}