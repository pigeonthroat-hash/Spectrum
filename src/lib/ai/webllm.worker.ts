// Runs the WebLLM engine in a background thread, so the page stays responsive
// while the model is working.
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm'

const handler = new WebWorkerMLCEngineHandler()
self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg)
}