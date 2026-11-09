import express from 'express'
import multer from 'multer'
import mindee from 'mindee'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const upload = multer({ storage: multer.memoryStorage() })

// 1. API Route
app.post('/api/ocr', upload.single('document'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  try {
    const client = new mindee.Client({ apiKey: process.env.MINDEE_API_KEY })
    const inputSource = new mindee.BufferInput({
      buffer: req.file.buffer,
      filename: req.file.originalname,
    })

    const response = await client.enqueueAndGetResult(
      mindee.product.Ocr,
      inputSource,
      { modelId: process.env.MINDEE_MODEL_ID }
    )

    let text = ''
    try {
      const s = response.inference.toString()
      if (typeof s === 'string' && s.trim()) text = s
    } catch (e) {
      console.warn('toString failed', e)
    }

    if (!text) text = JSON.stringify(response, null, 2)

    res.json({ text })
  } catch (error) {
    console.error('[Mindee] error:', error)
    res.status(500).json({ error: error.message || 'Failed to process document' })
  }
})

// 2. Serve the React Frontend
const distPath = path.join(__dirname, 'dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next()
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

// 3. Start the server
const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`)
})