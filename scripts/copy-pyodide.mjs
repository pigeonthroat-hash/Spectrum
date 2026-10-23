// Copies the Pyodide runtime from node_modules into public/pyodide, so the app serves it itself
// instead of downloading it from a CDN (which some networks block).
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = join('node_modules', 'pyodide')
const dest = join('public', 'pyodide')
const FILES = ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']

if (!existsSync(join(src, 'pyodide.mjs'))) {
  console.error('The pyodide package is missing. Run "npm install" first.')
  process.exit(1)
}

mkdirSync(dest, { recursive: true })
for (const f of FILES) {
  const from = join(src, f)
  if (existsSync(from)) copyFileSync(from, join(dest, f))
  else console.warn(`Not found in the pyodide package: ${f}`)
}
const version = JSON.parse(readFileSync(join(src, 'package.json'), 'utf8')).version
console.log(`Copied Pyodide ${version} to public/pyodide`)
