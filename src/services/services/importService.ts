import { parseSapCsv } from "@/domain/imports"
import { type ImportRow } from "@/types/maintenance"

export async function readSapFile(file: File): Promise<ImportRow[]> {
  return parseSapCsv(await file.text())
}
