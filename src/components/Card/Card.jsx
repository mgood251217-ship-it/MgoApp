export default function Card({ title, description1, description2, onClick, bgColor, bgIcon }) {
    return (
        <div 
            onClick={onClick} 
            style={{ 
                background: bgColor,
                padding: "16px", 
                borderRadius: "12px", 
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                color: "#ffffff",
                transition: "all 0.3s ease",
                boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                overflow: "hidden",
                height: "100%",
                position: "relative"
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px) scale(1.02)";
                e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.2)";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0) scale(1)";
                e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
            }}
        >
            <div style={{
                position: "absolute",
                right: "-10%",
                bottom: "-20%",
                width: "20vw",
                height: "30vh",
                opacity: 0.15,
                pointerEvents: "none",
                zIndex: 0
            }}>
                {bgIcon}
            </div>

            <div style={{ position: "relative", zIndex: 1 }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", textShadow: "0 1px 2px rgba(0,0,0,0.2)" }}>
                    {title}
                </h3>
                
                <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "500", textShadow: "0 1px 2px rgba(0,0,0,0.2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {description1}
                    </p>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "500", textShadow: "0 1px 2px rgba(0,0,0,0.2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {description2}
                    </p>
                </div>
            </div>
        </div>
    );
}