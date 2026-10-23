// Types for @ybouane/liquidglass, for the parts Spectrum uses
declare module '@ybouane/liquidglass' {
  export interface LiquidGlassInstance {
    fps: number
    destroy(): void
    markChanged(element?: HTMLElement): void
  }

  export interface LiquidGlassInitOptions {
    root: HTMLElement
    glassElements: NodeList | HTMLElement[]
    defaults?: Record<string, unknown>
  }

  export const LiquidGlass: {
    init(options: LiquidGlassInitOptions): Promise<LiquidGlassInstance>
  }
}