import { callGroq } from './_lib/assistant.mjs'

const MAX_CONTEXT_CHARS = 12_000
const MAX_QUESTION_CHARS = 800

export default async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  const context = typeof body.context === 'string' ? body.context : ''
  const question =
    typeof body.question === 'string'
      ? body.question.slice(0, MAX_QUESTION_CHARS)
      : ''
  const language =
    typeof body.language === 'string' ? body.language.slice(0, 40) : 'English'

  if (!context || context.length > MAX_CONTEXT_CHARS) {
    return new Response(JSON.stringify({ error: 'invalid_context' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  const result = await callGroq({
    apiKey: process.env.GROQ_API_KEY,
    context,
    question,
    language,
  })

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  })
}
