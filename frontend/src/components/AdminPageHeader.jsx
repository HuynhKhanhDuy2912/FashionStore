export default function AdminPageHeader({ title, description, aside }) {
  return (
    <div className="admin-page-header">
      <div>
        <span className="eyebrow">Admin workspace</span>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {aside}
    </div>
  );
}
