const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Opens a web page in a new browser tab. The page runs inside a sandboxed frame without
// access to Spectrum's sign-in data or storage. Returns false if the browser blocked the tab.
export function openHtmlInNewTab(doc: string, title: string): boolean {
  const page =
    '<!doctype html><html><head><meta charset="utf-8"><title>' +
    escapeHtml(title) +
    '</title><style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%}</style></head>' +
    '<body><iframe sandbox="allow-scripts allow-forms allow-modals allow-popups" srcdoc="' +
    escapeHtml(doc) +
    '"></iframe></body></html>'
  const url = URL.createObjectURL(new Blob([page], { type: 'text/html' }))
  const win = window.open(url, '_blank')
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  return win !== null
}