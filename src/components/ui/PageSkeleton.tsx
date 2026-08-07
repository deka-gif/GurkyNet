export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse space-y-4 pb-24 md:pb-8">
      <div className="h-[180px] rounded-2xl bg-slate-100 md:h-[200px]" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="h-56 rounded-3xl bg-slate-100 lg:col-span-5" />
        <div className="aspect-[16/9] rounded-2xl bg-slate-100 lg:col-span-7" />
      </div>
      <div className="h-48 rounded-3xl bg-slate-100" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="h-64 rounded-3xl bg-slate-100 lg:col-span-7" />
        <div className="h-64 rounded-3xl bg-slate-100 lg:col-span-5" />
      </div>
    </div>
  );
}

export function SectionSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 rounded-2xl bg-slate-100" />
      ))}
    </div>
  );
}

export default PageSkeleton;
