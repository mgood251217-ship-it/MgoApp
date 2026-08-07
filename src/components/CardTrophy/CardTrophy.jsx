export default function CardTrophy({ title, value, person, unit }) {
    return (
        <div style={{
            flex: "1 1 200px",
            background: "var(--background)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            position: "relative",
            overflow: "hidden" 
        }}>
            <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>
                    {title}
                </div>
                <div style={{ fontSize: "20px", fontWeight: "bold", color: "var(--primary)" }}>
                    {person || "-"}
                </div>
                <div style={{ fontSize: "14px", color: "var(--text)" }}>
                    {value !== null && value !== undefined ? `${value} ${unit}` : "-"}
                </div>
            </div>

            <div style={{
                position: "absolute",
                bottom: "15px",
                right: "-45px",
                zIndex: 0,
                display: "flex",
                pointerEvents: "none"
            }}>
                <svg
                    width="150"
                    height="150"
                    viewBox="0 0 100 100"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{
                        transform: "rotate(-20deg)",
                        transformOrigin: "bottom right",
                        filter: "drop-shadow(2px 8px 6px rgba(217, 119, 6, 0.4))" 
                    }}
                >
                    <defs>
                        <linearGradient id="goldGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#FDE047" />
                            <stop offset="50%" stopColor="#F59E0B" /> 
                            <stop offset="100%" stopColor="#B45309" /> 
                        </linearGradient>
                        <linearGradient id="goldDark2" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#F59E0B" />
                            <stop offset="100%" stopColor="#78350F" />
                        </linearGradient>
                    </defs>

                    <path d="M 28 35 C 5 35, 5 60, 35 55" fill="none" stroke="url(#goldDark2)" strokeWidth="6" strokeLinecap="round" />
                    <path d="M 72 35 C 95 35, 95 60, 65 55" fill="none" stroke="url(#goldDark2)" strokeWidth="6" strokeLinecap="round" />
                    <path d="M 25 30 C 25 70, 75 70, 75 30 Z" fill="url(#goldGradient2)" />
                    <ellipse cx="50" cy="30" rx="25" ry="7" fill="#FEF08A" />
                    <ellipse cx="50" cy="31" rx="21" ry="4" fill="#92400E" />
                    <path d="M 45 60 L 45 80 L 55 80 L 55 60 Z" fill="url(#goldGradient2)" />
                    <path d="M 38 80 L 62 80 L 66 88 L 34 88 Z" fill="url(#goldDark2)" />
                    <rect x="30" y="88" width="40" height="8" rx="3" fill="#78350F" />
                    <rect x="30" y="88" width="40" height="3" fill="#451A03" />
                </svg>
            </div>
        </div>
    );
}