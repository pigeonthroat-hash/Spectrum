import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { cn } from '../lib/utils'

interface SpeechResult {
  isFinal: boolean
  0: { transcript: string }
}
interface Recognizer {
  start: () => void
  stop: () => void
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: { results: ArrayLike<SpeechResult> }) => void) | null
  onend: (() => void) | null
}
type RecognizerCtor = new () => Recognizer

function speechCtor(): RecognizerCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

// Dictation: spoken words are added to the message. Works where the browser has speech recognition.
export function MicButton({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const [listening, setListening] = useState(false)
  const recRef = useRef<Recognizer | null>(null)
  // The latest text, so that each spoken phrase is added after the one before it
  const valueRef = useRef(value)
  valueRef.current = value
  const supported = speechCtor() !== null

  useEffect(() => () => recRef.current?.stop(), [])

  const toggle = () => {
    if (listening) {
      recRef.current?.stop()
      return
    }
    const Ctor = speechCtor()
    if (!Ctor) return
    const rec = new Ctor()
    rec.lang = navigator.language || 'en-US'
    rec.continuous = true
    rec.interimResults = false
    rec.onresult = (e) => {
      const text = Array.from(e.results)
        .filter((r) => r.isFinal)
        .map((r) => r[0].transcript)
        .join(' ')
        .trim()
      if (!text) return
      const current = valueRef.current
      onChange(current && !current.endsWith(' ') ? `${current} ${text}` : `${current}${text}`)
    }
    rec.onend = () => setListening(false)
    recRef.current = rec
    rec.start()
    setListening(true)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!supported}
      title={supported ? (listening ? 'Stop dictation' : 'Dictate') : 'Voice input is not supported in this browser'}
      className={cn(
        'p-1.5 rounded-md text-[#938a7c] hover:text-white hover:bg-[#2a261f] disabled:opacity-40',
        listening && 'text-[#f85149]'
      )}
    >
      {listening ? <MicOff size={14} /> : <Mic size={14} />}
    </button>
  )
}
