import { useCallback, useEffect, useState } from 'react'
import { useAppStore, type FileNode } from '../store/useAppStore'
import { Folder, File, ChevronRight, ChevronDown, FolderOpen, FilePlus, FolderPlus, RefreshCw, Trash2 } from 'lucide-react'
import { cn } from '../lib/utils'
import { CloudProjects } from './CloudProjects'
import { storageFor } from '../lib/storage/active'
import { errorText } from '../lib/errors'

function languageFor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'ts' || ext === 'tsx') return 'typescript'
  if (ext === 'js' || ext === 'jsx') return 'javascript'
  if (ext === 'py') return 'python'
  if (ext === 'rs') return 'rust'
  if (ext === 'json') return 'json'
  if (ext === 'css') return 'css'
  if (ext === 'html') return 'html'
  if (ext === 'md') return 'markdown'
  return 'plaintext'
}

interface TreeItemProps {
  node: FileNode
  depth: number
  onOpen: (node: FileNode) => void
  onDelete: (node: FileNode) => void
}

function TreeItem({ node, depth, onOpen, onDelete }: TreeItemProps) {
  const [open, setOpen] = useState(depth < 1)
  const activeTabPath = useAppStore((s) => s.activeTabPath)

  const isFolder = node.type === 'folder'
  const isActive = activeTabPath === node.path

  const handleClick = () => {
    if (isFolder) setOpen((o) => !o)
    else onOpen(node)
  }

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1.5 px-2 py-1 cursor-pointer text-sm hover:bg-[#21262d] rounded-sm select-none',
          isActive && 'bg-[#21262d] text-white'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        {isFolder ? (
          open ? <ChevronDown size={14} className="text-[#8b949e] shrink-0" /> : <ChevronRight size={14} className="text-[#8b949e] shrink-0" />
        ) : (
          <span className="w-[14px]" />
        )}
        {isFolder ? (
          open ? <FolderOpen size={15} className="text-[#58a6ff] shrink-0" /> : <Folder size={15} className="text-[#58a6ff] shrink-0" />
        ) : (
          <File size={15} className="text-[#8b949e] shrink-0" />
        )}
        <span className="truncate text-[#e6edf3] flex-1">{node.name}</span>
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
      {isFolder && open &&
        node.children?.map((child) => (
          <TreeItem key={child.path} node={child} depth={depth + 1} onOpen={onOpen} onDelete={onDelete} />
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
  const setProject = useAppStore((s) => s.setProject)
  const openTabs = useAppStore((s) => s.openTabs)
  const [error, setError] = useState<string | null>(null)

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
      const text = await storageFor(projectId).readFile(node.path)
      openFile(node.path, node.name, text, languageFor(node.name))
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

  const closeProject = () => {
    if (openTabs.some((t) => t.isDirty) && !window.confirm('You have unsaved changes. Close the project anyway?')) return
    setProject(null, null)
  }

  return (
    <div className="h-full flex flex-col bg-[#0d1117] border-r border-[#30363d]">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[#30363d] text-xs font-semibold text-[#8b949e] uppercase tracking-wider">
        <span className="truncate">{projectId ? projectName ?? 'Explorer' : 'Explorer'}</span>
        {projectId && (
          <div className="flex items-center gap-1 shrink-0">
            <button title="New file" onClick={() => create('file')} className="p-1 rounded hover:bg-[#21262d]">
              <FilePlus size={13} />
            </button>
            <button title="New folder" onClick={() => create('folder')} className="p-1 rounded hover:bg-[#21262d]">
              <FolderPlus size={13} />
            </button>
            <button title="Refresh" onClick={refresh} className="p-1 rounded hover:bg-[#21262d]">
              <RefreshCw size={13} />
            </button>
            <button
              title="Close project"
              onClick={closeProject}
              className="px-1.5 py-0.5 rounded hover:bg-[#21262d] normal-case tracking-normal text-[11px]"
            >
              Close
            </button>
          </div>
        )}
      </div>

      {error && <p className="px-3 py-2 text-xs text-[#f85149]">{error}</p>}

      {!projectId ? (
        <CloudProjects />
      ) : (
        <div className="flex-1 overflow-y-auto py-1">
          {fileTree.length === 0 && (
            <p className="px-3 py-2 text-xs text-[#8b949e]">Empty project. Use the buttons above to add a file.</p>
          )}
          {fileTree.map((node) => (
            <TreeItem key={node.path} node={node} depth={0} onOpen={openNode} onDelete={deleteNode} />
          ))}
        </div>
      )}
    </div>
  )
}