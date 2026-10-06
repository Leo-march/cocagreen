import { type AnalysisFilters } from "@/types/maintenance"

export const weekdays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]

export const graphOptions = [
  "Pareto",
  "Barras empilhadas por criticidade",
  "Linha com meta/projeção",
  "Rosca",
  "Jack-Knife",
  "Mapa de calor",
  "Carta de controle",
  "Cascata",
  "Treemap",
]

export const defaultChart: Record<string, string> = {
  "Visão geral": "Barras empilhadas por criticidade",
  Pareto: "Pareto",
  "Jack-Knife": "Jack-Knife",
  "Acompanhamento de Paradas": "Linha com meta/projeção",
  "Mapa de Calor": "Mapa de calor",
  Cascata: "Cascata",
}

export const defaultFilters: AnalysisFilters = {
  period: "Setembro",
  year: "2026",
  machine: "Todas as máquinas",
  line: "Todas as linhas",
  shift: "Todos os turnos",
  critical: ["A", "B", "C"],
}
