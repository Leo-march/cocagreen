import { type ImportRow } from "@/types/maintenance"

export const demoImport: ImportRow[] = [
  {
    machine: "Envasadora PET",
    date: "30/09/2026",
    minutes: "42",
    line: "Linha 3",
    error: "",
  },
  {
    machine: "Rotuladora automática",
    date: "30/09/2026",
    minutes: "85",
    line: "Linha 2",
    error: "Linha duplicada",
  },
  {
    machine: "Paletizadora",
    date: "31/09/2026",
    minutes: "64",
    line: "Linha 1",
    error: "Data inválida",
  },
  {
    machine: "",
    date: "29/09/2026",
    minutes: "18",
    line: "Linha 3",
    error: "Campo máquina vazio",
  },
  {
    machine: "Compressor de ar",
    date: "28/09/2026",
    minutes: "36",
    line: "Linha 2",
    error: "",
  },
]
