export type Product = {
  id: string
  name: string
  subsector: string
  materials: number
  labor: number
  variableOverhead: number
  packaging: number
  freightIn: number
  fixedCost: number
  expectedUnits: number
  currentPrice: number
  targetMargin: number
  markup: number
  competitorLow: number | null
  competitorHigh: number | null
  srpReference: number | null
  srpBinding: boolean
}

export const products: Product[] = [
  {
    id: 'SYN-012',
    name: 'Bottled calamansi juice 500 mL',
    subsector: 'Food processing',
    materials: 26.87,
    labor: 6.35,
    variableOverhead: 3.42,
    packaging: 7.45,
    freightIn: 1.26,
    fixedCost: 11815.09,
    expectedUnits: 523.86,
    currentPrice: 80.25,
    targetMargin: 0.142,
    markup: 0.189,
    competitorLow: 68.67,
    competitorHigh: 94.14,
    srpReference: 79.27,
    srpBinding: false,
  },
  {
    id: 'SYN-081',
    name: 'Fish sauce 350 mL',
    subsector: 'Food processing',
    materials: 41.04,
    labor: 18.79,
    variableOverhead: 8.83,
    packaging: 1.88,
    freightIn: 1.8,
    fixedCost: 19485.16,
    expectedUnits: 570.84,
    currentPrice: 116.07,
    targetMargin: 0.3479,
    markup: 0.1957,
    competitorLow: 106.76,
    competitorHigh: 138.64,
    srpReference: 117.42,
    srpBinding: true,
  },
  {
    id: 'SYN-001',
    name: 'Face mask pack',
    subsector: 'Garments',
    materials: 274.24,
    labor: 141.16,
    variableOverhead: 30.12,
    packaging: 6.69,
    freightIn: 5.55,
    fixedCost: 19857.23,
    expectedUnits: 303.96,
    currentPrice: 627.85,
    targetMargin: 0.3992,
    markup: 0.2939,
    competitorLow: 523.09,
    competitorHigh: 725.19,
    srpReference: null,
    srpBinding: false,
  },
  {
    id: 'SYN-042',
    name: 'Embroidered pouch',
    subsector: 'Handicrafts',
    materials: 90.78,
    labor: 36.95,
    variableOverhead: 18.19,
    packaging: 8.6,
    freightIn: 1.66,
    fixedCost: 21730.05,
    expectedUnits: 272.34,
    currentPrice: 207.37,
    targetMargin: 0.3438,
    markup: 0.2326,
    competitorLow: 172.08,
    competitorHigh: 234.4,
    srpReference: null,
    srpBinding: false,
  },
  {
    id: 'SYN-011',
    name: 'Apron',
    subsector: 'Garments',
    materials: 223.73,
    labor: 62.89,
    variableOverhead: 36.12,
    packaging: 7.47,
    freightIn: 4.32,
    fixedCost: 14111.44,
    expectedUnits: 498.89,
    currentPrice: 373.65,
    targetMargin: 0.3432,
    markup: 0.1733,
    competitorLow: null,
    competitorHigh: null,
    srpReference: null,
    srpBinding: false,
  },
]
