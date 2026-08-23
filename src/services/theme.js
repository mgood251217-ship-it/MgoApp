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
        if (settings[key]) {
            themeMapping[key].forEach(cssVar => {
                root.style.setProperty(cssVar, settings[key]);
            });
        }
    });
};