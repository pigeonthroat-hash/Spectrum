import type { FileNode, StorageProvider } from './types'

// Browser-private file storage (Origin Private File System).
// Works without an account in all modern browsers. Data is kept per site and
// is deleted if the user clears site data, so offer an export.

const entriesOf = (dir: FileSystemDirectoryHandle) =>
  dir as unknown as AsyncIterable<[string, FileSystemHandle]>

const splitPath = (path: string) => path.split('/').filter(Boolean)

export class OpfsStorage implements StorageProvider {
  private rootPromise: Promise<FileSystemDirectoryHandle>

  constructor(projectName: string) {
    if (!navigator.storage?.getDirectory) {
      throw new Error('This browser does not support browser file storage')
    }
    this.rootPromise = navigator.storage
      .getDirectory()
      .then((root) => root.getDirectoryHandle(projectName, { create: true }))
  }

  // Walks to the folder that holds `path`, creating folders on the way if asked
  private async parentOf(path: string, create: boolean) {
    const parts = splitPath(path)
    if (parts.length === 0) throw new Error('Path is empty')
    let dir = await this.rootPromise
    for (const part of parts.slice(0, -1)) {
      dir = await dir.getDirectoryHandle(part, { create })
    }
    return { dir, name: parts[parts.length - 1] }
  }

  async listTree(root = ''): Promise<FileNode[]> {
    let dir = await this.rootPromise
    for (const part of splitPath(root)) {
      dir = await dir.getDirectoryHandle(part)
    }
    return this.readDir(dir, root)
  }

  private async readDir(dir: FileSystemDirectoryHandle, prefix: string): Promise<FileNode[]> {
    const nodes: FileNode[] = []
    for await (const [name, handle] of entriesOf(dir)) {
      const path = prefix ? `${prefix}/${name}` : name
      if (handle.kind === 'directory') {
        const children = await this.readDir(handle as FileSystemDirectoryHandle, path)
        nodes.push({ name, path, type: 'folder', children })
      } else {
        nodes.push({ name, path, type: 'file' })
      }
    }
    // Folders first, then alphabetical
    return nodes.sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1
    )
  }

  async readFile(path: string): Promise<string> {
    const { dir, name } = await this.parentOf(path, false)
    const handle = await dir.getFileHandle(name)
    return (await handle.getFile()).text()
  }

  async writeFile(path: string, content: string): Promise<void> {
    const { dir, name } = await this.parentOf(path, true)
    const handle = await dir.getFileHandle(name, { create: true })
    const writable = await handle.createWritable()
    await writable.write(content)
    await writable.close()
  }

  async createFile(path: string): Promise<void> {
    const { dir, name } = await this.parentOf(path, true)
    await dir.getFileHandle(name, { create: true })
  }

  async createFolder(path: string): Promise<void> {
    let dir = await this.rootPromise
    for (const part of splitPath(path)) {
      dir = await dir.getDirectoryHandle(part, { create: true })
    }
  }

  // Files only for now. Folder rename comes with the explorer work.
  async rename(from: string, to: string): Promise<void> {
    const content = await this.readFile(from)
    await this.writeFile(to, content)
    await this.remove(from)
  }

  async remove(path: string): Promise<void> {
    const { dir, name } = await this.parentOf(path, false)
    await dir.removeEntry(name, { recursive: true })
  }
}
