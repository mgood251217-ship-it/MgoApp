export const applyTheme = (settings) => {
    if (!settings) return;

    const root = document.documentElement;

    const themeMapping = {
        theme_sidebar: ['--bg-sidebar', '--sidebar'],
        theme_navbar: ['--bg-navbar', '--navbar'],
        theme_footer: ['--bg-footer', '--footer'],
        theme_background: ['--background', '--bg-body', '--bg-content'],
        theme_primary: ['--primary'],
        theme_secondary: ['--secondary'],
        theme_success: ['--success'],
        theme_warning: ['--warning'],
        theme_danger: ['--danger'],
    };

    Object.keys(themeMapping).forEach(key => {
        if (settings[key]) {
            themeMapping[key].forEach(cssVar => {
                root.style.setProperty(cssVar, settings[key]);
            });
        }
    });
};