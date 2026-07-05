import "./Header.css";

export default function Header({
    title,
    subtitle,
    actions,
    children
}) {
    return (
        <div className="header">
            <div className="header-content">
                <div>
                    <h1 className="header-title">{title}</h1>

                    {subtitle && (
                        <p className="header-subtitle">
                            {subtitle}
                        </p>
                    )}
                </div>

                {(actions || children) && (
                    <div className="header-actions">
                        {actions || children}
                    </div>
                )}
            </div>
        </div>
    );
}