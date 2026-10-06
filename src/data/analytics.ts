import { weekdays } from "@/config/analysis"

export const weekData = weekdays.map((day, index) => ({
  day,
  falhas: [7, 12, 8, 15, 10, 5, 3][index],
  anterior: [10, 15, 12, 17, 14, 8, 6][index],
}))

export const trendData = ["Abr", "Mai", "Jun", "Jul", "Ago", "Set"].map(
  (month, index) => ({
    month,
    realizado: [680, 620, 710, 580, 490, 410][index],
    meta: 500,
    projecao: [680, 640, 600, 550, 470, 380][index],
    precisao: [81, 85, 88, 90, 93, 96][index],
  }),
)

export const paretoData = [
  "Mecânica",
  "Elétrica",
  "Sensor",
  "Pneumática",
  "Lubrificação",
  "Outras",
].map((cause, index) => ({
  cause,
  ocorrencias: [42, 28, 18, 11, 7, 4][index],
  acumulado: [38.2, 63.6, 80, 90, 96.4, 100][index],
  projecao: [36, 23, 15, 9, 5, 3][index],
}))

export const summaryText =
  "Em setembro de 2026, o tempo de parada foi de 410 min, uma redução de 29,3% em relação a julho. Falhas mecânicas, elétricas e de sensores representam 80% das ocorrências. Priorize a inspeção da Rotuladora automática e da Envasadora PET. Projeções de IA não substituem dados realizados nem a decisão do analista."

export const waterfallData = {
  first: 490,
  last: 410,
  firstLabel: "Agosto",
  lastLabel: "Setembro",
  remainderLabel: "Lubrificação",
  changes: [
    { cause: "Mecânica", delta: -55 },
    { cause: "Elétrica", delta: -22 },
    { cause: "Sensor", delta: 18 },
  ],
}

export const jackKnifeData = [
  { name: "Rotuladora", x: 14, y: 6.2 },
  { name: "Envasadora", x: 10, y: 4.3 },
  { name: "Paletizadora", x: 3, y: 5.4 },
  { name: "Compressor", x: 9, y: 1.2 },
  { name: "Esteira", x: 2, y: 0.7 },
  { name: "Sopradora", x: 4, y: 1.4 },
]

export const controlValues = [42, 35, 48, 39, 31, 70, 37, 43, 34, 40, 32, 38]

export const heatmapValues = [
  [18, 32, 44, 62, 28, 15, 8],
  [25, 54, 85, 41, 36, 22, 12],
  [12, 24, 36, 29, 18, 10, 5],
]
