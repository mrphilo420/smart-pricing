export type AssistantScenario = {
  name: string
  value: string
  basis: string
  status: string
}

export type AssistantCalculation = {
  state: string
  rangeLow: number | null
  rangeHigh: number | null
  gap: number | null
  notes: string[]
  scenarios: AssistantScenario[]
}

export type AssistantReply = {
  text: string
  usedAi: boolean
  error?: string
}

function money(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return 'not available'
  return `PHP ${value.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function buildAssistantContext(calc: AssistantCalculation): string {
  const lines = [
    'SMARTPRICING CONTEXT',
    'Currency: Philippine pesos (PHP).',
    '',
    'FIVE-SCENARIO TABLE (exactly five rows; do not add rows):',
  ]
  for (const scenario of calc.scenarios) {
    lines.push(
      `- ${scenario.name}: ${scenario.value} | basis: ${scenario.basis} | status: ${scenario.status}`,
    )
  }
  lines.push('', `RANGE STATE: ${calc.state}`)
  if (calc.rangeLow != null && calc.rangeHigh != null) {
    lines.push(
      `REFERENCE RANGE: ${money(calc.rangeLow)} to ${money(calc.rangeHigh)}`,
    )
  } else {
    lines.push('REFERENCE RANGE: not available')
  }
  if (calc.gap != null) {
    lines.push(`COST-MARKET GAP: ${money(calc.gap)} per unit`)
  } else {
    lines.push('COST-MARKET GAP: not applicable')
  }
  lines.push('', 'NOTES:')
  if (calc.notes.length > 0) {
    for (const note of calc.notes) lines.push(`- ${note}`)
  } else {
    lines.push('- No additional notes.')
  }
  lines.push(
    '',
    'Do not infer any input, cost, competitor, demand, or market fact that is not shown above.',
  )
  return lines.join('\n')
}

export async function explainWithGroq({
  calc,
  question,
  language,
}: {
  calc: AssistantCalculation
  question: string
  language: string
}): Promise<AssistantReply> {
  const isLocal =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  const isNetlify = window.location.hostname.includes('netlify')
  const configuredEndpoint = (
    window as typeof window & {
      __SMARTPRICING_EXPLAIN_ENDPOINT__?: string
    }
  ).__SMARTPRICING_EXPLAIN_ENDPOINT__
  const endpoint =
    configuredEndpoint ||
    (isLocal
      ? 'http://127.0.0.1:8787/explain'
      : isNetlify
        ? '/.netlify/functions/explain'
        : '')
  if (!endpoint) {
    throw new Error('proxy_unavailable')
  }

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 45_000)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        context: buildAssistantContext(calc),
        question: question.slice(0, 800),
        language,
      }),
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`http_${response.status}`)
    }
    const data = (await response.json()) as AssistantReply
    if (typeof data.text !== 'string') {
      throw new Error('invalid_response')
    }
    return data
  } finally {
    window.clearTimeout(timer)
  }
}
