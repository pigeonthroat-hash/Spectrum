import { create } from 'zustand'
import { useAppStore, type ChatMessage } from '../../store/useAppStore'
import { storageFor } from '../storage/active'
import { listAllPaths } from '../agent/tools'
import type { Block } from '../agent/types'

// Chats are saved as hidden files in the workspace: .spectrum/chats/<id>.json
const DIR = '.spectrum/chats'
const DAY = 86_400_000
const SIMPLIFY_AFTER = 14 * DAY
const SUMMARISE_AFTER = 30 * DAY
const DELETE_AFTER = 180 * DAY

export type ChatStage = 'full' | 'simplified' | 'summary'

export interface SavedChat {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  stage: ChatStage
  messages: ChatMessage[]
}

export interface ChatListItem {
  id: string
  title: string
  updatedAt: number
}

// The chat on screen, and the list of saved chats for the open workspace
export const useChatList = create<{
  chatId: string | null
  list: ChatListItem[]
  showList: boolean
  setChatId: (id: string | null) => void
  setList: (list: ChatListItem[]) => void
  setShowList: (show: boolean) => void
}>()((set) => ({
  chatId: null,
  list: [],
  showList: false,
  setChatId: (id) => set({ chatId: id }),
  setList: (list) => set({ list }),
  setShowList: (show) => set({ showList: show }),
}))

export function startNewChat(): void {
  useChatList.getState().setChatId(null)
  useAppStore.setState({ messages: [] })
}

function titleFrom(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 48) || 'New chat'
}

async function readChat(projectId: string, path: string): Promise<SavedChat | null> {
  try {
    return JSON.parse(await storageFor(projectId).readFile(path)) as SavedChat
  } catch {
    return null
  }
}

async function chatPaths(projectId: string): Promise<string[]> {
  return (await listAllPaths(projectId)).filter((p) => p.startsWith(DIR + '/') && p.endsWith('.json'))
}

export async function refreshChatList(projectId: string): Promise<void> {
  const items: ChatListItem[] = []
  for (const path of await chatPaths(projectId)) {
    const chat = await readChat(projectId, path)
    if (chat) items.push({ id: chat.id, title: chat.title, updatedAt: chat.updatedAt })
  }
  items.sort((a, b) => b.updatedAt - a.updatedAt)
  useChatList.getState().setList(items)
}

// Saves the chat on screen. Nothing is saved until the chat has a message and a workspace is open.
export async function persistCurrentChat(): Promise<void> {
  const { messages, projectId } = useAppStore.getState()
  const firstUser = messages.find((m) => m.role === 'user')
  if (!firstUser || !projectId) return

  const list = useChatList.getState()
  const chatId = list.chatId ?? crypto.randomUUID()
  if (!list.chatId) list.setChatId(chatId)

  const path = `${DIR}/${chatId}.json`
  const existing = await readChat(projectId, path)
  const now = Date.now()
  const chat: SavedChat = {
    id: chatId,
    title: existing?.title ?? titleFrom(firstUser.content),
    createdAt: existing?.createdAt ?? firstUser.timestamp,
    updatedAt: now,
    stage: 'full', // activity makes the chat fresh again
    messages,
  }
  await storageFor(projectId).writeFile(path, JSON.stringify(chat))
  await refreshChatList(projectId)
}

export async function openChat(projectId: string, id: string): Promise<void> {
  const chat = await readChat(projectId, `${DIR}/${id}.json`)
  if (!chat) return
  useChatList.getState().setChatId(id)
  useAppStore.setState({ messages: chat.messages })
}

// Plain summary, with no model call: the questions and the final answers
function summaryOf(chat: SavedChat): ChatMessage {
  const lines: string[] = [`Earlier chat "${chat.title}", summarised:`]
  for (const m of chat.messages) {
    if (m.role === 'user') lines.push(`You asked: ${m.content.slice(0, 200)}`)
    else {
      const text = (m.blocks ?? [])
        .filter((b): b is Extract<Block, { type: 'text' }> => b.type === 'text')
        .map((b) => b.text.trim())
        .filter(Boolean)
        .join(' ')
      if (text) lines.push(`Answer: ${text.slice(0, 300)}`)
    }
  }
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: lines.join('\n').slice(0, 2000),
    timestamp: chat.updatedAt,
    blocks: [{ type: 'text', text: lines.join('\n').slice(0, 2000) }],
  }
}

// Runs when a workspace opens: old chats are simplified, then summarised, then deleted
export async function ageChats(projectId: string): Promise<void> {
  const now = Date.now()
  const openId = useChatList.getState().chatId
  const storage = storageFor(projectId)
  for (const path of await chatPaths(projectId)) {
    const chat = await readChat(projectId, path)
    if (!chat) continue
    const age = now - chat.updatedAt

    if (age > DELETE_AFTER && chat.id !== openId) {
      await storage.remove(path)
      continue
    }
    if (age > SUMMARISE_AFTER && chat.stage !== 'summary') {
      await storage.writeFile(path, JSON.stringify({ ...chat, stage: 'summary', messages: [summaryOf(chat)] }))
      continue
    }
    if (age > SIMPLIFY_AFTER && chat.stage === 'full') {
      const messages = chat.messages.map((m) => ({
        ...m,
        blocks: m.blocks?.map((b) => (b.type === 'tool' ? { ...b, output: undefined } : b)),
      }))
      await storage.writeFile(path, JSON.stringify({ ...chat, stage: 'simplified', messages }))
    }
  }
  await refreshChatList(projectId)
}