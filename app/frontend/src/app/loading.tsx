export default function Loading() {
  return (
    <div
      className="relative mx-auto max-w-5xl space-y-8 pb-4"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="pointer-events-none absolute -inset-px rounded-[1.85rem] bg-gradient-to-br from-fuchsia-500/30 via-transparent to-cyan-400/20 opacity-90" />
      <div className="relative space-y-8 rounded-[1.75rem] border border-white/[0.1] bg-dream-ink/75 p-8 backdrop-blur-sm md:p-10">
        <div className="h-36 rounded-2xl skeleton-shimmer border border-white/[0.07]" />
        <div className="h-10 rounded-xl skeleton-shimmer max-w-sm border border-white/[0.07]" />
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 rounded-2xl skeleton-shimmer border border-white/[0.06]" />
          ))}
        </div>
      </div>
    </div>
  );
}
