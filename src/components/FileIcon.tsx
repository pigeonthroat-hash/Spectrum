import { File, Image as ImageIcon, Diamond, Lock } from 'lucide-react'

// Colored icon for each file type, similar to common editor icon themes
export function FileIcon({ name }: { name: string }) {
  const lower = name.toLowerCase()
  const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.') + 1) : ''

  if (lower === 'package.json') return <Badge text="JS" color="#8bc34a" />
  if (lower === 'package-lock.json') return <Lock size={13} className="shrink-0 text-[#cc3e44]" />
  if (lower.startsWith('.git')) return <Diamond size={13} className="shrink-0 text-[#f14e32]" />
  if (lower.startsWith('tailwind')) return <Badge text="~" color="#38bdf8" />
  if (lower.startsWith('postcss')) return <Badge text="P" color="#dd3a3a" />

  switch (ext) {
    case 'tsx':
    case 'jsx':
      return <ReactAtom />
    case 'ts':
      return <Badge text="TS" color="#3178c6" />
    case 'js':
    case 'mjs':
    case 'cjs':
      return <Badge text="JS" color="#f1e05a" />
    case 'json':
      return <Badge text="{}" color="#cbcb41" />
    case 'css':
      return <Badge text="CSS" color="#42a5f5" />
    case 'html':
      return <Badge text="<>" color="#e34c26" />
    case 'md':
      return <Badge text="M" color="#519aba" />
    case 'py':
      return <Badge text="PY" color="#3572a5" />
    case 'rs':
      return <Badge text="RS" color="#dea584" />
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
    case 'ico':
      return <ImageIcon size={13} className="shrink-0 text-[#8bc34a]" />
    default:
      return <File size={13} className="shrink-0 text-[#8b949e]" />
  }
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="shrink-0 min-w-[16px] text-center text-[9px] font-bold leading-none"
      style={{ color }}
    >
      {text}
    </span>
  )
}

function ReactAtom() {
  return (
    <svg width="14" height="14" viewBox="-11.5 -10.23 23 20.46" className="shrink-0" fill="none" stroke="#61dafb" strokeWidth="1.2">
      <circle r="2" fill="#61dafb" stroke="none" />
      <ellipse rx="11" ry="4.2" />
      <ellipse rx="11" ry="4.2" transform="rotate(60)" />
      <ellipse rx="11" ry="4.2" transform="rotate(120)" />
    </svg>
  )
}