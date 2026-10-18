import { X } from 'lucide-react'
import { useToasts } from '../lib/notify/store'

// Notifications in the bottom right, with optional buttons and a close button
export function Toasts() {
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-8 right-4 z-50 flex flex-col gap-2 w-80">
      {toasts.map((t) => (
        <div key={t.id} className="anim-pop rounded-lg border border-[#30363d] bg-[#1c1f25] shadow-xl p-3 text-xs text-[#e6e6e6]">
          <div className="flex items-start gap-2">
            <p className="flex-1 leading-relaxed">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              title="Close"
              className="p-0.5 rounded text-[#8b949e] hover:text-white hover:bg-[#21262d]"
            >
              <X size={12} />
            </button>
          </div>
          {t.actions && t.actions.length > 0 && (
            <div className="mt-2 flex justify-end gap-2">
              {t.actions.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => {
                    a.run()
                    dismiss(t.id)
                  }}
                  className="px-2 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-[#e6e6e6]"
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}