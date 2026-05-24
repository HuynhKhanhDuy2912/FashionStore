export default function AdminPageHeader({ title, description, aside }) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="m-0 text-xl font-bold leading-tight tracking-tight text-slate-900 sm:text-2xl">
          {title}
        </h2>
        {description ? <p className="m-0 mt-1.5 text-sm text-slate-500">{description}</p> : null}
      </div>
      {aside ? <div className="flex flex-wrap items-center gap-2">{aside}</div> : null}
    </div>
  );
}
