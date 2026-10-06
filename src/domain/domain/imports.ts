import { type ImportRow } from "@/types/maintenance"

export function parseCsvLine(line: string, delimiter: string) {
  const result: string[] = []
  let current = ""
  let quoted = false
  for (let index = 0; index < line.length; index++) {
    const character = line[index]
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"'
        index++
      } else quoted = !quoted
    } else if (character === delimiter && !quoted) {
      result.push(current.trim())
      current = ""
    } else current += character
  }
  result.push(current.trim())
  return result
}

export function parseSapCsv(text: string): ImportRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim())
  const delimiter = lines[0]?.includes(";") ? ";" : ","
  const headings = parseCsvLine(lines[0] || "", delimiter).map((heading) =>
    heading
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""),
  )
  if (
    !["maquina", "data", "minutos", "linha"].every((heading) =>
      headings.includes(heading),
    )
  )
    throw new Error(
      "O CSV precisa das colunas: maquina, data, minutos e linha.",
    )
  const seen = new Set<string>()
  const parsed = lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter)
    const field = (name: string) => values[headings.indexOf(name)] || ""
    const machine = field("maquina")
    const date = field("data")
    const minutes = field("minutos")
    const productionLine = field("linha")
    const parts = date.split("/").map(Number)
    const parsedDate = new Date(parts[2], parts[1] - 1, parts[0])
    const signature = `${machine}|${date}|${minutes}|${productionLine}`
    const problems = []
    if (![machine, date, minutes, productionLine].every(Boolean))
      problems.push("Campo obrigatório vazio")
    if (
      parts.length !== 3 ||
      parsedDate.getDate() !== parts[0] ||
      parsedDate.getMonth() !== parts[1] - 1 ||
      parsedDate.getFullYear() !== parts[2]
    )
      problems.push("Data inválida")
    if (minutes && (!Number.isFinite(Number(minutes)) || Number(minutes) < 0))
      problems.push("Minutos inválidos")
    if (seen.has(signature)) problems.push("Linha duplicada")
    seen.add(signature)
    return {
      machine,
      date,
      minutes,
      line: productionLine,
      error: problems.join(" · "),
    }
  })
  if (!parsed.length)
    throw new Error(
      "O arquivo não contém registros. Verifique a exportação do SAP.",
    )

  return parsed
}
