export default function Loading() {
  return (
    <div className="space-y-8 animate-pulse" aria-hidden="true">
      <div className="h-36 rounded-3xl bg-white/[0.06] border border-white/5" />
      <div className="h-10 rounded-xl bg-white/[0.06] max-w-md" />
      <div className="grid md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-44 rounded-2xl bg-white/[0.06] border border-white/5" />
        ))}
      </div>
    </div>
  );
}
