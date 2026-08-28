import api from "../api/axios";

export async function changeTheme({ user_id, mode }) {
    const formData = new FormData();

    formData.append("user_id", user_id);
    formData.append("mode", mode);

    const { data } = await api.post("/?action=theme", formData);

    return data;
}