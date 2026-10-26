import { useGroqUsage } from '../lib/providers/groqUsage'

// A small ring showing how much of today's Groq limit has been used. The full sentence is on hover.
export function UsageMeter() {
  const remaining = useGroqUsage((s) => s.remaining)
  const limit = useGroqUsage((s) => s.limit)

  if (remaining === null || limit === null || limit <= 0) return null

  const used = Math.max(0, limit - remaining)
  const pct = Math.min(100, Math.round((used / limit) * 100))
  const r = 5
  const c = 2 * Math.PI * r

  return (
    <div
      className="flex items-center gap-1.5 text-[11px] text-[#938a7c]"
      title={`You've used ${pct}% of your usage limit (${remaining} of ${limit} requests left today)`}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <circle cx="7" cy="7" r={r} fill="none" stroke="#2d2921" strokeWidth="2" />
        <circle
          cx="7"
          cy="7"
          r={r}
          fill="none"
          stroke="#f0a93b"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          transform="rotate(-90 7 7)"
        />
      </svg>
      <span className="tabular-nums">{pct}%</span>
    </div>
  )
}