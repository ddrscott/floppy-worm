/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly BUILD_MODE: 'static' | 'server'
  readonly HAS_API: boolean
  readonly HAS_EDITOR: boolean
  // Vite default env variables
  readonly MODE: string
  readonly BASE_URL: string
  readonly PROD: boolean
  readonly DEV: boolean
  readonly SSR: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}