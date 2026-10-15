export interface FileNode {
  name: string
  path: string // relative to the project root, e.g. "src/App.tsx"
  type: 'file' | 'folder'
  children?: FileNode[]
}

// Every storage mode (browser, local folder, Electron disk, cloud) implements this,
// so the editor works the same way in each.
export interface StorageProvider {
  listTree(root?: string): Promise<FileNode[]>
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  createFile(path: string): Promise<void>
  createFolder(path: string): Promise<void>
  rename(from: string, to: string): Promise<void>
  remove(path: string): Promise<void>
}
