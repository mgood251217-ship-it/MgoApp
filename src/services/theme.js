export const applyTheme = (settings) => {
    if (!settings) return;

    const root = document.documentElement;

    const toHex = (value) => {
        if (typeof value !== "string") return null;
        const match = value.match(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})/);
        if (match) {
            const hex = match[0].replace("#", "");
            if (hex.length === 3) {
                return `#${hex.split("").map((char) => char + char).join("")}`.toLowerCase();
            }
            return `#${hex}`.toLowerCase();
        }

        const rgbMatch = value.match(/rgba?\(([^)]+)\)/i);
        if (rgbMatch) {
            const parts = rgbMatch[1].split(",").map((part) => Number(part.trim()));
            if (parts.length >= 3) {
                const [r, g, b] = parts;
                return `#${[r, g, b]
                    .map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, "0"))
                    .join("")}`;
            }
        }

        return null;
    };

    const hexToRgb = (value) => {
        const hex = toHex(value);
        if (!hex) return null;

        const clean = hex.replace("#", "");
        const full = clean.length === 3
            ? clean.split("").map((char) => char + char).join("")
            : clean;

        const int = Number.parseInt(full, 16);
        return {
            r: (int >> 16) & 255,
            g: (int >> 8) & 255,
            b: int & 255,
        };
    };

    const mixColors = (colorA, colorB, ratio = 0.5) => {
        const rgbA = hexToRgb(colorA);
        const rgbB = hexToRgb(colorB);

        if (!rgbA || !rgbB) return colorA;

        const r = Math.round(rgbA.r + (rgbB.r - rgbA.r) * ratio);
        const g = Math.round(rgbA.g + (rgbB.g - rgbA.g) * ratio);
        const b = Math.round(rgbA.b + (rgbB.b - rgbA.b) * ratio);

        return `#${[r, g, b]
            .map((channel) => channel.toString(16).padStart(2, "0"))
            .join("")}`;
    };

    const getLuminance = (value) => {
        const rgb = hexToRgb(value);
        if (!rgb) return 0.5;

        const { r, g, b } = rgb;
        const channel = (channelValue) => {
            const normalized = channelValue / 255;
            return normalized <= 0.03928
                ? normalized / 12.92
                : ((normalized + 0.055) / 1.055) ** 2.4;
        };

        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };

    const resolveSidebarActiveColor = (sidebarValue, activeValue) => {
        const baseSidebar = toHex(sidebarValue) || "#2563eb";
        const baseActive = toHex(activeValue) || "#ffffff";
        const sidebarIsDark = getLuminance(baseSidebar) < 0.5;

        return {
            background: mixColors(baseActive, sidebarIsDark ? "#ffffff" : "#0f172a", sidebarIsDark ? 0.72 : 0.78),
            color: sidebarIsDark ? "#0f172a" : "#ffffff",
        };
    };

    const themeMapping = {
        theme_sidebar: ['--bg-sidebar', '--sidebar'],
        theme_navbar: ['--bg-navbar', '--navbar'],
        theme_footer: ['--bg-footer', '--footer'],
        theme_background: ['--background', '--bg-body'],
        theme_content: ['--bg-content'],

        theme_primary: ['--primary'],
        theme_primary_hover: ['--primary-hover'],
        theme_secondary: ['--secondary'],
        theme_secondary_hover: ['--secondary-hover'],
        theme_success: ['--success'],
        theme_success_hover: ['--success-hover'],
        theme_info: ['--info'],
        theme_info_hover: ['--info-hover'],
        theme_warning: ['--warning'],
        theme_warning_hover: ['--warning-hover'],
        theme_danger: ['--danger'],
        theme_danger_hover: ['--danger-hover'],

        theme_text: ['--text'],
        theme_text_secondary: ['--text-secondary'],
        theme_text_muted: ['--text-muted'],
        theme_border: ['--border'],
        theme_active: ['--active'],

        theme_navbar_height: ['--navbar-height'],
        theme_sidebar_width: ['--sidebar-width'],
        theme_sidebar_width_hover: ['--sidebar-width-hover'],
        theme_radius: ['--radius']
    };

    Object.keys(themeMapping).forEach(key => {
        const value = settings[key];
        themeMapping[key].forEach(cssVar => {
            if (value === undefined || value === null || value === "") {
                root.style.removeProperty(cssVar);
            } else {
                root.style.setProperty(cssVar, value);
            }
        });
    });

    const sidebarValue = settings.theme_sidebar || getComputedStyle(root).getPropertyValue('--bg-sidebar').trim() || "#2563eb";
    const activeValue = settings.theme_active || getComputedStyle(root).getPropertyValue('--active').trim() || "#ffffff";
    const sidebarActive = resolveSidebarActiveColor(sidebarValue, activeValue);

    root.style.setProperty('--sidebar-active-bg', sidebarActive.background);
    root.style.setProperty('--sidebar-active-color', sidebarActive.color);
};