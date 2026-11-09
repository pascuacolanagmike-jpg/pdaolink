import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const express = require('express')
const multer  = require('multer')
const mindee  = require('mindee')

const MINDEE_API_KEY  = 'md_cJ2VaI9yx7HiWNl3TKlqa7_jv18lFBd3E3WryC3yfgI'
const MINDEE_MODEL_ID = '9686dd59-0458-4b2f-a84c-b2b45bede65e'

function mindeeApiPlugin() {
  return {
    name: 'mindee-api',
    configureServer(server: any) {
      const app = express()
      const upload = multer({ storage: multer.memoryStorage() })

      app.post('/api/ocr', upload.single('document'), async (req: any, res: any) => {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

        try {
          const mindeeClient = new mindee.Client({ apiKey: MINDEE_API_KEY })
          const modelParams  = { modelId: MINDEE_MODEL_ID }

          const inputSource = new mindee.BufferInput({
            buffer:   req.file.buffer,
            filename: req.file.originalname,
          })

          const response = await mindeeClient.enqueueAndGetResult(
            mindee.product.Ocr,
            inputSource,
            modelParams,
          )

          // ─── DEBUG: log what actually came back ───
          console.log('[Mindee] top-level keys:', Object.keys(response))
          if (response?.inference) {
            console.log('[Mindee] inference keys:', Object.keys(response.inference))
            if (response.inference.result) {
              console.log('[Mindee] inference.result keys:', Object.keys(response.inference.result))
            }
          }
          if (response?.document?.inference) {
            console.log('[Mindee] document.inference keys:', Object.keys(response.document.inference))
          }

          // ─── TEXT EXTRACTION (defensive, tries multiple paths) ───
          let text = ''

          // Path 1: toString() — the guide's primary call
          try {
            const s = response.inference.toString()
            if (typeof s === 'string' && s.trim()) {
              text = s
              console.log('[Mindee] extracted via inference.toString()')
            }
          } catch (e) {
            console.warn('[Mindee] toString failed:', e)
          }

          // Path 2: navigate pages — try every known shape
          if (!text) {
            const candidatePages: any[] | null =
              response?.inference?.result?.pages
              ?? response?.document?.inference?.pages
              ?? response?.inference?.pages
              ?? null

            if (Array.isArray(candidatePages)) {
              candidatePages.forEach((page: any) => {
                const words = page?.allWords ?? page?.words ?? page?.lines ?? []
                if (Array.isArray(words)) {
                  words.forEach((w: any) => {
                    if (typeof w === 'string') text += w + '\n'
                    else if (w?.text) text += w.text + '\n'
                  })
                }
              })
              console.log('[Mindee] extracted via pages[] (', candidatePages.length, 'pages )')
            }
          }

          // Path 3: full response dump fallback
          if (!text) {
            console.error('[Mindee] could not find text. Full response:', JSON.stringify(response, null, 2))
            text = JSON.stringify(response, null, 2)
          }

          res.json({ text })
        } catch (error: any) {
          console.error('[Mindee] error:', error)
          res.status(500).json({ error: error.message ?? String(error) })
        }
      })

      server.middlewares.use(app)
    },
  }
}

export default defineConfig({
  plugins: [react(), mindeeApiPlugin()],
})