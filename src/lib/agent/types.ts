// What a chat message is made of: plain text, or a tool/Python run shown as a collapsible row
export type ToolStatus = 'running' | 'awaiting' | 'done' | 'error'

export interface TextBlock {
  type: 'text'
  text: string
}

export interface ToolBlock {
  type: 'tool'
  id: string
  kind: 'python' | 'tool'
  name: string
  input: string
  output?: string
  status: ToolStatus
}

export type Block = TextBlock | ToolBlock

// The text of a message without tool rows (used for chat history, to save space)
export function plainText(blocks?: Block[]): string {
  return (blocks ?? [])
    .filter((b): b is TextBlock => b.type === 'text')
    .map((b) => b.text.trim())
    .filter(Boolean)
    .join('\n\n')
}

export const TOOL_LABELS: Record<string, [string, string]> = {
  list_files: ['Listing files', 'Listed files'],
  read_file: ['Reading file', 'Read file'],
  search_files: ['Searching files', 'Searched files'],
  create_file: ['Creating file', 'Created file'],
  remember: ['Saving note', 'Saved note'],
  forget: ['Removing notes', 'Removed notes'],
}