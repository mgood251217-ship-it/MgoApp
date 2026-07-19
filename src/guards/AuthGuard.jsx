import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { hasSession } from "../services/session";

export default function AuthGuard({ children }) {
    const [checked, setChecked] = useState(false);
    const [authenticated, setAuthenticated] = useState(false);

    useEffect(() => {
        let mounted = true;

        async function verifySession() {
            try {
                const ok = await hasSession();
                if (mounted) {
                    setAuthenticated(Boolean(ok));
                    setChecked(true);
                }
            } catch (error) {
                if (mounted) {
                    setAuthenticated(false);
                    setChecked(true);
                }
            }
        }

        verifySession();

        return () => {
            mounted = false;
        };
    }, []);

    if (!checked) {
        return null;
    }

    if (!authenticated) {
        return <Navigate to="/login" replace />;
    }

    return children;
}