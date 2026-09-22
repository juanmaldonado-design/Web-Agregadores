// Puntos con posición/tamaño/retraso fijos (no random en cada render, para
// que no "salte" en cada recarga y sea determinístico entre server/cliente).
const DOTS = [
  { top: "12%", left: "6%", size: 2, delay: "0s", max: 0.6 },
  { top: "24%", left: "18%", size: 1.5, delay: "0.6s", max: 0.5 },
  { top: "8%", left: "32%", size: 2, delay: "1.2s", max: 0.7 },
  { top: "40%", left: "45%", size: 1.5, delay: "0.3s", max: 0.45 },
  { top: "18%", left: "58%", size: 2, delay: "1.8s", max: 0.65 },
  { top: "32%", left: "72%", size: 1.5, delay: "0.9s", max: 0.5 },
  { top: "10%", left: "85%", size: 2, delay: "2.1s", max: 0.6 },
  { top: "48%", left: "92%", size: 1.5, delay: "1.5s", max: 0.45 },
  { top: "60%", left: "12%", size: 1.5, delay: "2.4s", max: 0.4 },
  { top: "70%", left: "38%", size: 2, delay: "0.4s", max: 0.55 },
  { top: "75%", left: "64%", size: 1.5, delay: "1.1s", max: 0.4 },
  { top: "58%", left: "80%", size: 2, delay: "1.9s", max: 0.5 },
];

export default function DashboardHero({
  eyebrow,
  title,
  accent,
  subtitle,
  badges,
}: {
  eyebrow?: string;
  title: string;
  accent?: string;
  subtitle?: string;
  badges?: string[];
}) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-[#0d0d0d] px-6 py-10 sm:px-10 sm:py-12">
      <div className="hero-dots pointer-events-none absolute inset-0">
        {DOTS.map((d, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={
              {
                top: d.top,
                left: d.left,
                width: d.size,
                height: d.size,
                animationDelay: d.delay,
                "--twinkle-max": d.max,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      {/* Resplandor cálido de fondo, sutil */}
      <div
        className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, #eda100, transparent 70%)" }}
      />

      <div className="relative flex flex-col gap-4">
        {badges && badges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <span
                key={b}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300 backdrop-blur-sm"
              >
                {b}
              </span>
            ))}
          </div>
        )}

        <div>
          {eyebrow && <p className="text-xs font-semibold tracking-wide text-[#eda100] uppercase">{eyebrow}</p>}
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {title} {accent && <span className="font-light text-zinc-400">{accent}</span>}
          </h1>
          {subtitle && <p className="mt-2 max-w-xl text-sm text-zinc-400">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
