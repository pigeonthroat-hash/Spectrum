import logo from '../assets/logo.png'

// Shortcuts that Spectrum actually has
const SHORTCUTS: { label: string; keys: string[] }[] = [
  { label: 'Toggle Explorer', keys: ['Ctrl', 'B'] },
  { label: 'Toggle Chat', keys: ['Ctrl', 'Alt', 'B'] },
  { label: 'Save File', keys: ['Ctrl', 'S'] },
]

// Empty editor: the logo, then shortcuts with key boxes, like Cursor's start screen
export function WelcomeScreen() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 select-none">
      <img src={logo} alt="Spectrum logo" className="w-14 h-auto opacity-80" />
      <div className="w-72 flex flex-col gap-1">
        {SHORTCUTS.map((s) => (
          <div key={s.label} className="flex items-center justify-between px-2 py-1 text-[13px] text-[#6e7681]">
            <span>{s.label}</span>
            <span className="flex items-center gap-1">
              {s.keys.map((k) => (
                <kbd
                  key={k}
                  className="min-w-[22px] px-1.5 py-0.5 rounded border border-[#30363d] bg-[#161b22] text-center text-[11px] text-[#8b949e] font-sans"
                >
                  {k}
                </kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}