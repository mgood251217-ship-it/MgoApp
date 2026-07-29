export const applyTheme = (settings) => {
    if (!settings) return;

    const root = document.documentElement;

    const themeMapping = {
        theme_sidebar: ['--bg-sidebar', '--sidebar'],
        theme_navbar: ['--bg-navbar', '--navbar'],
        theme_footer: ['--bg-footer', '--footer'],
        theme_background: ['--background', '--bg-body'],
        theme_content: ['--bg-content'],
        theme_primary: ['--primary'],
        theme_secondary: ['--secondary'],
        theme_success: ['--success'],
        theme_info: ['--info'],
        theme_warning: ['--warning'],
        theme_danger: ['--danger'],
        theme_text: ['--text'],
        theme_text_secondary: ['--text-secondary'],
        theme_text_muted: ['--text-muted'],
        theme_border: ['--border'],
        theme_active: ['--active']
    };

    Object.keys(themeMapping).forEach(key => {
        if (settings[key]) {
            themeMapping[key].forEach(cssVar => {
                root.style.setProperty(cssVar, settings[key]);
            });
        }
    });
};