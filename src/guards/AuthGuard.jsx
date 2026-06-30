import { Navigate } from "react-router-dom";
import { getSession } from "../utils/session";

export default function AuthGuard({ children }) {
    const session = getSession();

    if (!session) {
        return <Navigate to="/login" replace />;
    }

    return children;
}