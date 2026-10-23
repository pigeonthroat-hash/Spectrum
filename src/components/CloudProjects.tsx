import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { useAuth } from '../lib/auth'
import { createProject, deleteProject, listProjects, type ProjectRow } from '../lib/storage/cloud'
import { errorText } from '../lib/errors'

export function CloudProjects() {
  const { user, loading } = useAuth()
  const setProject = useAppStore((s) => s.setProject)
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      setProjects(await listProjects())
      setError(null)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    if (user) void load()
    else setProjects([])
  }, [user, load])

  const create = async () => {
    const name = window.prompt('Project name')?.trim()
    if (!name) return
    setBusy(true)
    try {
      const row = await createProject(name)
      setProject(row.id, row.name)
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  const remove = async (p: ProjectRow) => {
    if (!window.confirm(`Delete project "${p.name}" and all its files? This can't be undone.`)) return
    try {
      await deleteProject(p.id)
      await load()
    } catch (err) {
      setError(errorText(err))
    }
  }

  if (loading) return <p className="p-3 text-xs text-[#938a7c]">Checking sign-in...</p>

  if (!user) {
    return (
      <div className="p-4 text-xs text-[#938a7c]">
        Sign in with the account icon in the top bar to create and open cloud projects.
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs text-[#938a7c]">Cloud projects</span>
        <button
          onClick={create}
          disabled={busy}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-[#f0a93b] hover:bg-[#f5b952] text-[#1a1407] disabled:opacity-50"
        >
          <Plus size={12} /> New
        </button>
      </div>
      {error && <p className="px-3 pb-2 text-xs text-[#f85149]">{error}</p>}
      <div className="flex-1 overflow-y-auto">
        {!busy && projects.length === 0 && (
          <p className="px-3 py-2 text-xs text-[#938a7c]">No projects yet. Click New to create one.</p>
        )}
        {projects.map((p) => (
          <div key={p.id} className="group flex items-center justify-between gap-2 px-3 py-2 hover:bg-[#2a261f]">
            <button onClick={() => setProject(p.id, p.name)} className="min-w-0 text-left">
              <span className="block truncate text-sm text-[#ece6da]">{p.name}</span>
              <span className="block text-[10px] text-[#938a7c]">
                Updated {new Date(p.updated_at).toLocaleDateString()}
              </span>
            </button>
            <button
              onClick={() => remove(p)}
              title="Delete project"
              className="opacity-0 group-hover:opacity-100 p-1 text-[#938a7c] hover:text-[#f85149]"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}