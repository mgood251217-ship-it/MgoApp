const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const config = {
    appName: "MGO Desktop",
    version: "1.0.0",
    serverUrl: isLocal ? "http://localhost/MgoAll/admin" : "https://mgood.my.id/admin",
    timeout: 30000
};

export default config;