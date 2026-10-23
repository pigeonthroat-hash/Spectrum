import { ChevronDown } from 'lucide-react'
import { Wrench } from 'lucide-react'
import { useToolToggles } from '../lib/tools/toggles'
import { useAttachments } from '../lib/chat/attachments'
import { isBinaryName } from '../lib/files/kinds'
import { useState, useRef, useEffect } from 'react'
import { useAppStore, type ChatMessage } from '../store/useAppStore'
import { Loader2, Sparkles, File, Square } from 'lucide-react'
import { ChatInput } from './ChatInput'
import { ChatBody } from './ChatBody'
import { MessageList } from './MessageList'
import { runAgent } from '../lib/agent/runAgent'
import { plainText, type Block } from '../lib/agent/types'
import { errorText } from '../lib/errors'
import { listPaths } from '../lib/agent/tools'
import { storageFor } from '../lib/storage/active'
import { MessageContent } from './MessageContent'
import { markReplyStarted } from '../lib/agent/autoApply'
import { cancelAllDecisions } from '../lib/agent/decisions'
import { applyPending, declinePending } from '../lib/agent/applyChange'
import { LOCAL_MODELS, GROQ_MODELS } from '../lib/models'
import { ChatHeader } from './ChatHeader'
import { StepsGroup, groupBlocks } from './StepsGroup'
import { PastChats } from './PastChats'
import { ChatTabs } from './ChatTabs'
import { ReplyParts } from './ReplyParts'
import { attachReviewToLastReply } from '../lib/chats/replyMeta'
import { persistCurrentChat, ageChats, refreshChatList, useChatList } from '../lib/chats/chatStore'
import { SessionsList } from './SessionsList'

// Only the last few messages are sent to the model, to keep requests small
const HISTORY_TURNS = 6

// Files mentioned with @ are read and added to what the model sees (the chat bubble still shows only the typed text)
const MAX_MENTIONED_FILES = 3
const MAX_MENTIONED_CHARS = 8000

async function attachMentions(text: string, projectId: string | null, extra: string[] = []): Promise<string> {
  if (!projectId) return text
  const mentioned = [...new Set([...text.matchAll(/(?:^|\s)@([^\s@]+)/g)].map((m) => m[1]))]
  for (const p of extra) if (!mentioned.includes(p)) mentioned.push(p)
  if (mentioned.length === 0) return text
  const known = new Set(await listPaths(projectId))
  const storage = storageFor(projectId)
  const parts: string[] = []
  for (const path of mentioned.filter((p) => known.has(p) && !isBinaryName(p)).slice(0, MAX_MENTIONED_FILES)) {
    try {
      const content = await storage.readFile(path)
      parts.push(`File ${path}:\n${content.slice(0, MAX_MENTIONED_CHARS)}`)
    } catch {
      // A file that can't be read is skipped
    }
  }
  return parts.length ? `${text}\n\n${parts.join('\n\n')}` : text
}

// Turns technical errors into a message the user can act on
function friendlyError(err: unknown): string {
  const raw = errorText(err)
  if (/ollama/i.test(raw) && /reach|connect|fetch/i.test(raw)) {
    return "Ollama isn't running. Start Ollama, or pick a Groq model."
  }
  if (/device lost|mapAsync|Instance reference|GPU/i.test(raw)) {
    return 'The browser lost its graphics connection while the model was running. This usually means the model is too big for this computer. Try a smaller model, or a Groq model.'
  }
  if (/out of memory|OOM/i.test(raw)) {
    return 'This computer ran out of memory for the model. Close other apps, or pick a smaller model.'
  }
  if (/quota/i.test(raw)) {
    return 'Not enough browser storage for this model. Free up disk space, or pick a smaller model.'
  }
  return raw
}

// Totals for the pending changes bar: lines added and removed across all proposed changes
function diffTotals(diffs: { original: string; modified: string }[]) {
  return diffs.reduce(
    (t, d) => ({
      plus: t.plus + (d.modified ? d.modified.split('\n').length : 0),
      minus: t.minus + (d.original ? d.original.split('\n').length : 0),
    }),
    { plus: 0, minus: 0 }
  )
}

export function AISidebar() {
  const messages = useAppStore((s) => s.messages)
  const addMessage = useAppStore((s) => s.addMessage)
  const patchMessage = useAppStore((s) => s.patchMessage)
  const isGenerating = useAppStore((s) => s.isGenerating)
  const setGenerating = useAppStore((s) => s.setGenerating)
  const selectedModel = useAppStore((s) => s.selectedModel)
  const setModel = useAppStore((s) => s.setModel)
  const mode = useAppStore((s) => s.mode)
  const setMode = useAppStore((s) => s.setMode)
  const pendingDiffs = useAppStore((s) => s.pendingDiffs)
  const activeTabPath = useAppStore((s) => s.activeTabPath)
  const openTabs = useAppStore((s) => s.openTabs)
  const chatStyle = useAppStore((s) => s.chatStyle)
  const projectId = useAppStore((s) => s.projectId)

  const [input, setInput] = useState('')
  const showList = useChatList((s) => s.showList)
  const [useFile, setUseFile] = useState(true)
  const [filePaths, setFilePaths] = useState<string[]>([])
  // Controller for the reply in progress; Stop calls abort() on it
  const abortRef = useRef<AbortController | null>(null)

  const activeFile = openTabs.find((t) => t.path === activeTabPath) ?? null

  // A saved model that is no longer in the list is replaced with a working Groq model
  useEffect(() => {
    const knownLocal = LOCAL_MODELS.some((m) => m.id === selectedModel)
    const knownGroq = GROQ_MODELS.some((m) => m.id === selectedModel)
    if ((selectedModel.startsWith('browser/') && !knownLocal) || (selectedModel.startsWith('groq/') && !knownGroq)) {
      setModel(GROQ_MODELS[0].id)
    }
  }, [selectedModel, setModel])

  // Refresh the file list for the @ menu when the project or the chat changes (the agent may have created files)
  useEffect(() => {
    if (!projectId) {
      setFilePaths([])
      return
    }
    listPaths(projectId).then(setFilePaths).catch(() => setFilePaths([]))
  }, [projectId, messages.length])

  // Old chats are simplified, summarised, or deleted when a workspace opens
  useEffect(() => {
    if (!projectId) return
    void ageChats(projectId).then(() => refreshChatList(projectId))
  }, [projectId])

  const handleSend = async () => {
    const text = input.trim()
    const attachedPaths = useAttachments.getState().files
    if ((!text && attachedPaths.length === 0) || isGenerating) return
    useAttachments.getState().clear()
    setInput('')

    // Earlier turns as plain text only (tool rows are left out to save space)
    const history = messages.slice(-HISTORY_TURNS).map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.role === 'user' ? m.content : plainText(m.blocks) || m.content,
    })).filter((t) => t.content)

    addMessage({
      role: 'user',
      content: text,
      fileName: useFile && activeFile ? activeFile.name : undefined,
      attachments: attachedPaths,
      tools: useToolToggles.getState().enabled,
    })
    const assistantId = addMessage({ role: 'assistant', content: '', blocks: [] })
    setGenerating(true)

    const setBlocks = (update: (blocks: Block[]) => Block[]) =>
      patchMessage(assistantId, (m) => {
        const blocks = update(m.blocks ?? [])
        return { ...m, blocks, content: plainText(blocks) }
      })

    const controller = new AbortController()
    abortRef.current = controller
    markReplyStarted(assistantId)

    try {
      await runAgent({
        projectId,
        modelId: selectedModel,
        mode: projectId ? mode : 'ask',
        history,
        userText: await attachMentions(text, projectId, attachedPaths),
        activeFileName: useFile && activeFile ? activeFile.name : null,
        setBlocks,
        signal: controller.signal,
      })
      if (controller.signal.aborted) {
        setBlocks((bs) => [...bs, { type: 'text', text: '[Stopped]' }])
      }
    } catch (err) {
      setBlocks((bs) => [...bs, { type: 'text', text: `[Error: ${friendlyError(err)}]` }])
    } finally {
      abortRef.current = null
      setGenerating(false)
      attachReviewToLastReply()
      void persistCurrentChat()
    }
  }

  const stopGenerating = () => {
    abortRef.current?.abort()
    cancelAllDecisions()
  }

  // One message: a user bubble, or an assistant reply with its steps, text, and review
  const renderMessage = (msg: ChatMessage, i: number) => {
    if (msg.role === 'user') {
      return (
        <div className="rounded-md border border-[#2d2921] bg-[#2a2620] px-3 py-3 text-sm text-[#ece6da] whitespace-pre-wrap leading-7">
          {(msg.attachments?.length || msg.tools?.length) ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {msg.attachments?.map((p) => (
                <span key={'a-' + p} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#2a261f] text-xs text-[#d4d4d4]">
                  <File size={11} className="text-[#938a7c]" />
                  {p.split('/').pop()}
                </span>
              ))}
              {msg.tools?.map((t) => (
                <span key={'t-' + t} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#2a261f] text-[11px] text-[#d9d2c4]">
                  <Wrench size={11} className="text-[#938a7c]" />
                  {t}
                </span>
              ))}
            </div>
          ) : null}
          {msg.fileName && (
            <span className="mb-2 inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-[#2d2921]/60 text-xs text-[#d9d2c4]">
              <File size={11} className="text-[#938a7c]" />
              {msg.fileName}
              <span className="text-[#938a7c]">Current File</span>
            </span>
          )}
          <div>{msg.content}</div>
        </div>
      )
    }
    const pending = isGenerating && i === messages.length - 1
    const blocks: Block[] = msg.blocks?.length
      ? msg.blocks
      : msg.content
        ? [{ type: 'text', text: msg.content }]
        : []
    if (blocks.length === 0) {
      return pending ? <Loader2 size={14} className="animate-spin text-[#938a7c]" /> : null
    }
    return (
      <div className="space-y-3 text-sm text-[#ece6da]">
        {groupBlocks(blocks.filter((b) => !(b.type === 'tool' && b.name === 'set_todos'))).map((seg, j) =>
          seg.type === 'text' ? (
            seg.text.trim() ? (
              <div key={j}><MessageContent text={seg.text.trim()} streaming={pending} /></div>
            ) : null
          ) : (
            <StepsGroup key={seg.id} blocks={seg.blocks} />
          )
        )}
        <ReplyParts msg={msg} blocks={blocks} />
        {pending && <Loader2 size={12} className="animate-spin text-[#938a7c]" />}
      </div>
    )
  }

  // The messages, or the empty state with the past chats when there are none
  const renderList = (bottomPad: number) => {
    if (messages.length === 0) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-3 text-[#938a7c] p-3">
          <Sparkles size={28} className="text-[#ece6da] opacity-70" />
          <p className="text-xs max-w-[220px]">
            Ask a question, plan a change, or debug an error. Browser models run on this computer, with no install
            needed.
          </p>
          {selectedModel.startsWith('groq/') && (
            <p className="text-[11px] max-w-[240px] text-[#938a7c]">
              Groq models are run by Groq. Your messages and any @-mentioned files are sent to Groq to generate
              replies.
            </p>
          )}
          <div className="absolute left-3 right-3" style={{ bottom: bottomPad }}>
            <PastChats />
          </div>
        </div>
      )
    }
    return <MessageList items={messages} bottomPad={bottomPad} renderItem={renderMessage} />
  }

  return (
    <div className="h-full flex flex-col bg-[#1a1814]">
      <ChatHeader />
      <ChatTabs />
      {showList && <SessionsList />}

      <ChatBody
        hidden={showList}
        style={chatStyle}
        list={renderList}
        footer={
          <>
            {/* Stop bar, shown while a reply is being written */}
            {isGenerating && (
              <div className="mb-1.5 flex items-center justify-between text-xs text-[#938a7c]">
                <span className="flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" /> Working...
                </span>
                <button
                  type="button"
                  onClick={stopGenerating}
                  className="flex items-center gap-1 px-2 py-1 rounded border border-[#2d2921] bg-[#2a261f] text-[#ece6da] hover:bg-[#2d2921]"
                >
                  <Square size={11} /> Stop
                </button>
              </div>
            )}

            {/* Pending changes, just above the input, like Cursor */}
            {pendingDiffs.length > 0 && (
              <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-[#d9d2c4]">
                  <ChevronDown size={12} className="text-[#938a7c]" />
                  {pendingDiffs.length} file{pendingDiffs.length > 1 ? 's' : ''}
                  <span className="text-[#3fb950]">+{diffTotals(pendingDiffs).plus}</span>
                  <span className="text-[#f85149]">-{diffTotals(pendingDiffs).minus}</span>
                </span>
                <span className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => pendingDiffs.forEach((d) => declinePending(d.path))}
                    className="text-[#938a7c] hover:text-[#f0a93b]"
                  >
                    Undo All
                  </button>
                  <button
                    type="button"
                    onClick={() => pendingDiffs.forEach((d) => void applyPending(d.path))}
                    className="px-2 py-0.5 rounded bg-[#3a2f1f] text-[#f0a93b] hover:bg-[#4a3c27]"
                  >
                    Keep All
                  </button>
                </span>
              </div>
            )}

            <ChatInput
              value={input}
              onChange={setInput}
              onSend={handleSend}
              disabled={isGenerating}
              mode={projectId ? mode : 'ask'}
              askOnly={!projectId}
              onModeChange={setMode}
              fileName={activeFile?.name ?? null}
              useFile={useFile}
              onToggleFile={() => setUseFile((v) => !v)}
              selectedModel={selectedModel}
              onModelChange={setModel}
              filePaths={filePaths}
            />
          </>
        }
      />
    </div>
  )
}