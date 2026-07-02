const COLORS = {
  neutral: "bg-neutral-50 text-neutral-700 border-neutral-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  red: "bg-red-50 text-red-700 border-red-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  orange: "bg-orange-50 text-orange-700 border-orange-200",
};

export default function StatCard({
  label,
  value,
  color = "neutral",
}: {
  label: string;
  value: number | string;
  color?: keyof typeof COLORS;
}) {
  return (
    <div className={`rounded-xl border p-5 ${COLORS[color]}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs font-semibold uppercase tracking-wide mt-1 opacity-80">{label}</p>
    </div>
  );
}
