const config = {
    appName: "MGO Desktop",
    version: "2.0.8",
    serverUrl: import.meta.env.VITE_SERVER_URL.replace(/\/+$/, ""),
    timeout: 30000
};

export default config;
