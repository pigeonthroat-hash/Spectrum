import { useAppStore, type FileNode } from '../store/useAppStore'
import { Folder, File, ChevronRight, ChevronDown, FolderOpen } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../lib/utils'

function TreeItem({ node, depth = 0 }: { node: FileNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 1)
  const { openFile, activeTabPath } = useAppStore()

  const isFolder = node.type === 'folder'
  const isActive = activeTabPath === node.path

  const handleClick = () => {
    if (isFolder) {
      setOpen(!open)
    } else {
      const demoContent = `// ${node.name}\n\nconsole.log("Hello from ${node.name}");\n`
      const lang = node.name.endsWith('.ts') || node.name.endsWith('.tsx')
        ? 'typescript'
        : node.name.endsWith('.js')
          ? 'javascript'
          : node.name.endsWith('.py')
            ? 'python'
            : node.name.endsWith('.rs')
              ? 'rust'
              : 'plaintext'
      openFile(node.path, node.name, demoContent, lang)
    }
  }

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 cursor-pointer text-sm hover:bg-[#21262d] rounded-sm select-none',
          isActive && 'bg-[#21262d] text-white'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        {isFolder ? (
          open ? (
            <ChevronDown size={14} className="text-[#8b949e] shrink-0" />
          ) : (
            <ChevronRight size={14} className="text-[#8b949e] shrink-0" />
          )
        ) : (
          <span className="w-[14px]" />
        )}
        {isFolder ? (
          open ? (
            <FolderOpen size={15} className="text-[#58a6ff] shrink-0" />
          ) : (
            <Folder size={15} className="text-[#58a6ff] shrink-0" />
          )
        ) : (
          <File size={15} className="text-[#8b949e] shrink-0" />
        )}
        <span className="truncate text-[#e6edf3]">{node.name}</span>
      </div>
      {isFolder && open && node.children?.map((child) => (
        <TreeItem key={child.path} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}

export function FileExplorer() {
  const { fileTree, rootPath, setRootPath, setFileTree } = useAppStore()

  const handleOpenFolder = () => {
    const demoTree: FileNode[] = [
      {
        name: 'src',
        path: '/demo/src',
        type: 'folder',
        children: [
          { name: 'main.ts', path: '/demo/src/main.ts', type: 'file' },
          { name: 'App.tsx', path: '/demo/src/App.tsx', type: 'file' },
          { name: 'utils.ts', path: '/demo/src/utils.ts', type: 'file' },
          {
            name: 'components',
            path: '/demo/src/components',
            type: 'folder',
            children: [
              { name: 'Button.tsx', path: '/demo/src/components/Button.tsx', type: 'file' },
              { name: 'Header.tsx', path: '/demo/src/components/Header.tsx', type: 'file' },
            ],
          },
        ],
      },
      {
        name: 'package.json',
        path: '/demo/package.json',
        type: 'file',
      },
      {
        name: 'README.md',
        path: '/demo/README.md',
        type: 'file',
      },
      {
        name: 'tsconfig.json',
        path: '/demo/tsconfig.json',
        type: 'file',
      },
    ]
    setRootPath('/demo')
    setFileTree(demoTree)
  }

  return (
    <div className="h-full flex flex-col bg-[#0d1117] border-r border-[#30363d]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] text-xs font-semibold text-[#8b949e] uppercase tracking-wider">
        <span>Explorer</span>
      </div>

      {!rootPath ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-3">
          <p className="text-sm text-[#8b949e] text-center">
            No folder opened
          </p>
          <button
            onClick={handleOpenFolder}
            className="px-4 py-2 bg-[#238636] hover:bg-[#2ea043] text-white text-sm font-medium rounded-md transition-colors"
          >
            Open Folder
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto py-1">
          <div className="px-2 py-1 text-xs text-[#8b949e] truncate">{rootPath}</div>
          {fileTree.map((node) => (
            <TreeItem key={node.path} node={node} />
          ))}
        </div>
      )}
    </div>
  )
}
