import { FiBookOpen, FiPlay } from "react-icons/fi";
import Tag from "../Tag/Tag";
import "./CardVideo.css";

export default function CardVideo({ title, description, category, thumbnailUrl, videoUrl, onClick }) {
    return (
        <article className="card-video">
            <button type="button" className="card-video-cover" onClick={onClick} aria-label={`Buka ${title}`}>
                {thumbnailUrl ? (
                    <img src={thumbnailUrl} alt="" loading="lazy" />
                ) : (
                    <div className="card-video-placeholder">
                        <FiBookOpen aria-hidden="true" />
                        <span>{videoUrl ? "Video tutorial" : "Panduan tertulis"}</span>
                    </div>
                )}
                {videoUrl && <span className="card-video-play"><FiPlay aria-hidden="true" /></span>}
            </button>
            <div className="card-video-body">
                <div className="card-video-meta">
                    <Tag>{category || "Umum"}</Tag>
                    <span>{videoUrl ? "Video" : "Artikel"}</span>
                </div>
                <h2 className="card-video-title">{title}</h2>
                <p className="card-video-description">{description}</p>
            </div>
        </article>
    );
}
