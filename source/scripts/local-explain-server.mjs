import http from 'node:http'
import { callGroq } from '../../netlify/functions/_lib/assistant.mjs'

const PORT = Number(process.env.EXPLAIN_PORT || 8787)
const MAX_CONTEXT_CHARS = 12_000
const MAX_QUESTION_CHARS = 800

function send(response, status, payload) {
  response.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    'cache-control': 'no-store',
  })
  response.end(JSON.stringify(payload))
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'POST, OPTIONS',
    })
    response.end()
    return
  }

  if (request.method !== 'POST' || request.url !== '/explain') {
    send(response, 404, { error: 'not_found' })
    return
  }

  let raw = ''
  for await (const chunk of request) {
    raw += chunk
    if (raw.length > MAX_CONTEXT_CHARS + 2_000) {
      send(response, 413, { error: 'payload_too_large' })
      return
    }
  }

  let body
  try {
    body = JSON.parse(raw)
  } catch {
    send(response, 400, { error: 'invalid_json' })
    return
  }

  const context = typeof body.context === 'string' ? body.context : ''
  const question =
    typeof body.question === 'string'
      ? body.question.slice(0, MAX_QUESTION_CHARS)
      : ''
  const language =
    typeof body.language === 'string' ? body.language.slice(0, 40) : 'English'

  if (!context || context.length > MAX_CONTEXT_CHARS) {
    send(response, 400, { error: 'invalid_context' })
    return
  }

  const result = await callGroq({
    apiKey: process.env.GROQ_API_KEY,
    context,
    question,
    language,
  })
  send(response, 200, result)
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`SmartPricing explanation proxy listening on http://127.0.0.1:${PORT}`)
})
