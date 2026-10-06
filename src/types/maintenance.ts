export type Role = "Analista" | "Coordenação" | "Gerência"

export type Machine = {
  id: string
  name: string
  code: string
  sector: string
  line: string
  status: string
  critical: string
  photo: string
  last: string
}

export type Order = {
  id: string
  machine: string
  type: string
  priority: string
  tech: string
  date: string
  status: string
  critical: string
  cost: string
}

export type Failure = {
  callOrder: number
  id: number
  machine: string
  line: string
  date: string
  shift: string
  minutes: number
  description: string
  critical: string
  confidence: number
  approved: boolean
  note: string
}

export type AnalysisFilters = {
  period: string
  year: string
  machine: string
  line: string
  shift: string
  critical: string[]
}

export type ParetoPoint = {
  cause: string
  ocorrencias: number
  acumulado: number
  projecao: number
}

export type SeriesPoint = {
  month: string
  realizado: number
  meta: number
  projecao: number
  precisao: number
}

export type ImportRow = {
  machine: string
  date: string
  minutes: string
  line: string
  error: string
}

export type User = {
  name: string
  email: string
  role: string
  last: string
  status: string
}

export type ChatMessage = {
  from: "user" | "assistant"
  text: string
}

export type WeekPoint = {
  day: string
  falhas: number
  anterior: number
}

export type JackKnifePoint = {
  name: string
  x: number
  y: number
}

export type WaterfallSource = {
  first: number
  last: number
  firstLabel: string
  lastLabel: string
  remainderLabel: string
  changes: {
    cause: string
    delta: number
  }[]
}

export type AnalyticsSource = {
  weekData: WeekPoint[]
  trendData: SeriesPoint[]
  paretoData: ParetoPoint[]
  summaryText: string
  jackKnifeData: JackKnifePoint[]
  controlValues: number[]
  heatmapValues: number[][]
  waterfall: WaterfallSource
}

export type PrototypeViews = {
  operatingSummary: {
    operating: number
    stopped: number
    awaiting: number
  }
  assistantMetrics: {
    accuracy: number
    confirmed: number
    corrected: number
  }
  classifiedBaseline: number
  demoProfile: {
    name: string
    fullName: string
    email: string
  }
  machineTechnicalData: {
    manufacturer: string
    model: string
    year: string
    location: string
    sapCode: string
    preventiveDate: string
    preventiveCountdown: string
  }
  importSummary: {
    total: number
    issues: number
  }
  notifications: {
    icon: string
    text: string
    detail: string
    path: string
  }[]
  homeMTTR: number
  sparklineMTTR: number[]
  homeMTBF: number
  sparklineMTBF: number[]
  sparklineMonthlyFailures: number[]
  homeAverageDowntime: number
  sparklineAverageDowntime: number[]
  availabilityData: {
    name: string
    value: number
  }[]
  maintenanceTypes: {
    name: string
    value: number
    color: string
  }[]
  machineOperatingHours: number
  machineMtbf: number
  machineAnnualFailures: number
  maintenanceTimeline: {
    date: string
    type: string
    desc: string
    tech: string
  }[]
  replacedParts: string[][]
  machineDocuments: string[]
  machineFailures: string[][]
  ordersOpen: number
  ordersInProgress: number
  ordersCompletedThisMonth: number
  ordersOverdue: number
  classificationApprovedUnchanged: number
  analysisAvailability: number
  machineZones: {
    zone: string
    machines: string
    desc: string
    color: string
  }[]
  initialMessages: ChatMessage[]
  predictions: {
    machine: string
    risk: number
    desc: string
  }[]
  initialUsers: User[]
  accessLogs: string[][]
  initialHistory: string[]
}

export type PrototypeSnapshot = {
  machines: Machine[]
  orders: Order[]
  failures: Failure[]
  analytics: AnalyticsSource
  views: PrototypeViews
  imports: ImportRow[]
}

export type MaintenanceRecords = {
  machines: Machine[]
  orders: Order[]
  failures: Failure[]
  history: string[]
  users: User[]
}