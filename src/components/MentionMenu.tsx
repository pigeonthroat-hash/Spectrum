import { useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Copy, File, Globe, Image, Plug, Search, Terminal, Trash2, BookOpen, Wrench } from 'lucide-react'
import { cn } from '../lib/utils'
import type { ToolDef } from '../lib/tools/registry'

export type MenuView = 'root' | 'files' | 'tools'

type Icon = typeof Globe

const TOOL_ICONS: Record<string, Icon> = {
  web_search: Globe,
  web_fetch: Globe,
  generate_image: Image,
  delete_file: Trash2,
  run_terminal_command: Terminal,
  codebase_search: Search,
  edit_notebook: BookOpen,
  call_mcp_tool: Plug,
  fetch_mcp_resource: Plug,
}

// One row of the menu: icon, name, optional detail, and a right-hand marker
function Row({
  icon: Icon,
  label,
  detail,
  right,
  highlighted,
  disabled,
  title,
  onPress,
  onHover,
}: {
  icon?: Icon
  label: string
  detail?: string
  right?: React.ReactNode
  highlighted?: boolean
  disabled?: boolean
  title?: string
  onPress?: () => void
  onHover?: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      // mousedown keeps focus in the text box
      onMouseDown={(e) => {
        e.preventDefault()
        onPress?.()
      }}
      onMouseEnter={onHover}
      className={cn(
        'flex w-full items-center gap-2.5 px-3 h-8 text-left text-[13px]',
        disabled ? 'text-[#6f675a] cursor-not-allowed' : 'text-[#d4d4d4]',
        !disabled && (highlighted ? 'bg-[#2a261f]' : 'hover:bg-[#2a261f]')
      )}
    >
      {Icon && <Icon size={15} className={cn('shrink-0', disabled ? 'text-[#5c554a]' : 'text-[#a39a8b]')} />}
      <span className="truncate">{label}</span>
      {detail && <span className="truncate text-[12px] text-[#938a7c]">{detail}</span>}
      {right && <span className="ml-auto flex shrink-0 items-center">{right}</span>}
    </button>
  )
}

// The @ menu: a search line, the Added section, and submenus for files and tools
export function MentionMenu({
  view,
  setView,
  query,
  files,
  highlight,
  onPick,
  onHover,
  optionalTools,
  enabled,
  onToggleTool,
}: {
  view: MenuView
  setView: (view: MenuView) => void
  query: string
  files: string[]
  highlight: number
  onPick: (path: string) => void
  onHover: (index: number) => void
  optionalTools: ToolDef[]
  enabled: string[]
  onToggleTool: (name: string) => void
}) {
  const [, force] = useState(0)
  const q = query.toLowerCase()
  const tools = optionalTools.filter((t) => !q || t.name.includes(q) || (t.label ?? '').toLowerCase().includes(q))
  const added = optionalTools.filter((t) => enabled.includes(t.name))

  const toolRow = (t: ToolDef) => {
    const on = enabled.includes(t.name)
    return (
      <Row
        key={t.name}
        icon={TOOL_ICONS[t.name] ?? Wrench}
        label={t.label ?? t.name}
        disabled={!t.available}
        title={t.available ? t.description : 'Coming soon: ' + (t.needs ?? '')}
        right={
          t.available ? (on ? <Check size={14} className="text-[#f0a93b]" /> : null) : (
            <span className="text-[11px] text-[#6f675a]">Coming soon</span>
          )
        }
        onPress={() => {
          if (!t.available) return
          onToggleTool(t.name)
          force((n) => n + 1)
        }}
      />
    )
  }

  const fileRow = (p: string, i: number) => {
    const slash = p.lastIndexOf('/')
    const name = slash >= 0 ? p.slice(slash + 1) : p
    const dir = slash >= 0 ? p.slice(0, slash) : ''
    return (
      <Row
        key={p}
        icon={File}
        label={name}
        detail={dir}
        highlighted={i === highlight}
        onPress={() => onPick(p)}
        onHover={() => onHover(i)}
      />
    )
  }

  const Divider = () => <div className="my-1 border-t border-[#2a261f]" />
  const Heading = ({ children }: { children: React.ReactNode }) => (
    <div className="px-3 pt-2 pb-1 text-[12px] text-[#938a7c]">{children}</div>
  )
  const Back = ({ label }: { label: string }) => (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault()
        setView('root')
      }}
      className="flex w-full items-center gap-2 px-3 h-8 text-left text-[13px] text-[#d4d4d4] hover:bg-[#2a261f]"
    >
      <ChevronLeft size={15} className="text-[#a39a8b]" />
      {label}
    </button>
  )

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 z-20 max-h-80 overflow-y-auto rounded-xl border border-[#2a261f] bg-[#1f1b15] py-1 shadow-2xl anim-pop">
      <div key={view} className="anim-fade-up">
      {view === 'root' && (
        <>
          <div className="px-3 py-2 text-[13px]">
            {query ? (
              <span className="text-[#d4d4d4]">{query}</span>
            ) : (
              <span className="text-[#6f675a]">Add files, folders, docs...</span>
            )}
          </div>

          {query ? (
            <>
              <Heading>Files</Heading>
              {files.length === 0 ? (
                <div className="px-3 py-1.5 text-[12px] text-[#938a7c]">No matching files</div>
              ) : (
                files.map(fileRow)
              )}
              {tools.length > 0 && (
                <>
                  <Heading>Tools</Heading>
                  {tools.map(toolRow)}
                </>
              )}
            </>
          ) : (
            <>
              {added.length > 0 && (
                <>
                  <Heading>Added</Heading>
                  {added.map(toolRow)}
                  <Divider />
                </>
              )}
              <Row
                icon={Copy}
                label="Files & Folders"
                right={<ChevronRight size={14} className="text-[#938a7c]" />}
                onPress={() => setView('files')}
              />
              <Row
                icon={Wrench}
                label="Tools"
                right={<ChevronRight size={14} className="text-[#938a7c]" />}
                onPress={() => setView('tools')}
              />
            </>
          )}
        </>
      )}

      {view === 'files' && (
        <>
          <Back label="Files & Folders" />
          <Divider />
          {files.length === 0 ? (
            <div className="px-3 py-1.5 text-[12px] text-[#938a7c]">No matching files</div>
          ) : (
            files.map(fileRow)
          )}
        </>
      )}

      {view === 'tools' && (
        <>
          <Back label="Tools" />
          <Divider />
          {tools.length === 0 ? (
            <div className="px-3 py-1.5 text-[12px] text-[#938a7c]">No matching tools</div>
          ) : (
            tools.map(toolRow)
          )}
        </>
      )}
      </div>
    </div>
  )
}