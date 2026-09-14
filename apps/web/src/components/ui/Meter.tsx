// Meter: horizontal usage bar (memory, disk).
export function Meter({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div
      className="h-[5px] overflow-hidden rounded-[3px] bg-raise"
      aria-hidden="true"
    >
      <div
        className="h-full rounded-[3px] bg-ok transition-[width] duration-400"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
