import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Database,
  Info,
  ShieldCheck,
} from 'lucide-react'
import { products, type Product } from './data'
import { portfolio, type PortfolioPoint, type PortfolioState } from './portfolio'

type RangeState = 'feasible' | 'empty' | 'srp_unmatched' | 'cost_only'
type Language = 'en' | 'fil'

type Scenario = {
  name: string
  value: string
  basis: string
  status: string
}

type Calculation = {
  variableUnitCost: number
  fixedCostPerUnit: number
  fullCostFloor: number
  targetMarginPrice: number
  markupPrice: number
  upperReference: number | null
  state: RangeState
  rangeLow: number | null
  rangeHigh: number | null
  gap: number | null
  scenarios: Scenario[]
}

const stateMeta: Record<
  RangeState,
  { label: string; color: string; soft: string; short: string }
> = {
  feasible: {
    label: 'Feasible',
    color: '#2f5d50',
    soft: '#e7efe9',
    short: 'Floor sits below the market reference',
  },
  empty: {
    label: 'Empty',
    color: '#9a3412',
    soft: '#f7e8e0',
    short: 'Floor sits above the market reference',
  },
  srp_unmatched: {
    label: 'SRP unmatched',
    color: '#a16207',
    soft: '#f7efd8',
    short: 'No SRP match, so the band stands alone',
  },
  cost_only: {
    label: 'Cost only',
    color: '#475569',
    soft: '#e9edf0',
    short: 'No market reference was provided',
  },
}

function peso(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'Not provided'
  return `₱${value.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function pct(value: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value)
}

function calculate(
  product: Product,
  targetMargin: number,
  markup: number,
): Calculation {
  const variableUnitCost =
    product.materials +
    product.labor +
    product.variableOverhead +
    product.packaging +
    product.freightIn
  const fixedCostPerUnit = product.fixedCost / product.expectedUnits
  const fullCostFloor = variableUnitCost + fixedCostPerUnit
  const targetMarginPrice = fullCostFloor / (1 - targetMargin)
  const markupPrice = fullCostFloor * (1 + markup)

  const upperCandidates: number[] = []
  if (product.competitorHigh != null) upperCandidates.push(product.competitorHigh)
  if (product.srpBinding && product.srpReference != null) {
    upperCandidates.push(product.srpReference)
  }
  const upperReference =
    upperCandidates.length > 0 ? Math.min(...upperCandidates) : null

  let state: RangeState
  if (upperReference == null) {
    state = 'cost_only'
  } else if (fullCostFloor > upperReference + 1e-9) {
    state = 'empty'
  } else if (product.srpReference == null) {
    state = 'srp_unmatched'
  } else {
    state = 'feasible'
  }

  const rangeLow =
    state === 'feasible' || state === 'srp_unmatched' ? fullCostFloor : null
  const rangeHigh =
    state === 'feasible' || state === 'srp_unmatched' ? upperReference : null
  const gap = state === 'empty' ? fullCostFloor - upperReference! : null

  const competitorValue =
    product.competitorLow != null && product.competitorHigh != null
      ? `${peso(product.competitorLow)} to ${peso(product.competitorHigh)}`
      : 'Not provided'

  const srpStatus = product.srpBinding
    ? 'Binding ceiling'
    : product.srpReference != null
      ? 'Suggested reference'
      : 'Not matched'

  const scenarios: Scenario[] = [
    {
      name: 'Current price',
      value: peso(product.currentPrice),
      basis: 'Owner-reported current selling price',
      status: 'Observed',
    },
    {
      name: 'Full-cost floor',
      value: peso(fullCostFloor),
      basis: 'Variable cost + fixed cost / expected units',
      status: 'Floor',
    },
    {
      name: 'Target-margin price',
      value: peso(targetMarginPrice),
      basis: `Full cost / (1 - ${pct(targetMargin)})`,
      status: 'Target',
    },
    {
      name: 'Competitor band',
      value: competitorValue,
      basis: 'Firm-specific synthetic competitor prices',
      status: product.competitorLow != null ? 'Reference' : 'Not provided',
    },
    {
      name: 'SRP reference',
      value: product.srpReference != null ? peso(product.srpReference) : 'Not matched',
      basis: 'Synthetic SRP value, not a DTI bulletin',
      status: srpStatus,
    },
  ]

  return {
    variableUnitCost,
    fixedCostPerUnit,
    fullCostFloor,
    targetMarginPrice,
    markupPrice,
    upperReference,
    state,
    rangeLow,
    rangeHigh,
    gap,
    scenarios,
  }
}

function rangeNote(calc: Calculation): string {
  if (calc.state === 'feasible') {
    return `The floor is ${peso(calc.fullCostFloor)} and the upper reference is ${peso(
      calc.upperReference,
    )}. The reference range is ${peso(calc.rangeLow)} to ${peso(calc.rangeHigh)}.`
  }
  if (calc.state === 'empty') {
    return `The floor is ${peso(calc.fullCostFloor)}. The market reference tops out at ${peso(
      calc.upperReference,
    )}. The gap is ${peso(calc.gap)} per unit, so no price meets both.`
  }
  if (calc.state === 'srp_unmatched') {
    return `No SRP match was found. The range uses the competitor band only, from ${peso(
      calc.fullCostFloor,
    )} to ${peso(calc.upperReference)}.`
  }
  return `No competitor band or binding SRP was provided. The aid shows the cost floor and target-margin price only.`
}

function buildExplanation(
  product: Product,
  calc: Calculation,
  language: Language,
): string {
  if (language === 'fil') {
    const base = [
      `Ang full-cost floor ay ${peso(calc.fullCostFloor)} bawat unit sa ${product.expectedUnits.toLocaleString(
        'en-PH',
        { maximumFractionDigits: 0 },
      )} expected units.`,
      `Ang target-margin price ay ${peso(calc.targetMarginPrice)} sa ${pct(
        product.targetMargin,
      )} margin.`,
    ]
    if (calc.state === 'feasible') {
      base.push(
        `Ang competitor band ay ${peso(product.competitorLow)} hanggang ${peso(
          product.competitorHigh,
        )}.`,
      )
      if (product.srpReference != null) {
        base.push(
          `Ang synthetic SRP reference ay ${peso(product.srpReference)}${
            product.srpBinding ? ', at itinuring itong binding ceiling' : ''
          }.`,
        )
      }
      base.push(
        `Feasible ang range dahil mas mababa ang floor kaysa sa upper reference. Hindi niraranggo ng talahanayan ang mga presyo. Ikaw ang gumagawa ng huling desisyon.`,
      )
    } else if (calc.state === 'empty') {
      base.push(
        `Ang market reference ay hanggang ${peso(
          calc.upperReference,
        )}. Mas mataas ang floor ng ${peso(
          calc.gap,
        )} bawat unit, kaya walang presyong umaabot sa dalawa. Hindi binabalewala ng aid ang ceiling.`,
      )
    } else if (calc.state === 'srp_unmatched') {
      base.push(
        `Walang SRP match. Ang competitor band lamang ang ginamit, mula ${peso(
          calc.fullCostFloor,
        )} hanggang ${peso(calc.upperReference)}.`,
      )
    } else {
      base.push(
        `Walang competitor band o binding SRP. Ang cost floor at target-margin price lamang ang makikita.`,
      )
    }
    return base.join(' ')
  }

  const parts = [
    `The full-cost floor is ${peso(calc.fullCostFloor)} per unit at ${product.expectedUnits.toLocaleString(
      'en-PH',
      { maximumFractionDigits: 0 },
    )} expected units.`,
    `The target-margin price is ${peso(calc.targetMarginPrice)} at a ${pct(
      product.targetMargin,
    )} margin.`,
  ]

  if (calc.state === 'feasible') {
    parts.push(
      `The competitor band runs from ${peso(product.competitorLow)} to ${peso(
        product.competitorHigh,
      )}.`,
    )
    if (product.srpReference != null) {
      parts.push(
        `The synthetic SRP reference is ${peso(product.srpReference)}${
          product.srpBinding ? ', and it is treated as a binding ceiling' : ''
        }.`,
      )
    }
    parts.push(
      `The range is feasible because the floor sits below the upper reference. The table does not rank these prices. The final decision is yours.`,
    )
  } else if (calc.state === 'empty') {
    parts.push(
      `The market reference tops out at ${peso(
        calc.upperReference,
      )}. The floor is ${peso(
        calc.gap,
      )} per unit above it, so no price meets both. The aid does not relax the ceiling.`,
    )
  } else if (calc.state === 'srp_unmatched') {
    parts.push(
      `No SRP match was found. The range uses the competitor band only, from ${peso(
        calc.fullCostFloor,
      )} to ${peso(calc.upperReference)}.`,
    )
  } else {
    parts.push(
      `No competitor band or binding SRP was provided. The aid shows the cost floor and target-margin price only. It does not infer a market range.`,
    )
  }

  return parts.join(' ')
}

function PriceRow({
  label,
  value,
  children,
}: {
  label: string
  value: string
  children: ReactNode
}) {
  return (
    <div className="grid grid-cols-[92px_1fr_84px] items-center gap-3 sm:grid-cols-[132px_1fr_104px]">
      <span className="text-xs text-[#5b615a]">{label}</span>
      <div className="relative h-6">{children}</div>
      <span className="text-right font-mono text-[11px] tabular-nums text-[#1f2a24]">
        {value}
      </span>
    </div>
  )
}

function Track() {
  return (
    <div className="absolute inset-y-0 left-0 right-0 rounded-[2px] bg-[#e8e0d2]">
      <span className="absolute inset-y-0 left-1/4 w-px bg-[#1f2a24]/5" />
      <span className="absolute inset-y-0 left-1/2 w-px bg-[#1f2a24]/5" />
      <span className="absolute inset-y-0 left-3/4 w-px bg-[#1f2a24]/5" />
    </div>
  )
}

function Tick({
  value,
  min,
  max,
  color,
  shape = 'square',
}: {
  value: number
  min: number
  max: number
  color: string
  shape?: 'square' | 'circle' | 'diamond'
}) {
  const span = max - min || 1
  const left = `${((value - min) / span) * 100}%`
  const shapeClass =
    shape === 'circle'
      ? 'h-2.5 w-2.5 rounded-full'
      : shape === 'diamond'
        ? 'h-2 w-2 rotate-45'
        : 'h-2.5 w-2.5'
  return (
    <span
      className="absolute inset-y-0 w-px"
      style={{ left, backgroundColor: color }}
    >
      <span
        className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 ${shapeClass}`}
        style={{ backgroundColor: color }}
      />
    </span>
  )
}

function PriceMap({
  product,
  calc,
  intendedPrice,
}: {
  product: Product
  calc: Calculation
  intendedPrice: number
}) {
  const values = [
    calc.fullCostFloor,
    calc.targetMarginPrice,
    product.currentPrice,
    intendedPrice,
    product.competitorLow,
    product.competitorHigh,
    product.srpReference,
  ].filter((value): value is number => value != null && Number.isFinite(value))

  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const padding = Math.max((rawMax - rawMin) * 0.12, 1)
  const min = Math.max(0, rawMin - padding)
  const max = rawMax + padding
  const span = max - min || 1
  const left = (value: number) => `${((value - min) / span) * 100}%`

  return (
    <div>
      <div className="space-y-3">
        <PriceRow
          label="Competitor band"
          value={
            product.competitorLow != null && product.competitorHigh != null
              ? `${peso(product.competitorLow)} to ${peso(product.competitorHigh)}`
              : 'Not provided'
          }
        >
          <Track />
          {product.competitorLow != null && product.competitorHigh != null && (
            <span
              className="absolute inset-y-1 border-l border-r border-[#2f5d50] bg-[#2f5d50]/15"
              style={{
                left: left(product.competitorLow),
                width: `${Math.max(
                  ((product.competitorHigh - product.competitorLow) / span) * 100,
                  0.5,
                )}%`,
              }}
            />
          )}
        </PriceRow>

        {calc.state === 'empty' && calc.gap != null && (
          <PriceRow label="Gap" value={peso(calc.gap)}>
            <Track />
            <span
              className="absolute inset-y-1 border-l border-r border-[#9a3412] bg-[#9a3412]/20"
              style={{
                left: left(calc.upperReference!),
                width: `${Math.max(
                  ((calc.fullCostFloor - calc.upperReference!) / span) * 100,
                  0.5,
                )}%`,
              }}
            />
          </PriceRow>
        )}

        <PriceRow label="Full-cost floor" value={peso(calc.fullCostFloor)}>
          <Track />
          <Tick
            value={calc.fullCostFloor}
            min={min}
            max={max}
            color="#2f5d50"
            shape="square"
          />
        </PriceRow>

        <PriceRow label="Target-margin" value={peso(calc.targetMarginPrice)}>
          <Track />
          <Tick
            value={calc.targetMarginPrice}
            min={min}
            max={max}
            color="#1f2a24"
            shape="circle"
          />
        </PriceRow>

        <PriceRow
          label={product.srpBinding ? 'SRP ceiling' : 'SRP reference'}
          value={product.srpReference != null ? peso(product.srpReference) : 'Not matched'}
        >
          <Track />
          {product.srpReference != null && (
            <Tick
              value={product.srpReference}
              min={min}
              max={max}
              color={product.srpBinding ? '#9a3412' : '#a16207'}
              shape="square"
            />
          )}
        </PriceRow>

        <PriceRow label="Current price" value={peso(product.currentPrice)}>
          <Track />
          <Tick
            value={product.currentPrice}
            min={min}
            max={max}
            color="#475569"
            shape="circle"
          />
        </PriceRow>

        <PriceRow label="Your price" value={peso(intendedPrice)}>
          <Track />
          <Tick
            value={intendedPrice}
            min={min}
            max={max}
            color="#b45309"
            shape="diamond"
          />
        </PriceRow>
      </div>

      <div className="mt-4 flex justify-between border-t border-[#1f2a24]/10 pt-3 font-mono text-[10px] text-[#7b7266]">
        <span>{peso(min)}</span>
        <span>Shared scale, PHP per unit</span>
        <span>{peso(max)}</span>
      </div>
    </div>
  )
}



type PortfolioSummary = {
  total: number
  counts: Record<PortfolioState, number>
  belowFloor: number
  withSrp: number
}

const STREAMLIT_DATA_URL =
  'http://localhost:8501/app/static/portfolio.json'

function summarizePortfolio(points: PortfolioPoint[]): PortfolioSummary {
  const counts: Record<PortfolioState, number> = {
    feasible: 0,
    empty: 0,
    srp_unmatched: 0,
    cost_only: 0,
  }
  let belowFloor = 0
  let withSrp = 0

  for (const point of points) {
    counts[point.state] += 1
    if (point.price < point.floor) belowFloor += 1
    if (point.srpReference != null) withSrp += 1
  }

  return {
    total: points.length,
    counts,
    belowFloor,
    withSrp,
  }
}

function useStreamlitPortfolio() {
  const [points, setPoints] = useState<PortfolioPoint[]>(portfolio)
  const [status, setStatus] = useState<
    'loading' | 'live' | 'snapshot' | 'fallback'
  >('loading')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    const controllers: AbortController[] = []
    const isLocal =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    const sources = isLocal
      ? [STREAMLIT_DATA_URL, './portfolio.json']
      : ['./portfolio.json', STREAMLIT_DATA_URL]

    async function load() {
      setStatus('loading')
      for (const source of sources) {
        const controller = new AbortController()
        controllers.push(controller)
        const timer = window.setTimeout(() => controller.abort(), 3500)
        try {
          const response = await fetch(source, {
            cache: 'no-store',
            signal: controller.signal,
          })
          if (!response.ok) continue
          const data = await response.json()
          if (!active) return
          if (!Array.isArray(data.records) || data.records.length === 0) {
            continue
          }
          setPoints(data.records as PortfolioPoint[])
          setStatus(source === STREAMLIT_DATA_URL ? 'live' : 'snapshot')
          return
        } catch {
          // Try the next source.
        } finally {
          window.clearTimeout(timer)
        }
      }
      if (!active) return
      setPoints(portfolio)
      setStatus('fallback')
    }

    load()

    return () => {
      active = false
      for (const controller of controllers) controller.abort()
    }
  }, [reloadKey])

  return {
    points,
    summary: summarizePortfolio(points),
    status,
    reload: () => setReloadKey((current) => current + 1),
  }
}

function StateMixChart({ summary }: { summary: PortfolioSummary }) {
  const total = summary.total
  const order: PortfolioState[] = [
    'feasible',
    'srp_unmatched',
    'empty',
    'cost_only',
  ]

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium">Range state mix</h3>
        <span className="font-mono text-[10px] text-[#7b7266]">
          {total} records
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {order.map((state) => {
          const count = summary.counts[state]
          const share = (count / total) * 100
          return (
            <div key={state}>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-[#5b615a]">{stateMeta[state].label}</span>
                <span className="font-mono tabular-nums">
                  {count}{' '}
                  <span className="text-[#9a9286]">({share.toFixed(0)}%)</span>
                </span>
              </div>
              <div className="mt-1 h-2 bg-[#e8e0d2]">
                <div
                  className="h-full"
                  style={{
                    width: `${share}%`,
                    backgroundColor: stateMeta[state].color,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-xs leading-5 text-[#7b7266]">
        Most SRP-unmatched records are garments, handicrafts, and furniture,
        which DTI SRP bulletins do not cover.
      </p>
    </div>
  )
}

function RatioHistogram({
  points,
  summary,
}: {
  points: PortfolioPoint[]
  summary: PortfolioSummary
}) {
  const bins = useMemo(() => {
    const specs = [
      { label: 'Below 1.0', min: 0, max: 1.0, tone: '#9a3412' },
      { label: '1.0 to 1.2', min: 1.0, max: 1.2, tone: '#2f5d50' },
      { label: 'Above 1.2', min: 1.2, max: Number.POSITIVE_INFINITY, tone: '#7a9a8d' },
    ]
    return specs.map((spec) => ({
      ...spec,
      count: points.filter((point) => {
        const ratio = point.price / point.floor
        return ratio >= spec.min && ratio < spec.max
      }).length,
    }))
  }, [points])

  const max = Math.max(1, ...bins.map((bin) => bin.count))

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium">Price to floor</h3>
        <span className="font-mono text-[10px] text-[#7b7266]">
          {summary.belowFloor} below 1.0
        </span>
      </div>
      <div className="mt-4 flex h-36 items-end gap-2 border-b border-[#1f2a24]/10 pb-1">
        {bins.map((bin) => (
          <div
            key={bin.label}
            className="flex flex-1 flex-col items-center justify-end gap-1"
          >
            <span className="font-mono text-[9px] tabular-nums text-[#7b7266]">
              {bin.count}
            </span>
            <div
              className="w-full"
              style={{
                height: `${Math.max((bin.count / max) * 96, 3)}px`,
                backgroundColor: bin.tone,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {bins.map((bin) => (
          <span
            key={bin.label}
            className="flex-1 text-center text-[9px] leading-3 text-[#7b7266]"
          >
            {bin.label}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-[#7b7266]">
        Current price divided by the full-cost floor. Values below 1.0 do not
        cover full cost at the expected volume.
      </p>
    </div>
  )
}

function CostComposition({
  product,
  calc,
}: {
  product: Product
  calc: Calculation
}) {
  const parts = [
    { label: 'Materials', value: product.materials, color: '#2f5d50' },
    { label: 'Labor', value: product.labor, color: '#4f7a6c' },
    {
      label: 'Variable overhead',
      value: product.variableOverhead,
      color: '#7a9a8d',
    },
    { label: 'Packaging', value: product.packaging, color: '#a16207' },
    { label: 'Freight', value: product.freightIn, color: '#c08a3e' },
    { label: 'Fixed cost', value: calc.fixedCostPerUnit, color: '#1f2a24' },
  ]
  const total = parts.reduce((sum, part) => sum + part.value, 0)

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium">Cost composition</h3>
        <span className="font-mono text-[10px] text-[#7b7266]">
          {peso(total)}
        </span>
      </div>
      <div className="mt-4 flex h-3 w-full overflow-hidden">
        {parts.map((part) => (
          <div
            key={part.label}
            style={{
              width: `${(part.value / total) * 100}%`,
              backgroundColor: part.color,
            }}
            title={`${part.label}: ${peso(part.value)}`}
          />
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {parts.map((part) => (
          <div
            key={part.label}
            className="flex items-center justify-between gap-2"
          >
            <dt className="flex items-center gap-1.5 text-[#5b615a]">
              <span
                className="h-2 w-2 shrink-0"
                style={{ backgroundColor: part.color }}
              />
              {part.label}
            </dt>
            <dd className="font-mono tabular-nums">{peso(part.value)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs leading-5 text-[#7b7266]">
        Full-cost floor at{' '}
        {product.expectedUnits.toLocaleString('en-PH', {
          maximumFractionDigits: 0,
        })}{' '}
        expected units.
      </p>
    </div>
  )
}

function App() {
  const [selectedId, setSelectedId] = useState(products[0].id)
  const product = products.find((item) => item.id === selectedId) ?? products[0]
  const [targetMargin, setTargetMargin] = useState(product.targetMargin)
  const [markup, setMarkup] = useState(product.markup)
  const [intendedPrice, setIntendedPrice] = useState(product.currentPrice)
  const [showExplanation, setShowExplanation] = useState(false)
  const [language, setLanguage] = useState<Language>('en')
  const [recorded, setRecorded] = useState<
    { id: string; name: string; price: number; state: string }[]
  >([])

  const calc = useMemo(
    () => calculate(product, targetMargin, markup),
    [product, targetMargin, markup],
  )
  const { points, summary, status, reload } = useStreamlitPortfolio()
  const meta = stateMeta[calc.state]
  const note = rangeNote(calc)
  const explanation = buildExplanation(product, calc, language)

  function selectProduct(id: string) {
    const next = products.find((item) => item.id === id) ?? products[0]
    setSelectedId(next.id)
    setTargetMargin(next.targetMargin)
    setMarkup(next.markup)
    setIntendedPrice(next.currentPrice)
    setShowExplanation(false)
  }

  function recordDecision() {
    setRecorded((current) => [
      ...current,
      {
        id: product.id,
        name: product.name,
        price: intendedPrice,
        state: meta.label,
      },
    ])
  }

  return (
    <div className="min-h-screen bg-[#f4efe4] text-[#1f2a24]">
      <div className="mx-auto flex min-h-screen max-w-[1480px] flex-col lg:flex-row">
        <aside className="w-full shrink-0 border-b border-[#1f2a24]/10 bg-[#efe9df] lg:w-[264px] lg:border-b-0 lg:border-r">
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-[22px] leading-none">SmartPricing</p>
                <p className="mt-2 text-xs text-[#7b7266]">Pricing decision aid</p>
              </div>
              <span className="rotate-[-2deg] border border-[#b45309] px-2 py-1 font-mono text-[9px] leading-none text-[#b45309]">
                SYNTHETIC
              </span>
            </div>

            <div className="mt-7">
              <label
                htmlFor="product"
                className="text-xs font-medium text-[#5b615a]"
              >
                Product record
              </label>
              <div className="relative mt-2">
                <select
                  id="product"
                  value={selectedId}
                  onChange={(event) => selectProduct(event.target.value)}
                  className="h-10 w-full appearance-none rounded-md border border-[#1f2a24]/15 bg-[#fdfbf7] px-3 pr-9 text-sm text-[#1f2a24] outline-none focus-visible:ring-2 focus-visible:ring-[#2f5d50]"
                >
                  {products.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.id} · {item.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7b7266]"
                  strokeWidth={1.5}
                />
              </div>
              <p className="mt-2 text-xs text-[#7b7266]">
                {product.subsector} · {meta.label}
              </p>
            </div>

            <div className="mt-7 space-y-5">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor="target-margin"
                    className="text-xs font-medium text-[#5b615a]"
                  >
                    Target margin
                  </label>
                  <span className="font-mono text-xs tabular-nums">
                    {pct(targetMargin)}
                  </span>
                </div>
                <input
                  id="target-margin"
                  type="range"
                  min={0}
                  max={60}
                  step={1}
                  value={Math.round(targetMargin * 100)}
                  onChange={(event) =>
                    setTargetMargin(Number(event.target.value) / 100)
                  }
                  className="range mt-3 w-full"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor="markup"
                    className="text-xs font-medium text-[#5b615a]"
                  >
                    Markup on cost
                  </label>
                  <span className="font-mono text-xs tabular-nums">
                    {pct(markup)}
                  </span>
                </div>
                <input
                  id="markup"
                  type="range"
                  min={0}
                  max={60}
                  step={1}
                  value={Math.round(markup * 100)}
                  onChange={(event) =>
                    setMarkup(Number(event.target.value) / 100)
                  }
                  className="range mt-3 w-full"
                />
              </div>
            </div>

            <div className="mt-8 border-t border-[#1f2a24]/10 pt-5">
              <p className="text-xs text-[#7b7266]">Presentation data</p>
              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#5b615a]">Records</dt>
                  <dd className="font-mono tabular-nums">200</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#5b615a]">Seed</dt>
                  <dd className="font-mono tabular-nums">20261105</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#5b615a]">Generator</dt>
                  <dd className="font-mono">Monte Carlo</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#5b615a]">Source</dt>
                  <dd className="font-mono">
                    {status === 'live'
                      ? 'Streamlit'
                      : status === 'snapshot'
                        ? 'Snapshot'
                        : status === 'loading'
                          ? 'Connecting'
                          : 'Embedded'}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs leading-5 text-[#7b7266]">
                Synthetic records only. Not real MSE data and not the study's final evidence.
              </p>
            </div>

            <div className="mt-8 border-t border-[#1f2a24]/10 pt-5">
              <p className="text-xs text-[#7b7266]">Range states</p>
              <ul className="mt-3 space-y-2">
                {(
                  Object.entries(stateMeta) as [
                    RangeState,
                    (typeof stateMeta)[RangeState],
                  ][]
                ).map(([key, item]) => (
                  <li
                    key={key}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-[#5b615a]">{item.label}</span>
                    </span>
                    <span className="font-mono text-[10px] text-[#7b7266]">
                      {key === calc.state ? 'selected' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="flex h-16 items-center justify-between gap-4 border-b border-[#1f2a24]/10 px-5 lg:px-8">
            <nav className="hidden items-center gap-6 text-sm text-[#5b615a] md:flex">
              <a className="hover:text-[#1f2a24]" href="#dashboard">
                Dashboard
              </a>
              <a className="hover:text-[#1f2a24]" href="#scenarios">
                Scenarios
              </a>
              <a className="hover:text-[#1f2a24]" href="#data">
                Data boundary
              </a>
              <a className="hover:text-[#1f2a24]" href="#guardrails">
                Guardrails
              </a>
            </nav>
            <div className="text-right text-xs text-[#7b7266]">
              <p>Synthetic presentation</p>
              <p className="font-mono">seed 20261105</p>
            </div>
          </header>

          <div className="px-5 py-7 lg:px-8 lg:py-9">
            <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-start">
              <div className="max-w-[760px]">
                <p className="text-xs text-[#7b7266]">
                  Synthetic presentation · Bulacan manufacturing MSEs
                </p>
                <h1 className="mt-3 max-w-[720px] font-display text-[36px] leading-[1.04] tracking-[-0.02em] sm:text-[46px]">
                  A five-scenario price check for manufacturing MSEs in Bulacan
                </h1>
                <p className="mt-4 max-w-[620px] text-[15px] leading-6 text-[#5b615a]">
                  Compare the full-cost floor, target-margin price, competitor band,
                  and SRP reference. The owner sets the final price.
                </p>
              </div>

              <div className="w-full border-l border-[#1f2a24]/10 pl-5 xl:w-[236px]">
                <p className="text-xs text-[#7b7266]">Selected record</p>
                <p className="mt-2 font-mono text-sm">{product.id}</p>
                <p className="mt-1 text-sm leading-5">{product.name}</p>
                <p className="mt-1 text-xs text-[#7b7266]">{product.subsector}</p>
                <div className="mt-4 flex items-center gap-2 text-xs">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: meta.color }}
                  />
                  <span className="text-[#5b615a]">{meta.short}</span>
                </div>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[#1f2a24]/10 bg-[#1f2a24]/10 lg:grid-cols-4">
              {[
                {
                  label: 'Variable unit cost',
                  value: peso(calc.variableUnitCost),
                  note: 'Materials, labor, overhead, packaging, freight',
                },
                {
                  label: 'Full-cost floor',
                  value: peso(calc.fullCostFloor),
                  note: `At ${product.expectedUnits.toLocaleString('en-PH', {
                    maximumFractionDigits: 0,
                  })} expected units`,
                },
                {
                  label: 'Target-margin price',
                  value: peso(calc.targetMarginPrice),
                  note: `${pct(targetMargin)} margin on full cost`,
                },
                {
                  label: 'Reference range',
                  value:
                    calc.rangeLow != null && calc.rangeHigh != null
                      ? `${peso(calc.rangeLow)} to ${peso(calc.rangeHigh)}`
                      : 'No range',
                  note: meta.label,
                },
              ].map((item) => (
                <div key={item.label} className="bg-[#fdfbf7] p-4 sm:p-5">
                  <p className="text-xs text-[#7b7266]">{item.label}</p>
                  <p className="mt-2 font-mono text-[20px] leading-none tabular-nums sm:text-[24px]">
                    {item.value}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-[#7b7266]">{item.note}</p>
                </div>
              ))}
            </div>

            <section
              id="dashboard"
              className="mt-6 overflow-hidden rounded-xl border border-[#1f2a24]/10 bg-[#fdfbf7]"
            >
              <div className="flex flex-col justify-between gap-3 border-b border-[#1f2a24]/10 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                <div>
                  <h2 className="text-lg font-medium">Portfolio dashboard</h2>
                  <p className="mt-1 text-sm text-[#5b615a]">
                    200 synthetic records. Five are selected for the price check.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-[#7b7266]">
                  <span>
                    <span className="font-mono text-[#1f2a24]">
                      {summary.belowFloor}
                    </span>{' '}
                    below floor
                  </span>
                  <span>
                    <span className="font-mono text-[#1f2a24]">
                      {summary.withSrp}
                    </span>{' '}
                    with SRP
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor:
                          status === 'live' || status === 'snapshot'
                            ? '#2f5d50'
                            : status === 'loading'
                              ? '#a16207'
                              : '#9a3412',
                      }}
                    />
                    {status === 'live'
                      ? 'Live from Streamlit'
                      : status === 'snapshot'
                        ? 'Packaged data snapshot'
                        : status === 'loading'
                          ? 'Connecting'
                          : 'Embedded fallback'}
                  </span>
                  <button
                    type="button"
                    onClick={reload}
                    className="underline decoration-[#7b7266]/40 underline-offset-2 hover:text-[#1f2a24]"
                  >
                    Reload
                  </button>
                </div>
              </div>
              <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_1fr_1.1fr]">
                <StateMixChart summary={summary} />
                <RatioHistogram points={points} summary={summary} />
                <CostComposition product={product} calc={calc} />
              </div>
            </section>

            <div className="mt-6 grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(300px,0.7fr)]">
              <div className="space-y-6">
              <section className="rounded-xl border border-[#1f2a24]/10 bg-[#fdfbf7] p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-medium">Price map</h2>
                    <p className="mt-1 text-sm text-[#5b615a]">
                      One scale for every reference. No row is ranked.
                    </p>
                  </div>
                  <span className="font-mono text-[10px] text-[#7b7266]">
                    PHP per unit
                  </span>
                </div>
                <div className="mt-6">
                  <PriceMap
                    product={product}
                    calc={calc}
                    intendedPrice={intendedPrice}
                  />
                </div>
              </section>

            <section
              id="scenarios"
              className="overflow-hidden rounded-xl border border-[#1f2a24]/10 bg-[#fdfbf7]"
            >
              <div className="flex flex-col justify-between gap-3 border-b border-[#1f2a24]/10 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                <div>
                  <h2 className="text-lg font-medium">Five reference scenarios</h2>
                  <p className="mt-1 text-sm text-[#5b615a]">
                    The rows are not ranked. The owner decides.
                  </p>
                </div>
                <span className="font-mono text-[10px] text-[#7b7266]">
                  {product.id}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1f2a24]/10 text-left text-xs text-[#7b7266]">
                      <th className="px-5 py-3 font-normal sm:px-6">Scenario</th>
                      <th className="px-4 py-3 font-normal">Price</th>
                      <th className="hidden px-4 py-3 font-normal sm:table-cell">Basis</th>
                      <th className="px-5 py-3 font-normal sm:px-6">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calc.scenarios.map((scenario) => (
                      <tr
                        key={scenario.name}
                        className="border-b border-[#1f2a24]/10 last:border-0"
                      >
                        <td className="px-5 py-3 font-medium sm:px-6">
                          {scenario.name}
                        </td>
                        <td className="px-4 py-3 font-mono text-[13px] tabular-nums">
                          {scenario.value}
                        </td>
                        <td className="hidden px-4 py-3 text-[#5b615a] sm:table-cell">
                          {scenario.basis}
                        </td>
                        <td className="px-5 py-3 sm:px-6">
                          <span className="flex items-center gap-2 text-[#5b615a]">
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{
                                backgroundColor:
                                  scenario.status === 'Binding ceiling'
                                    ? '#9a3412'
                                    : scenario.status === 'Not matched' ||
                                        scenario.status === 'Not provided'
                                      ? '#b9b1a3'
                                      : '#2f5d50',
                              }}
                            />
                            {scenario.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

              </div>
              <div className="space-y-6">
                <section className="rounded-xl border border-[#1f2a24]/10 bg-[#fdfbf7] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-[#7b7266]">Range state</p>
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: meta.color }}
                    />
                  </div>
                  <p className="mt-2 font-display text-[28px] leading-none">
                    {meta.label}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[#5b615a]">{note}</p>
                  {calc.rangeLow != null && calc.rangeHigh != null && (
                    <div className="mt-4 border-t border-[#1f2a24]/10 pt-3">
                      <p className="text-xs text-[#7b7266]">Reference range</p>
                      <p className="mt-1 font-mono text-lg tabular-nums">
                        {peso(calc.rangeLow)} to {peso(calc.rangeHigh)}
                      </p>
                    </div>
                  )}
                  {calc.gap != null && (
                    <div className="mt-4 border-t border-[#1f2a24]/10 pt-3">
                      <p className="text-xs text-[#7b7266]">Cost-market gap</p>
                      <p className="mt-1 font-mono text-lg tabular-nums text-[#9a3412]">
                        {peso(calc.gap)} per unit
                      </p>
                    </div>
                  )}
                </section>

                <section className="rounded-xl border border-[#1f2a24]/10 bg-[#fdfbf7] p-5">
                  <p className="text-xs text-[#7b7266]">Your decision</p>
                  <div className="mt-2 flex items-baseline justify-between gap-3">
                    <span className="font-mono text-[26px] leading-none tabular-nums">
                      {peso(intendedPrice)}
                    </span>
                    <span className="text-xs text-[#7b7266]">per unit</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.ceil(
                      Math.max(
                        product.currentPrice,
                        calc.targetMarginPrice,
                        product.competitorHigh ?? 0,
                        product.srpReference ?? 0,
                      ) * 1.25,
                    )}
                    step={1}
                    value={intendedPrice}
                    onChange={(event) =>
                      setIntendedPrice(Number(event.target.value))
                    }
                    className="range mt-4 w-full"
                    aria-label="Your intended selling price"
                  />
                  <p className="mt-2 text-xs leading-5 text-[#7b7266]">
                    The aid does not choose this price. Move the marker to compare
                    your own number with the table.
                  </p>
                  <button
                    type="button"
                    onClick={recordDecision}
                    className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-[#2f5d50] px-4 text-sm font-medium text-[#fdfbf7] transition-colors hover:bg-[#264c41] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2f5d50] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fdfbf7]"
                  >
                    Record decision
                  </button>
                  {recorded.length > 0 && (
                    <div className="mt-4 border-t border-[#1f2a24]/10 pt-3">
                      <p className="text-xs text-[#7b7266]">
                        Recorded this session
                      </p>
                      <ul className="mt-2 space-y-1 text-xs">
                        {recorded.slice(-3).map((item, index) => (
                          <li
                            key={`${item.id}-${index}`}
                            className="flex items-center justify-between gap-3"
                          >
                            <span className="truncate text-[#5b615a]">
                              {item.id} · {item.state}
                            </span>
                            <span className="font-mono tabular-nums">
                              {peso(item.price)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
              <div className="space-y-6">
              <section className="rounded-xl border border-[#1f2a24]/10 bg-[#fdfbf7] p-5 sm:p-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <h2 className="text-lg font-medium">Explanation assistant</h2>
                    <p className="mt-1 text-sm text-[#5b615a]">
                      Scripted preview of the live Groq explanation layer.
                    </p>
                  </div>
                  <div className="flex overflow-hidden rounded-md border border-[#1f2a24]/15 text-xs">
                    <button
                      type="button"
                      onClick={() => setLanguage('en')}
                      className={`px-3 py-2 transition-colors ${
                        language === 'en'
                          ? 'bg-[#efe9df] text-[#1f2a24]'
                          : 'bg-transparent text-[#7b7266] hover:text-[#1f2a24]'
                      }`}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      onClick={() => setLanguage('fil')}
                      className={`border-l border-[#1f2a24]/10 px-3 py-2 transition-colors ${
                        language === 'fil'
                          ? 'bg-[#efe9df] text-[#1f2a24]'
                          : 'bg-transparent text-[#7b7266] hover:text-[#1f2a24]'
                      }`}
                    >
                      Filipino
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowExplanation((current) => !current)}
                  className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#1f2a24]/15 bg-[#efe9df] px-4 text-sm font-medium text-[#1f2a24] transition-colors hover:bg-[#e6ddcf] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2f5d50] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fdfbf7]"
                >
                  {showExplanation ? 'Hide explanation' : 'Explain this table'}
                </button>

                {showExplanation && (
                  <div className="mt-5 border-t border-[#1f2a24]/10 pt-4">
                    <p className="text-sm leading-7 text-[#3f4a43]">
                      {explanation}
                    </p>
                    <p className="mt-3 text-xs leading-5 text-[#7b7266]">
                      Scripted preview. The live app sends only the five-scenario
                      table, range state, notes, question, and language to Groq.
                    </p>
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-[#1f2a24]/10 bg-[#efe9df] p-5">
                <h2 className="text-sm font-medium">Reading the table</h2>
                <dl className="mt-4 space-y-3 text-xs leading-5 text-[#5b615a]">
                  <div>
                    <dt className="font-medium text-[#1f2a24]">Full-cost floor</dt>
                    <dd className="mt-1">
                      Variable cost plus fixed cost divided by expected units. It
                      is a price at the current volume.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-[#1f2a24]">Target-margin price</dt>
                    <dd className="mt-1">
                      The full-cost floor divided by one minus the target margin.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-[#1f2a24]">Market references</dt>
                    <dd className="mt-1">
                      The competitor band and SRP are references. Neither one
                      chooses a price.
                    </dd>
                  </div>
                </dl>
              </section>
              </div>

              <div className="space-y-6">
                <section
                  id="data"
                  className="rounded-xl border border-[#1f2a24]/10 bg-[#efe9df] p-5"
                >
                  <div className="flex items-center gap-2">
                    <Database
                      className="h-4 w-4 text-[#7b7266]"
                      strokeWidth={1.5}
                    />
                    <h2 className="text-sm font-medium">What this page uses</h2>
                  </div>
                  <dl className="mt-4 space-y-4 text-xs leading-5">
                    <div>
                      <dt className="font-medium text-[#1f2a24]">
                        Synthetic Monte Carlo data
                      </dt>
                      <dd className="mt-1 text-[#5b615a]">
                        200 product records, seed 20261105. Presentation and
                        software testing only.
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-[#1f2a24]">
                        Real DTI SRP
                      </dt>
                      <dd className="mt-1 text-[#5b615a]">
                        565 records across 2023, 2025, and 2026. Manual mode only.
                        The SRP on this page is synthetic.
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-[#1f2a24]">
                        No price model
                      </dt>
                      <dd className="mt-1 text-[#5b615a]">
                        No demand elasticity, no ML price prediction, no
                        profit-maximizing search.
                      </dd>
                    </div>
                  </dl>
                </section>

                <section
                  id="guardrails"
                  className="rounded-xl border border-[#1f2a24]/10 bg-[#fdfbf7] p-5"
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck
                      className="h-4 w-4 text-[#7b7266]"
                      strokeWidth={1.5}
                    />
                    <h2 className="text-sm font-medium">Guardrails</h2>
                  </div>
                  <ul className="mt-4 space-y-3 text-xs leading-5 text-[#5b615a]">
                    <li className="flex gap-2">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#2f5d50]"
                        strokeWidth={1.5}
                      />
                      The assistant receives only the table, range state, notes,
                      question, and language.
                    </li>
                    <li className="flex gap-2">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#2f5d50]"
                        strokeWidth={1.5}
                      />
                      It cannot calculate, rank, or recommend a price.
                    </li>
                    <li className="flex gap-2">
                      <AlertTriangle
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#a16207]"
                        strokeWidth={1.5}
                      />
                      A post-generation check blocks explicit price-setting
                      language.
                    </li>
                  </ul>
                </section>
              </div>
            </div>

            <div className="mt-6 flex flex-col justify-between gap-2 border-t border-[#1f2a24]/10 pt-4 text-xs text-[#7b7266] sm:flex-row sm:items-center">
              <p>
                SmartPricing pivot build · Build 2026-11-05 · Bulacan State University
              </p>
              <p className="flex items-center gap-2">
                <Info className="h-4 w-4" strokeWidth={1.5} />
                Synthetic data for presentation only
              </p>
            </div>
            <p className="mt-2 text-[10px] text-[#9a9286]">
              Design direction informed by{' '}
              <a
                className="underline decoration-[#9a9286]/40 underline-offset-2 hover:text-[#5b615a]"
                href="https://github.com/heydamir/unslop"
                target="_blank"
                rel="noreferrer"
              >
                unslop
              </a>{' '}
              by Damir Sokolovsky, CC BY 4.0.
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
