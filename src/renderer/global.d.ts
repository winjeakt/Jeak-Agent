import type { JeakAPI } from '../preload/mainPreload'

declare global {
  interface Window {
    /** preload 通过 contextBridge 暴露的受限 API */
    jeak: JeakAPI
  }
}

export {}
