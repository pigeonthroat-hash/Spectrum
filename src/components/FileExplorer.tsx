import { ExplorerSections } from './ExplorerSections'
import { isBinaryName } from '../lib/files/kinds'
import { uploadFiles } from '../lib/files/upload'
import { useFolderMenu } from '../lib/run/menuStore'
import { languageFor } from '../lib/languages'
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useAppStore, type FileNode } from '../store/useAppStore'
import { Folder, ChevronRight, ChevronDown, FolderOpen, FilePlus, FolderPlus, RefreshCw, Trash2, Upload } from 'lucide-react'
import { cn } from '../lib/utils'
import { CloudProjects } from './CloudProjects'
import { FileIcon } from './FileIcon'
import { storageFor } from '../lib/storage/active'
import { errorText } from '../lib/errors'
import { useDragStore, type FileTarget } from '../lib/dragStore'
import { beginPointerDrag, clickWasDrag } from '../lib/pointerDrag'
import { isMobileNow } from '../lib/useIsMobile'

const parentOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '')

// Can `from` go into `folder`? Not into its current folder (no change), not into itself.
function canMove(from: string, folder: string): boolean {
  if (folder === parentOf(from)) return false
  if (folder === from || folder.startsWith(`${from}/`)) return false
  return true
}


// Folders with only one subfolder inside are shown as one row: "components/ui"
function compactTree(nodes: FileNode[]): FileNode[] {
  return nodes.map((node) => {
    if (node.type !== 'folder') return node
    let current = node
    const names = [node.name]
    while (current.children && current.children.length === 1 && current.children[0].type === 'folder') {
      current = current.children[0]
      names.push(current.name)
    }
    return { ...current, name: names.join('/'), children: compactTree(current.children ?? []) }
  })
}

const INDENT_PX = 12
const GUIDE_OFFSET_PX = 15 // center of an ancestor's chevron

interface TreeItemProps {
  node: FileNode
  depth: number
  collapsed: Set<string>
  onToggle: (path: string) => void
  onOpen: (node: FileNode) => void
  onDelete: (node: FileNode) => void
  onStartDrag: (node: FileNode, e: ReactPointerEvent) => void
}

function TreeItem({ node, depth, collapsed, onToggle, onOpen, onDelete, onStartDrag }: TreeItemProps) {
  const activeTabPath = useAppStore((s) => s.activeTabPath)
  // Only the row that is the current drop target re-renders during a drag
  const target = useDragStore((s) => (s.fileTarget && s.fileTarget.row === node.path ? s.fileTarget : null))
  const dragging = useDragStore((s) => s.item?.kind === 'file' && s.item.path === node.path)

  const isFolder = node.type === 'folder'
  const projectId = useAppStore((s) => s.projectId)
  const isOpen = isFolder && !collapsed.has(node.path)
  const isActive = activeTabPath === node.path

  return (
    <div>
      <div
        data-node-path={node.path}
        data-node-folder={isFolder ? 'true' : 'false'}
        onDragOver={(e) => {
          if (!isFolder || !e.dataTransfer.types.includes('Files')) return
          e.preventDefault()
          e.stopPropagation()
        }}
        onDrop={(e) => {
          if (!isFolder || !e.dataTransfer.types.includes('Files') || !projectId) return
          e.preventDefault()
          e.stopPropagation()
          void uploadFiles(Array.from(e.dataTransfer.files), projectId)
        }}
        onContextMenu={(e) => {
          if (!isFolder) return
          e.preventDefault()
          useFolderMenu.getState().open(e.clientX, e.clientY, node.path)
        }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return
          onStartDrag(node, e)
        }}
        onClick={() => {
          if (clickWasDrag()) return
          if (isFolder) onToggle(node.path)
          else onOpen(node)
        }}
        className={cn(
          'group relative flex items-center gap-1.5 py-[3px] pr-2 cursor-pointer text-[13px] hover:bg-[#21262d] select-none',
          isActive ? 'bg-[#21262d] text-white' : 'text-[#c9d1d9]',
          target?.edge === 'inside' && 'ring-1 ring-inset ring-[#e6edf3]/70 bg-[#21262d]',
          dragging && 'opacity-40'
        )}
        style={{ paddingLeft: `${depth * INDENT_PX + 8}px` }}
      >
        {/* Indent guides: one line for each ancestor folder */}
        {Array.from({ length: depth }, (_, i) => (
          <span
            key={i}
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-[#30363d]"
            style={{ left: `${i * INDENT_PX + GUIDE_OFFSET_PX}px` }}
          />
        ))}

        {target?.edge === 'top' && (
          <span className="pointer-events-none absolute left-0 right-0 -top-px h-0.5 bg-[#e6edf3]" />
        )}
        {target?.edge === 'bottom' && (
          <span className="pointer-events-none absolute left-0 right-0 -bottom-px h-0.5 bg-[#e6edf3]" />
        )}

        {isFolder ? (
          isOpen ? <ChevronDown size={14} className="shrink-0 text-[#8b949e]" /> : <ChevronRight size={14} className="shrink-0 text-[#8b949e]" />
        ) : (
          <span className="w-[14px] shrink-0" />
        )}
        {isFolder ? (
          isOpen ? <FolderOpen size={14} className="shrink-0 text-[#8b949e]" /> : <Folder size={14} className="shrink-0 text-[#8b949e]" />
        ) : (
          <FileIcon name={node.name} />
        )}
        <span className="truncate flex-1">{node.name}</span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(node)
          }}
          title="Delete"
          className="opacity-0 group-hover:opacity-100 p-0.5 text-[#8b949e] hover:text-[#f85149]"
        >
          <Trash2 size={12} />
        </button>
      </div>
      {isOpen &&
        node.children?.map((child) => (
          <TreeItem
            key={child.path}
            node={child}
            depth={depth + 1}
            collapsed={collapsed}
            onToggle={onToggle}
            onOpen={onOpen}
            onDelete={onDelete}
            onStartDrag={onStartDrag}
          />
        ))}
    </div>
  )
}

export function FileExplorer() {
  const projectId = useAppStore((s) => s.projectId)
  const projectName = useAppStore((s) => s.projectName)
  const fileTree = useAppStore((s) => s.fileTree)
  const setFileTree = useAppStore((s) => s.setFileTree)
  const openFile = useAppStore((s) => s.openFile)
  const closeTab = useAppStore((s) => s.closeTab)
  const remapTabs = useAppStore((s) => s.remapTabs)
  const setProject = useAppStore((s) => s.setProject)
  const openTabs = useAppStore((s) => s.openTabs)

  const displayTree = useMemo(() => compactTree(fileTree.filter((n) => !n.name.startsWith('.'))), [fileTree])

  // Folders are open by default. This set holds the ones the user closed.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const collapsedRef = useRef(collapsed)
  collapsedRef.current = collapsed
  const [error, setError] = useState<string | null>(null)

  // Auto-open a closed folder when a drag hovers over it
  const expandTimer = useRef<number | null>(null)
  const expandFolder = useRef<string | null>(null)
  const clearExpandTimer = useCallback(() => {
    if (expandTimer.current !== null) window.clearTimeout(expandTimer.current)
    expandTimer.current = null
    expandFolder.current = null
  }, [])
  useEffect(() => clearExpandTimer, [clearExpandTimer])

  const dragActive = useDragStore((s) => s.item !== null)
  const rootHot = useDragStore((s) => s.fileTarget !== null && s.fileTarget.row === null)
  useEffect(() => {
    if (!dragActive) clearExpandTimer()
  }, [dragActive, clearExpandTimer])

  const toggle = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  const refresh = useCallback(async () => {
    if (!projectId) return
    try {
      setFileTree(await storageFor(projectId).listTree())
      setError(null)
    } catch (err) {
      setError(errorText(err))
    }
  }, [projectId, setFileTree])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const openNode = async (node: FileNode) => {
    if (!projectId) return
    try {
      // Pictures and other binary files are shown by the editor area, not read as text
      if (isBinaryName(node.name)) {
        openFile(node.path, node.name, '', 'plaintext')
        return
      }
      const text = await storageFor(projectId).readFile(node.path)
      openFile(node.path, node.name, text, languageFor(node.name))
      if (isMobileNow()) useAppStore.getState().setMobileView('editor')
    } catch (err) {
      setError(errorText(err))
    }
  }

  const create = async (kind: 'file' | 'folder') => {
    if (!projectId) return
    const input = window.prompt(
      kind === 'file' ? 'New file name (folders allowed, e.g. src/app.ts)' : 'New folder name (e.g. src/utils)'
    )
    const path = input?.trim().replace(/^\/+|\/+$/g, '')
    if (!path) return
    try {
      const storage = storageFor(projectId)
      if (kind === 'file') {
        await storage.createFile(path)
        await refresh()
        await openNode({ name: path.split('/').pop() ?? path, path, type: 'file' })
      } else {
        await storage.createFolder(path)
        await refresh()
      }
    } catch (err) {
      setError(errorText(err))
    }
  }

  const deleteNode = async (node: FileNode) => {
    if (!projectId) return
    const what = node.type === 'folder' ? 'folder and everything inside it' : 'file'
    if (!window.confirm(`Delete ${what} "${node.name}"? This can't be undone.`)) return
    try {
      await storageFor(projectId).remove(node.path)
      openTabs
        .filter((t) => t.path === node.path || t.path.startsWith(`${node.path}/`))
        .forEach((t) => closeTab(t.path))
      await refresh()
    } catch (err) {
      setError(errorText(err))
    }
  }

  const moveNode = async (from: string, toFolder: string) => {
    if (!projectId) return
    const storage = storageFor(projectId)
    const name = from.split('/').pop() ?? from
    const dest = toFolder ? `${toFolder}/${name}` : name
    const oldParent = parentOf(from)
    try {
      await storage.rename(from, dest)
      // Empty folders aren't stored, so keep the folder we just emptied
      if (oldParent && (await storage.listTree(oldParent)).length === 0) {
        await storage.createFolder(oldParent)
      }
      remapTabs(from, dest)
      await refresh()
    } catch (err) {
      setError(errorText(err))
    }
  }

  const closeProject = () => {
    if (openTabs.some((t) => t.isDirty) && !window.confirm('You have unsaved changes. Close the project anyway?')) return
    setProject(null, null)
  }

  // Works out where the dragged item would land under the pointer
  const computeTarget = (x: number, y: number, from: string): FileTarget | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    const row = el?.closest<HTMLElement>('[data-node-path]') ?? null
    const rowPath = row?.dataset.nodePath
    let target: FileTarget | null = null

    if (row && rowPath !== undefined) {
      const r = row.getBoundingClientRect()
      const rel = (y - r.top) / r.height
      const isRowFolder = row.dataset.nodeFolder === 'true'
      if (isRowFolder && rel > 0.25 && rel < 0.75) {
        // Middle of a folder: put it inside
        target = { folder: rowPath, row: rowPath, edge: 'inside' }
      } else {
        // Top or bottom edge: put it next to this row, in the row's folder
        target = { folder: parentOf(rowPath), row: rowPath, edge: rel < 0.5 ? 'top' : 'bottom' }
      }
    } else if (el?.closest('[data-tree-root]')) {
      // Empty space: top level
      target = { folder: '', row: null, edge: null }
    }

    if (target && !canMove(from, target.folder)) return null
    return target
  }

  const scheduleExpand = (target: FileTarget | null) => {
    const folder = target?.edge === 'inside' ? target.folder : null
    if (folder === null || !collapsedRef.current.has(folder)) {
      clearExpandTimer()
      return
    }
    if (expandFolder.current === folder) return
    clearExpandTimer()
    expandFolder.current = folder
    expandTimer.current = window.setTimeout(() => {
      setCollapsed((prev) => {
        const next = new Set(prev)
        next.delete(folder)
        return next
      })
      expandTimer.current = null
      expandFolder.current = null
    }, 600)
  }

  const startRowDrag = (node: FileNode, e: ReactPointerEvent) => {
    beginPointerDrag(
      e,
      () => ({ kind: 'file', path: node.path, name: node.name, isFolder: node.type === 'folder' }),
      (x, y) => {
        const target = computeTarget(x, y, node.path)
        useDragStore.getState().setFileTarget(target)
        scheduleExpand(target)
      },
      () => {
        const target = useDragStore.getState().fileTarget
        clearExpandTimer()
        if (target) void moveNode(node.path, target.folder)
      }
    )
  }

  const uploadInput = useRef<HTMLInputElement>(null)

  return (
    <div
      className="h-full flex flex-col bg-[#0d1117]"
      onContextMenu={(e) => {
        // Right-click on empty space (not on a file or folder row) runs the whole project
        if ((e.target as HTMLElement).closest('[data-node-path]') || !projectId) return
        e.preventDefault()
        useFolderMenu.getState().open(e.clientX, e.clientY, '')
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) e.preventDefault()
      }}
      onDrop={(e) => {
        // Files dragged in from your computer go to the project root
        if (!e.dataTransfer.types.includes('Files') || !projectId) return
        e.preventDefault()
        void uploadFiles(Array.from(e.dataTransfer.files), projectId)
      }}
    >
      {projectId && (
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-[#30363d]">
          <span className="flex items-center gap-0.5 min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-[#c9d1d9]">
            <ChevronDown size={12} className="shrink-0" />
            <span className="truncate">{projectName}</span>
          </span>
          <div className="flex items-center gap-0.5 shrink-0">
            <button title="New file" onClick={() => create('file')} className="p-1 rounded hover:bg-[#21262d]">
              <FilePlus size={13} />
            </button>
            <button title="New folder" onClick={() => create('folder')} className="p-1 rounded hover:bg-[#21262d]">
              <FolderPlus size={13} />
            </button>
            <button title="Upload files" onClick={() => uploadInput.current?.click()} className="p-1 rounded hover:bg-[#21262d]">
              <Upload size={13} />
            </button>
            <input
              ref={uploadInput}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                const list = Array.from(e.target.files ?? [])
                e.target.value = ''
                if (projectId && list.length > 0) void uploadFiles(list, projectId)
              }}
            />
            <button title="Refresh" onClick={refresh} className="p-1 rounded hover:bg-[#21262d]">
              <RefreshCw size={13} />
            </button>
            <button
              title="Close project"
              onClick={closeProject}
              className="px-1.5 py-0.5 rounded hover:bg-[#21262d] text-[11px] text-[#8b949e]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {error && <p className="px-3 py-2 text-xs text-[#f85149]">{error}</p>}

      {!projectId ? (
        <CloudProjects />
      ) : (
        <div
          data-tree-root
          className={cn('flex-1 overflow-y-auto py-1', rootHot && 'ring-1 ring-inset ring-[#e6edf3]/40')}
        >
          {displayTree.length === 0 && (
            <p className="px-3 py-2 text-xs text-[#8b949e]">Empty project. Use the buttons above to add a file.</p>
          )}
          {displayTree.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              depth={0}
              collapsed={collapsed}
              onToggle={toggle}
              onOpen={openNode}
              onDelete={deleteNode}
              onStartDrag={startRowDrag}
            />
          ))}
        </div>
      )}
      {projectId && <ExplorerSections />}
    </div>
  )
}