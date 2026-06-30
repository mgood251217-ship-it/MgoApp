import {
    checkInternet,
    checkServer,
    checkUpdate,
    hasSession
} from "../../services";

export const bootSteps = [
    {
        key: "config",
        message: "Loading configuration...",
        action: async () => {
            return true;
        }
    },
    {
        key: "internet",
        message: "Checking internet connection...",
        action: checkInternet
    },
    {
        key: "server",
        message: "Checking server...",
        action: checkServer
    },
    {
        key: "update",
        message: "Checking application update...",
        action: checkUpdate
    },
    {
        key: "session",
        message: "Checking user session...",
        action: hasSession
    }
];