import './Tag.css';

export default function Tag({children, variant = "primary", onClick }) {
    return (
        <span className={`tag tag-${variant}`} onClick={onClick}>
            {children}
        </span>
    );
}