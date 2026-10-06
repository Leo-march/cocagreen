import {
  type ChatMessage,
  type User,
  type PrototypeViews,
} from "@/types/maintenance"

export const notifications = [
  {
    icon: "CircleAlert",
    text: "Falha crítica na Rotuladora automática",
    detail: "Linha 2 · há 15 minutos",
    path: "/classificacao",
  },
  {
    icon: "Clock3",
    text: "Preventiva da Paletizadora atrasada",
    detail: "Prazo: 28/09/2026",
    path: "/maquinas/3",
  },
  {
    icon: "Package",
    text: "Estoque baixo de rolamentos",
    detail: "2 unidades disponíveis",
    path: "/maquinas/1",
  },
]

export const homeMTTR = 2.4

export const sparklineMTTR = [7, 9, 5, 6, 4, 5, 3]

export const homeMTBF = 168

export const sparklineMTBF = [3, 4, 3, 6, 5, 7, 8]

export const sparklineMonthlyFailures = [9, 8, 11, 7, 8, 5, 4]

export const homeAverageDowntime = 32

export const sparklineAverageDowntime = [8, 7, 8, 5, 7, 5, 4]

export const availabilityData = [
  { name: "Tempo disponível", value: 92.4 },
  { name: "Tempo de parada", value: 7.6 },
]

export const maintenanceTypes = [
  { name: "Preventiva", value: 42, color: "bg-primary" },
  { name: "Corretiva", value: 28, color: "bg-support" },
  { name: "Preditiva", value: 14, color: "bg-chart-label" },
  { name: "Inspeção", value: 8, color: "bg-[#596270]" },
  { name: "Lubrificação", value: 5, color: "bg-support-muted" },
  { name: "Calibração", value: 3, color: "bg-[#42454e]" },
]

export const machineOperatingHours = 12480

export const machineMtbf = 186

export const machineAnnualFailures = 14

export const maintenanceTimeline = [
  {
    date: "24/09/2026",
    type: "Preventiva",
    desc: "Substituição de vedações e inspeção de válvulas.",
    tech: "Ana Oliveira · 1h 20min",
  },
  {
    date: "12/09/2026",
    type: "Corretiva",
    desc: "Ajuste de pressão no sistema de enchimento.",
    tech: "Carlos Silva · 2h 10min",
  },
  {
    date: "01/09/2026",
    type: "Inspeção",
    desc: "Verificação de sensores e parâmetros de operação.",
    tech: "Marcos Santos · 45min",
  },
  {
    date: "18/08/2026",
    type: "Lubrificação",
    desc: "Lubrificação de rolamentos e guias de transmissão.",
    tech: "Ana Oliveira · 35min",
  },
]

export const replacedParts = [
  ["Vedação de válvula", "VED-245", "12 un", "24/09/2026"],
  ["Rolamento SKF", "ROL-6205", "2 un", "18/08/2026"],
]

export const machineDocuments = [
  "Manual de operação",
  "Plano de manutenção",
  "Certificado de calibração",
]

export const machineFailures = [
  ["12/09/2026", "Oscilação de pressão", "130 min", "B"],
  ["19/08/2026", "Falha de sensor", "45 min", "C"],
]

export const ordersOpen = 12

export const ordersInProgress = 8

export const ordersCompletedThisMonth = 64

export const ordersOverdue = 3

export const classificationApprovedUnchanged = 96.2

export const analysisAvailability = 92.4

export const machineZones = [
  {
    zone: "Zona crítica",
    machines: "Rotuladora · Envasadora",
    desc: "Alta frequência e alto MTTR",
    color: "text-red-800 bg-red-50",
  },
  {
    zone: "Falhas agudas",
    machines: "Paletizadora",
    desc: "Poucas falhas, reparos longos",
    color: "text-amber-900 bg-amber-50",
  },
  {
    zone: "Falhas crônicas",
    machines: "Compressor",
    desc: "Falhas recorrentes",
    color: "text-rose-900 bg-rose-50",
  },
  {
    zone: "Controlada",
    machines: "Esteira · Sopradora",
    desc: "Baixa frequência e baixo MTTR",
    color: "text-emerald-900 bg-emerald-50",
  },
]

export const initialMessages: ChatMessage[] = [
  {
    from: "user",
    text: "Quais máquinas da Linha 3 tiveram mais falhas em setembro?",
  },
  {
    from: "assistant",
    text: "Na Linha 3, a Envasadora PET registrou 8 falhas (268 min de parada) e a Esteira transportadora registrou 3 falhas (54 min). Recomendo priorizar a inspeção das válvulas da Envasadora e verificar o alinhamento da correia da Esteira. Fonte: histórico SAP de setembro/2026. Resposta ilustrativa, sujeita à validação do analista.",
  },
]

export const predictions = [
  {
    machine: "Envasadora PET",
    risk: 82,
    desc: "Vibração acima do padrão no conjunto de válvulas.",
  },
  {
    machine: "Rotuladora automática",
    risk: 74,
    desc: "Recorrência de falhas nos sensores de posicionamento.",
  },
  {
    machine: "Compressor de ar",
    risk: 61,
    desc: "Tendência de elevação da temperatura de operação.",
  },
]

export const initialUsers: User[] = [
  {
    name: "Talita Almeida",
    email: "talita.almeida@kof.com",
    role: "Analista",
    last: "30/09/2026 às 08:15",
    status: "Ativo",
  },
  {
    name: "Carlos Silva",
    email: "carlos.silva@kof.com",
    role: "Analista",
    last: "30/09/2026 às 07:52",
    status: "Ativo",
  },
  {
    name: "Ana Oliveira",
    email: "ana.oliveira@kof.com",
    role: "Coordenação",
    last: "29/09/2026 às 16:32",
    status: "Ativo",
  },
  {
    name: "Marcos Santos",
    email: "marcos.santos@kof.com",
    role: "Gerência",
    last: "29/09/2026 às 14:08",
    status: "Ativo",
  },
]

export const accessLogs = [
  [
    "Talita Almeida",
    "30/09/2026 às 08:15",
    "Entrada no portal",
    "Unidade Marília",
  ],
  [
    "Carlos Silva",
    "30/09/2026 às 07:52",
    "Entrada no portal",
    "Unidade Marília",
  ],
  [
    "Ana Oliveira",
    "29/09/2026 às 16:32",
    "Consulta das análises",
    "Unidade Marília",
  ],
  [
    "Marcos Santos",
    "29/09/2026 às 14:08",
    "Exportação de análise",
    "Unidade Marília",
  ],
]

export const initialHistory = [
  "Talita Almeida · 29/09/2026 às 16:42 · Sopradora de garrafas: B → A. Parada impactou toda a linha.",
  "Carlos Silva · 29/09/2026 às 14:18 · Esteira transportadora: sugestão C → classificação C aprovada.",
]

export const machineTechnicalData = {
  manufacturer: "Krones",
  model: "Contiform 3 Pro",
  year: "2021",
  location: "Bloco B",
  sapCode: "10004562",
  preventiveDate: "02/10/2026",
  preventiveCountdown: "Em 2 dias",
}
export const importSummary = { total: 1240, issues: 12 }

export const mockViews: PrototypeViews = {
  operatingSummary: { operating: 24, stopped: 2, awaiting: 1 },
  assistantMetrics: { accuracy: 96.2, confirmed: 1248, corrected: 52 },
  classifiedBaseline: 142,
  demoProfile: {
    name: "Talita",
    fullName: "Talita Almeida",
    email: "talita.almeida@kof.com",
  },
  machineTechnicalData,
  importSummary,
  notifications,
  homeMTTR,
  sparklineMTTR,
  homeMTBF,
  sparklineMTBF,
  sparklineMonthlyFailures,
  homeAverageDowntime,
  sparklineAverageDowntime,
  availabilityData,
  maintenanceTypes,
  machineOperatingHours,
  machineMtbf,
  machineAnnualFailures,
  maintenanceTimeline,
  replacedParts,
  machineDocuments,
  machineFailures,
  ordersOpen,
  ordersInProgress,
  ordersCompletedThisMonth,
  ordersOverdue,
  classificationApprovedUnchanged,
  analysisAvailability,
  machineZones,
  initialMessages,
  predictions,
  initialUsers,
  accessLogs,
  initialHistory,
}
