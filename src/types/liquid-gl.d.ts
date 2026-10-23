// Types for the liquid-gl package (it ships without them).
// Only the options Spectrum uses are listed.
declare module 'liquid-gl' {
  export interface LiquidGLLens {
    destroy(): void
    setTint(tint: string | null): void
    setDraggable(on: boolean): void
  }

  export interface LiquidGLOptions {
    engine?: 'auto' | 'webgpu' | 'webgl2' | 'webgl'
    snapshot?: string
    target: string
    resolution?: number
    zIndex?: number
    content?: string | boolean
    refraction?: number
    aberration?: number
    bevelDepth?: number
    bevelWidth?: number
    frost?: number
    shadow?: boolean
    specular?: boolean
    reveal?: 'none' | 'fade'
    tilt?: boolean
    tiltFactor?: number
    tiltEase?: number
    draggable?: boolean
    interaction?: 'none' | 'fluid'
    magnify?: number
    tint?: string | null
    helper?: boolean
    on?: { init?: (lens: LiquidGLLens) => void }
  }

  interface LiquidGL {
    (options: LiquidGLOptions): LiquidGLLens
    registerDynamic(elements: unknown): void
    syncWith(config?: object): unknown
  }

  const liquidGL: LiquidGL
  export default liquidGL
}