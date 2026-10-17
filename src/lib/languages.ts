// Editor language for a file, based on its name or extension. Anything unknown is plain text.
// These ids are built into Monaco (the editor), so they need no extra downloads.
const BY_NAME: Record<string, string> = {
  dockerfile: 'dockerfile',
}

const BY_EXTENSION: Record<string, string> = {
  // Web
  ts: 'typescript', tsx: 'typescript', mts: 'typescript', cts: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  html: 'html', htm: 'html', xhtml: 'html', vue: 'html', svelte: 'html',
  css: 'css', scss: 'scss', less: 'less',
  json: 'json', jsonc: 'json',
  graphql: 'graphql', gql: 'graphql',
  // Docs and data
  md: 'markdown', markdown: 'markdown', mdx: 'markdown',
  yml: 'yaml', yaml: 'yaml',
  xml: 'xml', svg: 'xml', xsd: 'xml', xsl: 'xml',
  sql: 'sql', pgsql: 'pgsql', mysql: 'mysql',
  ini: 'ini', proto: 'protobuf',
  // General languages
  py: 'python', pyw: 'python',
  rs: 'rust', go: 'go', java: 'java', kt: 'kotlin', kts: 'kotlin',
  swift: 'swift', scala: 'scala', sc: 'scala',
  c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', hh: 'cpp', hxx: 'cpp',
  cs: 'csharp', fs: 'fsharp', fsx: 'fsharp', vb: 'vb', pas: 'pascal',
  php: 'php', rb: 'ruby', rake: 'ruby', gemspec: 'ruby', pl: 'perl', pm: 'perl',
  lua: 'lua', r: 'r', dart: 'dart', ex: 'elixir', exs: 'elixir', jl: 'julia',
  clj: 'clojure', cljs: 'clojure', cljc: 'clojure', coffee: 'coffeescript',
  sol: 'solidity', tf: 'hcl', hcl: 'hcl', pug: 'pug', hbs: 'handlebars', handlebars: 'handlebars',
  // Shell and scripts
  sh: 'shell', bash: 'shell', zsh: 'shell',
  bat: 'bat', cmd: 'bat', ps1: 'powershell', psm1: 'powershell',
}

export function languageFor(name: string): string {
  const lower = name.toLowerCase()
  if (BY_NAME[lower]) return BY_NAME[lower]
  const dot = lower.lastIndexOf('.')
  if (dot < 0) return 'plaintext'
  return BY_EXTENSION[lower.slice(dot + 1)] ?? 'plaintext'
}

const LABELS: Record<string, string> = {
  plaintext: 'Plain Text', typescript: 'TypeScript', javascript: 'JavaScript', json: 'JSON', html: 'HTML',
  css: 'CSS', scss: 'SCSS', less: 'Less', markdown: 'Markdown', yaml: 'YAML', xml: 'XML', sql: 'SQL',
  pgsql: 'PostgreSQL', mysql: 'MySQL', ini: 'INI', protobuf: 'Protocol Buffers', graphql: 'GraphQL',
  python: 'Python', rust: 'Rust', go: 'Go', java: 'Java', kotlin: 'Kotlin', swift: 'Swift', scala: 'Scala',
  c: 'C', cpp: 'C++', csharp: 'C#', fsharp: 'F#', vb: 'Visual Basic', pascal: 'Pascal', php: 'PHP',
  ruby: 'Ruby', perl: 'Perl', lua: 'Lua', r: 'R', dart: 'Dart', elixir: 'Elixir', julia: 'Julia',
  clojure: 'Clojure', coffeescript: 'CoffeeScript', solidity: 'Solidity', hcl: 'HCL', pug: 'Pug',
  handlebars: 'Handlebars', shell: 'Shell', bat: 'Batch', powershell: 'PowerShell', dockerfile: 'Dockerfile',
}

export function languageLabel(id: string): string {
  return LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1)
}