"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { getLoggedInUser, getUserRole, subscribeToAuthChanges } from "@/lib/client-auth";

type DashboardData = {
  tableName: string;
  columns: string[];
  rows: Record<string, unknown>[];
};

type ClassificationRow = {
  id: string;
  date: Date | null;
  shift: string;
  order: string;
  machine: string;
  material: string;
  line: string;
  downtime: string;
  observations: string;
  aiPrediction: string;
  aiConfidence: number | null;
  approvedClassification: string;
  classificationApproved: boolean;
};

type ClassificationFilter = {
  date: string;
  year: string;
  machine: string;
  line: string;
  shift: string;
};

type ClassificationEdit = {
  date: string;
  shift: string;
  order: string;
  line: string;
  machine: string;
  material: string;
  downtime: string;
  observations: string;
  category: string;
};

type ClassificationRecord = {
  category: string;
  approved: boolean;
  edits: Partial<ClassificationEdit>;
};

type ClassificationRecords = Record<string, ClassificationRecord>;

const editableFields: (keyof ClassificationEdit)[] = [
  "date",
  "shift",
  "order",
  "line",
  "machine",
  "material",
  "downtime",
  "observations",
  "category",
];

const failureCategories = [
  "CRASH DE GARRAFAS",
  "DANIFICAÇÃO DE GARRAFAS",
  "DESALINHAMENTO DE AGREGADO",
  "DESALINHAMENTO DE GUIA",
  "DESARME DE MESA",
  "DESARME DE MOTOR",
  "DESARME DE TRANSPORTE",
  "ENROSCO DE GARRAFAS",
  "ENROSCO DE LATAS",
  "ENROSCO DE PACOTES",
  "ENROSCO DE RÓTULOS",
  "ENROSCO DE TAMPAS",
  "ESCAPE DE ESTEIRA",
  "FALHA CRITICA",
  "FALHA DE ACÚMULO NO TRANSPORTE",
  "FALHA DE AUTOMAÇÃO",
  "FALHA DE BARREIRA",
  "FALHA DE BOMBA",
  "FALHA DE CÂMERA",
  "FALHA DE CODIFICAÇÃO",
  "FALHA DE COMPACTAÇÃO DE CAMADA",
  "FALHA DE COMUNICAÇÃO",
  "FALHA DE CONEXÃO DE MANGUEIRA",
  "FALHA DE CORREIA",
  "FALHA DE CORTE DE FILME",
  "FALHA DE DOSAGEM",
  "FALHA DE ELEVADOR",
  "FALHA DE ELO DE ESTEIRA",
  "FALHA DE EMPURRADOR",
  "FALHA DE ENCHIMENTO",
  "FALHA DE FIXAÇÃO",
  "FALHA DE FORMAÇÃO DE CAMADA",
  "FALHA DE FREIO",
  "FALHA DE GUIA",
  "FALHA DE IHM",
  "FALHA DE IMPRESSÃO",
  "FALHA DE INSPEÇÃO",
  "FALHA DE INVERSOR",
  "FALHA DE LUBRIFICAÇÃO",
  "FALHA DE MAGAZINE",
  "FALHA DE MANDRIL",
  "FALHA DE MANGUEIRA",
  "FALHA DE MOLA",
  "FALHA DE MOTOR",
  "FALHA DE PATINS",
  "FALHA DE PEGADOR",
  "FALHA DE PINÇA",
  "FALHA DE PENTE DE TRANSFERÊNCIA",
  "FALHA DE PORTA DE SEGURANÇA",
  "FALHA DE POSICIONAMENTO DE PACOTES",
  "FALHA DE POSICIONAMENTO DE PALETE",
  "FALHA DE POSICIONAMENTO DO CABEÇOTE",
  "FALHA DE PROPORCIONAMENTO",
  "FALHA DE REJEIÇÃO",
  "FALHA DE ROLETES",
  "FALHA DE ROTULAGEM",
  "FALHA DE SENSOR",
  "FALHA DE SOLDA DE FILME",
  "FALHA DE TENSOR DE RÓTULOS",
  "FALHA DE TRANSPORTE",
  "FALHA DE TRANSPORTE DE GARRAFAS",
  "FALHA DE TRANSPORTE DE PALETES",
  "FALHA DE TROCA DE PALETE DE CARTÃO",
  "FALHA DE VÁLVULA",
  "FALHA DE VÁLVULA DE ENCHIMENTO",
  "FALHA DE VÁLVULA MODULADORA",
  "FALHA ELÉTRICA SEM COMPONENTE IDENTIFICADO",
  "FALHA NA MESA DE CARGA",
  "FALHA DE VELOCIDADE DO TRANSPORTE",
  "QUEDA DE GARRAFAS",
  "QUEDA DE LATAS",
  "QUEBRA DE CORREIA",
  "QUEBRA DE ESTEIRA",
  "QUEBRA DE FILAMENTO",
  "QUEBRA DE PINO",
  "QUEBRA DE SEGMENTO",
  "ROMPIMENTO DE FILME",
  "ROMPIMENTO DE MANGUEIRA",
  "ROMPIMENTO DE MANGUEIRA DE AR",
  "SEM MODO DE FALHA IDENTIFICADO",
  "SOBRECORRENTE",
  "TRAVAMENTO DE ATUADOR",
  "TRAVAMENTO DE BOCAL",
  "TRAVAMENTO DE ESTEIRA",
  "TRAVAMENTO DE PATINS",
  "TRAVAMENTO DE PERSIANA",
  "TRAVAMENTO DE ROLETES",
  "TRAVAMENTO DE SEGMENTOS",
  "TRAVAMENTO DE TRANSPORTE",
  "TRAVAMENTO DO SISTEMA DE COMPACTAÇÃO",
  "VAZAMENTO",
  "VAZAMENTO EM VÁLVULA",
];

const emptyFilter: ClassificationFilter = {
  date: "",
  year: "all",
  machine: "all",
  line: "all",
  shift: "all",
};

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function findColumn(columns: string[], pattern: RegExp) {
  return columns.find((column) => pattern.test(normalizeText(column)));
}

function findObservationsColumn(columns: string[]) {
  const exactObservationNames = [
    "observacao",
    "observacoes",
    "observation",
    "observations",
    "observacao_parada",
    "observacoes_parada",
    "observacoes_da_parada",
  ];
  const normalizedColumns = columns.map((column) => ({
    column,
    normalized: normalizeText(column).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
  }));

  for (const name of exactObservationNames) {
    const match = normalizedColumns.find(({ normalized }) => normalized === name);
    if (match) return match.column;
  }

  return columns.find((column) => /observa|observation|observacion/.test(normalizeText(column)))
    ?? columns.find((column) => /descricao|description|descrip/.test(normalizeText(column)));
}

function getDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = String(value ?? "").trim();
  if (!text) return null;

  const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) {
    const date = new Date(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const brazilianDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (brazilianDate) {
    const date = new Date(Number(brazilianDate[3]), Number(brazilianDate[2]) - 1, Number(brazilianDate[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (/^\d{4,6}(?:[.,]\d+)?$/.test(text)) {
    const serial = Number(text.replace(",", "."));
    const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(text.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date: Date | null) {
  return date
    ? date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "—";
}

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function readCell(row: Record<string, unknown>, column: string | undefined) {
  return column ? String(row[column] ?? "").trim() : "";
}

function readConfidence(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const confidence = Number(value);
  return Number.isFinite(confidence) && confidence >= 0 && confidence <= 1 ? confidence : null;
}

function buildRows(data: DashboardData): ClassificationRow[] {
  const dateColumn = findColumn(data.columns, /data|date|inicio|abertura|ocorrencia/);
  const shiftColumn = findColumn(data.columns, /turno|shift/);
  const orderColumn = findColumn(data.columns, /ordem|order|(^|_)op($|_)/);
  const machineColumn = findColumn(data.columns, /chave.*parada|parada.*chave/);
  const materialColumn = findColumn(data.columns, /^material$/);
  const lineColumn = findColumn(data.columns, /linha|line/);
  const downtimeColumn = findColumn(data.columns, /minut.*parada|parada.*minut|tempo.*parada|duracao|duration|downtime|^parada$/)
    ?? findColumn(data.columns, /minut/);
  const observationsColumn = findObservationsColumn(data.columns);
  const aiPredictionColumn = findColumn(data.columns, /^classificacao_pela_ia$/);
  const aiConfidenceColumn = findColumn(data.columns, /^confianca_classificacao_ia$/);
  const approvedClassificationColumn = findColumn(data.columns, /^classificacao_validada$/);
  const classificationApprovedColumn = findColumn(data.columns, /^classificacao_ia_aprovada$/);

  return data.rows.map((row, index) => ({
    id: `${data.tableName}:${String(row.id ?? index)}`,
    date: getDate(dateColumn ? row[dateColumn] : null),
    shift: readCell(row, shiftColumn),
    order: readCell(row, orderColumn),
    machine: readCell(row, machineColumn),
    material: readCell(row, materialColumn),
    line: readCell(row, lineColumn),
    downtime: readCell(row, downtimeColumn),
    observations: readCell(row, observationsColumn),
    aiPrediction: readCell(row, aiPredictionColumn),
    aiConfidence: aiConfidenceColumn ? readConfidence(row[aiConfidenceColumn]) : null,
    approvedClassification: readCell(row, approvedClassificationColumn),
    classificationApproved: classificationApprovedColumn
      ? ["1", "true"].includes(readCell(row, classificationApprovedColumn).toLowerCase())
      : false,
  }));
}

function readStoredClassifications(value: string | null, categories: ReadonlySet<string>): ClassificationRecords {
  if (!value) return {};
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("O formato das classificações salvas não é válido.");
  }

  const records: ClassificationRecords = {};
  for (const [id, storedRecord] of Object.entries(parsed)) {
    if (typeof storedRecord === "string") {
      if (storedRecord && !categories.has(storedRecord)) {
        throw new Error("Há classificações salvas com categorias inválidas.");
      }
      records[id] = { category: storedRecord, approved: Boolean(storedRecord), edits: {} };
      continue;
    }

    if (typeof storedRecord !== "object" || storedRecord === null || Array.isArray(storedRecord)) {
      throw new Error("Há registros classificados salvos em um formato inválido.");
    }

    const record = storedRecord as Record<string, unknown>;
    const category = typeof record.category === "string" ? record.category : "";
    if (category && !categories.has(category)) {
      throw new Error("Há classificações salvas com categorias inválidas.");
    }
    if (typeof record.approved !== "boolean") {
      throw new Error("Há registros salvos com estado de aprovação inválido.");
    }

    const storedEdits = record.edits ?? {};
    if (typeof storedEdits !== "object" || storedEdits === null || Array.isArray(storedEdits)) {
      throw new Error("Há edições salvas em um formato inválido.");
    }
    const edits = storedEdits as Record<string, unknown>;
    if (Object.entries(edits).some(([field, fieldValue]) =>
      !editableFields.includes(field as keyof ClassificationEdit) || typeof fieldValue !== "string")) {
      throw new Error("Há campos de edição salvos em um formato inválido.");
    }
    records[id] = {
      category,
      approved: record.approved,
      edits: edits as Partial<ClassificationEdit>,
    };
  }
  return records;
}

function getEffectiveRow(row: ClassificationRow, record: ClassificationRecord | undefined) {
  const edits = record?.edits ?? {};
  return {
    ...row,
    date: edits.date !== undefined ? getDate(edits.date) : row.date,
    shift: edits.shift ?? row.shift,
    order: edits.order ?? row.order,
    line: edits.line ?? row.line,
    machine: edits.machine ?? row.machine,
    material: edits.material ?? row.material,
    downtime: edits.downtime ?? row.downtime,
    observations: edits.observations ?? row.observations,
  };
}

function createEditDraft(row: ClassificationRow, record: ClassificationRecord | undefined): ClassificationEdit {
  const effectiveRow = getEffectiveRow(row, record);
  return {
    date: effectiveRow.date ? getDateKey(effectiveRow.date) : "",
    shift: effectiveRow.shift,
    order: effectiveRow.order,
    line: effectiveRow.line,
    machine: effectiveRow.machine,
    material: effectiveRow.material,
    downtime: effectiveRow.downtime,
    observations: effectiveRow.observations,
    category: record?.category ?? "",
  };
}

export default function FailureClassificationPage() {
  const loggedUser = useSyncExternalStore(subscribeToAuthChanges, getLoggedInUser, () => null);
  const isAdmin = useSyncExternalStore(subscribeToAuthChanges, getUserRole, () => "visitor") === "admin";
  const [data, setData] = useState<DashboardData | null>(null);
  const [classifications, setClassifications] = useState<ClassificationRecords>({});
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [editDrafts, setEditDrafts] = useState<Record<string, ClassificationEdit>>({});
  const [otherFailureRows, setOtherFailureRows] = useState<Record<string, boolean>>({});
  const [otherFailureInputs, setOtherFailureInputs] = useState<Record<string, string>>({});
  const [savingOtherFailureRows, setSavingOtherFailureRows] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<ClassificationFilter>(emptyFilter);
  const [activeTab, setActiveTab] = useState<"pending" | "classified">("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [storageReady, setStorageReady] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const [savingClassificationIds, setSavingClassificationIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/classificacaofalhas", { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as {
          data?: DashboardData | null;
          customCategories?: string[];
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error || "Não foi possível carregar os dados.");
        setData(payload.data ?? null);
        const loadedCustomCategories = Array.isArray(payload.customCategories)
          ? payload.customCategories.filter((category): category is string => typeof category === "string")
          : [];
        setCustomCategories(loadedCustomCategories);
        try {
          const key = payload.data ? `cocagreen:classificacoes:${payload.data.tableName}` : "";
          const loadedRows = payload.data ? buildRows(payload.data) : [];
          const categories = new Set([
            ...failureCategories,
            ...loadedCustomCategories,
            ...loadedRows.map(({ aiPrediction }) => aiPrediction).filter(Boolean),
          ]);
          const automaticClassifications = Object.fromEntries(
            loadedRows
              .filter(({ aiPrediction, aiConfidence }) => aiPrediction && aiConfidence !== null && aiConfidence > 0.9)
              .map(({ id, aiPrediction }) => [id, { category: aiPrediction, approved: true, edits: {} }]),
          ) as ClassificationRecords;
          const databaseClassifications = Object.fromEntries(
            loadedRows
              .filter(({ classificationApproved }) => classificationApproved)
              .map(({ id, approvedClassification }) => [
                id,
                { category: approvedClassification, approved: true, edits: {} },
              ]),
          ) as ClassificationRecords;
          const savedClassifications = readStoredClassifications(
            key ? localStorage.getItem(key) : null,
            categories,
          );
          setClassifications({
            ...automaticClassifications,
            ...savedClassifications,
            ...databaseClassifications,
          });
          setStorageReady(true);
        } catch (storageError) {
          setStorageWarning(storageError instanceof Error
            ? `Não foi possível carregar as classificações salvas; as alterações não serão persistidas. ${storageError.message}`
            : "Não foi possível carregar as classificações salvas; as alterações não serão persistidas.");
        }
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof Error && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os dados.");
        setStorageReady(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, []);

  const rows = useMemo(() => data ? buildRows(data) : [], [data]);
  const years = useMemo(
    () => Array.from(new Set(rows.flatMap(({ date }) => date ? [String(date.getFullYear())] : []))).sort().reverse(),
    [rows],
  );
  const machineOptions = useMemo(
    () => Array.from(new Set(rows.map(({ machine, material }) => [machine, material].filter(Boolean).join(" / ")).filter(Boolean))).sort(),
    [rows],
  );
  const lineOptions = useMemo(
    () => Array.from(new Set(rows.map(({ line }) => line).filter(Boolean))).sort(),
    [rows],
  );
  const shiftOptions = useMemo(
    () => Array.from(new Set(rows.map(({ shift }) => shift).filter(Boolean))).sort(),
    [rows],
  );
  const classificationCategories = useMemo(
    () => Array.from(new Set([
      ...failureCategories,
      ...customCategories,
      ...rows.map(({ aiPrediction }) => aiPrediction).filter(Boolean),
    ])),
    [customCategories, rows],
  );
  const effectiveRows = useMemo(
    () => rows.map((row) => getEffectiveRow(row, classifications[row.id])),
    [classifications, rows],
  );
  const filteredRows = useMemo(() => effectiveRows.filter((row) => {
    if (filter.date && (!row.date || getDateKey(row.date) !== filter.date)) return false;
    if (filter.year !== "all" && String(row.date?.getFullYear() ?? "") !== filter.year) return false;
    if (filter.machine !== "all" && [row.machine, row.material].filter(Boolean).join(" / ") !== filter.machine) return false;
    if (filter.line !== "all" && row.line !== filter.line) return false;
    if (filter.shift !== "all" && row.shift !== filter.shift) return false;
    return true;
  }), [effectiveRows, filter]);
  const pendingRows = filteredRows.filter(({ id }) => !classifications[id]?.approved);
  const classifiedRows = filteredRows.filter(({ id }) => Boolean(classifications[id]?.approved));
  const visibleTab = loggedUser ? activeTab : "classified";
  const visibleRows = visibleTab === "pending" ? pendingRows : classifiedRows;

  function saveRecords(next: ClassificationRecords) {
    if (!storageReady || !data) {
      setActionError("Os dados ainda não estão prontos para serem salvos.");
      return false;
    }
    try {
      localStorage.setItem(`cocagreen:classificacoes:${data.tableName}`, JSON.stringify(next));
      setClassifications(next);
      setStorageWarning("");
      setActionError("");
      return true;
    } catch (storageError) {
      setStorageWarning(storageError instanceof Error
        ? `Não foi possível salvar as alterações neste navegador. ${storageError.message}`
        : "Não foi possível salvar as alterações neste navegador.");
      return false;
    }
  }

  function updateClassification(id: string, category: string) {
    if (!isAdmin) {
      setActionError("Acesso restrito: somente a Talita pode alterar classificações.");
      return;
    }
    const next = { ...classifications };
    next[id] = { ...(next[id] ?? { category: "", approved: false, edits: {} }), category };
    saveRecords(next);
  }

  async function addOtherFailure(row: ClassificationRow) {
    const category = (otherFailureInputs[row.id] ?? "").trim();
    if (!category) {
      setActionError("Digite o nome da falha antes de adicionar.");
      return;
    }
    if (category.length > 512) {
      setActionError("O nome da falha deve ter no máximo 512 caracteres.");
      return;
    }

    setActionError("");
    setSavingOtherFailureRows((current) => ({ ...current, [row.id]: true }));
    try {
      const response = await fetch("/api/classificacaofalhas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });
      const payload = await response.json() as { category?: string; error?: string };
      if (!response.ok || typeof payload.category !== "string") {
        throw new Error(payload.error || "Não foi possível salvar a nova falha.");
      }

      const savedCategory = payload.category;
      setCustomCategories((current) => current.includes(savedCategory)
        ? current
        : [...current, savedCategory]);
      if (editDrafts[row.id]) {
        updateEditDraft(row.id, "category", savedCategory);
      } else {
        updateClassification(row.id, savedCategory);
      }
      setOtherFailureRows((current) => ({ ...current, [row.id]: false }));
      setOtherFailureInputs((current) => ({ ...current, [row.id]: "" }));
    } catch (saveError) {
      setActionError(saveError instanceof Error ? saveError.message : "Não foi possível salvar a nova falha.");
    } finally {
      setSavingOtherFailureRows((current) => ({ ...current, [row.id]: false }));
    }
  }

  async function approveRow(row: ClassificationRow) {
    if (!isAdmin) {
      setActionError("Acesso restrito: somente a Talita pode aprovar classificações.");
      return;
    }
    const category = classifications[row.id]?.category || row.aiPrediction;
    const databaseId = row.id.slice(row.id.lastIndexOf(":") + 1);
    setActionError("");
    setSavingClassificationIds((current) => ({ ...current, [row.id]: true }));
    try {
      const response = await fetch("/api/classificacaofalhas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: databaseId, classification: category, approved: true }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível salvar a classificação no banco de dados.");

      const next = {
        ...classifications,
        [row.id]: {
          ...(classifications[row.id] ?? { category: "", approved: false, edits: {} }),
          category,
          approved: true,
        },
      };
      setClassifications(next);
      if (data) {
        try {
          localStorage.setItem(`cocagreen:classificacoes:${data.tableName}`, JSON.stringify(next));
          setStorageWarning("");
        } catch (storageError) {
          setStorageWarning(storageError instanceof Error
            ? `A classificação foi salva no banco, mas não foi sincronizada neste navegador. ${storageError.message}`
            : "A classificação foi salva no banco, mas não foi sincronizada neste navegador.");
        }
      }
      setActiveTab("classified");
    } catch (approvalError) {
      setActionError(approvalError instanceof Error
        ? approvalError.message
        : "Não foi possível salvar a classificação no banco de dados.");
    } finally {
      setSavingClassificationIds((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
    }
  }

  function startEditing(row: ClassificationRow) {
    if (!isAdmin) {
      setActionError("Acesso restrito: o visitante só pode visualizar e não pode editar registros.");
      return;
    }
    setActionError("");
    setEditDrafts((current) => ({
      ...current,
      [row.id]: createEditDraft(row, classifications[row.id]),
    }));
  }

  function updateEditDraft(id: string, field: keyof ClassificationEdit, value: string) {
    setEditDrafts((current) => ({
      ...current,
      [id]: { ...current[id], [field]: value },
    }));
  }

  function cancelEditing(id: string) {
    setEditDrafts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setActionError("");
  }

  async function saveEditing(id: string) {
    if (!isAdmin) {
      setActionError("Acesso restrito: somente a Talita pode salvar alterações.");
      return;
    }
    const draft = editDrafts[id];
    if (!draft) return;
    if (draft.category && !classificationCategories.includes(draft.category)) {
      setActionError("Selecione uma classificação válida.");
      return;
    }

    const current = classifications[id] ?? { category: "", approved: false, edits: {} };
    const row = rows.find((candidate) => candidate.id === id);
    if (!row) {
      setActionError("O registro não está mais disponível.");
      return;
    }
    const databaseId = id.slice(id.lastIndexOf(":") + 1);
    try {
      const response = await fetch("/api/classificacaofalhas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: databaseId,
          classification: draft.category || row.aiPrediction,
          approved: current.approved,
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível salvar a classificação no banco de dados.");
    } catch (saveError) {
      setActionError(saveError instanceof Error
        ? saveError.message
        : "Não foi possível salvar a classificação no banco de dados.");
      return;
    }

    const next = {
      ...classifications,
      [id]: {
        ...current,
        category: draft.category || row.aiPrediction,
        edits: {
          date: draft.date,
          shift: draft.shift,
          order: draft.order,
          line: draft.line,
          machine: draft.machine,
          material: draft.material,
          downtime: draft.downtime,
          observations: draft.observations,
        },
      },
    };
    if (saveRecords(next)) {
      setEditDrafts((currentDrafts) => {
        const updatedDrafts = { ...currentDrafts };
        delete updatedDrafts[id];
        return updatedDrafts;
      });
    }
  }

  return (
    <div className="dashboard-page dashboard-with-brand-bg classification-page">
      {!isAdmin && (
        <aside className="classification-login-notice" role="status">
          <span className="classification-lock-icon" aria-hidden="true">⌑</span>
          <span>
            <strong>{loggedUser ? "Acesso de visitante" : "Faça login para acessar as informações restritas"}</strong>
            <small>
              {loggedUser
                ? "Sugestões da IA e classificações só ficam disponíveis para analistas autenticados."
                : "Sem login, classificações, sugestões da IA e ordens dos chamados ficam ocultas. Aprovação e edição exigem perfil Analista autenticado."}
            </small>
          </span>
          {!loggedUser && <Link href="/login">Fazer login</Link>}
        </aside>
      )}

      <section className="classification-filters" aria-label="Filtros dos registros">
        <label>
          <span>Dia</span>
          <input
            type="date"
            value={filter.date}
            onChange={(event) => setFilter((current) => ({ ...current, date: event.target.value }))}
          />
        </label>
        <label>
          <span>Ano</span>
          <select value={filter.year} onChange={(event) => setFilter((current) => ({ ...current, year: event.target.value }))}>
            <option value="all">Todos os anos</option>
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
        <label>
          <span>Máquina</span>
          <select value={filter.machine} onChange={(event) => setFilter((current) => ({ ...current, machine: event.target.value }))}>
            <option value="all">Todas as máquinas</option>
            {machineOptions.map((machine) => <option key={machine} value={machine}>{machine}</option>)}
          </select>
        </label>
        <label>
          <span>Linha</span>
          <select value={filter.line} onChange={(event) => setFilter((current) => ({ ...current, line: event.target.value }))}>
            <option value="all">Todas as linhas</option>
            {lineOptions.map((line) => <option key={line} value={line}>{line}</option>)}
          </select>
        </label>
        <label>
          <span>Turno</span>
          <select value={filter.shift} onChange={(event) => setFilter((current) => ({ ...current, shift: event.target.value }))}>
            <option value="all">Todos os turnos</option>
            {shiftOptions.map((shift) => <option key={shift} value={shift}>{shift}</option>)}
          </select>
        </label>
      </section>

      <section className="classification-table-card" aria-labelledby="classification-table-title">
        {storageWarning && <p className="classification-storage-warning" role="status">{storageWarning}</p>}
        {actionError && <p className="classification-action-error" role="alert">{actionError}</p>}
        <div className="classification-table-heading">
          <h2 id="classification-table-title">Chamados de manutenção</h2>
          <div className="classification-tabs" role="tablist" aria-label="Status da classificação">
            {loggedUser && (
              <button
                type="button"
                role="tab"
                aria-selected={visibleTab === "pending"}
                className={visibleTab === "pending" ? "classification-tab classification-tab-active" : "classification-tab"}
                onClick={() => setActiveTab("pending")}
              >
                Pendentes <span>{pendingRows.length}</span>
              </button>
            )}
            <button
              type="button"
              role="tab"
              aria-selected={visibleTab === "classified"}
              className={visibleTab === "classified" ? "classification-tab classification-tab-active" : "classification-tab"}
              onClick={() => setActiveTab("classified")}
            >
              Classificados <span>{classifiedRows.length}</span>
            </button>
          </div>
        </div>

        {isLoading ? (
          <p className="classification-message" role="status">Carregando registros...</p>
        ) : error ? (
          <p className="classification-message classification-message-error" role="alert">{error}</p>
        ) : !rows.length ? (
          <div className="classification-message">
            <strong>Nenhum dado encontrado</strong>
            <span>Importe uma planilha para começar a classificar os registros.</span>
            <Link href="/inserirdados" className="button button-secondary">Inserir dados</Link>
          </div>
        ) : !visibleRows.length ? (
          <p className="classification-message">
            {visibleTab === "pending"
              ? "Não há dados pendentes para os filtros selecionados."
              : "Ainda não há dados classificados para os filtros selecionados."}
          </p>
        ) : (
          <div className="classification-table-scroll">
            <table className="classification-table">
              <thead>
                <tr>
                  <th>Data / turno</th>
                  <th>Máquina / linha</th>
                  <th>Ordem do chamado</th>
                  <th>Parada (min)</th>
                  <th>Descrição</th>
                  <th>Sugestão da IA</th>
                  <th>Classificação</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const draft = editDrafts[row.id];
                  const isApproved = Boolean(classifications[row.id]?.approved);
                  const selectedCategory = draft?.category
                    ?? classifications[row.id]?.category
                    ?? row.aiPrediction;
                  return (
                    <tr key={row.id}>
                      <td data-label="Data / turno">
                        {draft ? (
                          <div className="classification-edit-stack">
                            <input
                              aria-label={`Data do registro ${row.order || row.id}`}
                              className="classification-edit-input"
                              type="date"
                              value={draft.date}
                              onChange={(event) => updateEditDraft(row.id, "date", event.target.value)}
                            />
                            <input
                              aria-label={`Turno do registro ${row.order || row.id}`}
                              className="classification-edit-input"
                              value={draft.shift}
                              onChange={(event) => updateEditDraft(row.id, "shift", event.target.value)}
                            />
                          </div>
                        ) : (
                          <>
                            <strong>{formatDate(row.date)}</strong>
                            <span>{row.shift || "Turno não informado"}</span>
                          </>
                        )}
                      </td>
                      <td data-label="Máquina / linha">
                        {draft ? (
                          <div className="classification-edit-stack">
                            <input
                              aria-label={`Máquina do registro ${row.order || row.id}`}
                              className="classification-edit-input"
                              value={draft.machine}
                              onChange={(event) => updateEditDraft(row.id, "machine", event.target.value)}
                            />
                            <input aria-label={`Linha do registro ${row.order || row.id}`} className="classification-edit-input" value={draft.line} onChange={(event) => updateEditDraft(row.id, "line", event.target.value)} />
                          </div>
                        ) : (
                          <>
                            <strong>{row.machine || "Chave da parada não informada"}</strong>
                            <span>{row.line || "Linha não informada"}</span>
                          </>
                        )}
                      </td>
                      <td data-label="Ordem do chamado">
                        {isAdmin ? (draft ? (
                          <input aria-label={`Ordem do registro ${row.order || row.id}`} className="classification-edit-input" value={draft.order} onChange={(event) => updateEditDraft(row.id, "order", event.target.value)} />
                        ) : row.order || "—") : <span className="classification-locked">♙ Login necessário</span>}
                      </td>
                      <td data-label="Parada (min)">
                        {draft ? (
                          <input
                            aria-label={`Tempo de parada do registro ${row.order || row.id}`}
                            className="classification-edit-input"
                            inputMode="decimal"
                            value={draft.downtime}
                            onChange={(event) => updateEditDraft(row.id, "downtime", event.target.value)}
                          />
                        ) : row.downtime ? `${row.downtime} min` : "—"}
                      </td>
                      <td className="classification-description" data-label="Descrição">
                        {draft ? (
                          <textarea
                            aria-label={`Observações do registro ${row.order || row.id}`}
                            className="classification-edit-input classification-edit-textarea"
                            value={draft.observations}
                            onChange={(event) => updateEditDraft(row.id, "observations", event.target.value)}
                          />
                        ) : row.observations || "Sem observações"}
                      </td>
                      <td data-label="Sugestão da IA">
                        {isAdmin ? row.aiPrediction ? (
                          <>
                            <strong>{row.aiPrediction}</strong>
                            <span>
                              {row.aiConfidence === null
                                ? "Confiança indisponível"
                                : `${row.aiConfidence > 0.9 ? "Classificada automaticamente" : "Pendente"} · confiança estimada ${(row.aiConfidence * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
                            </span>
                          </>
                        ) : "Sem predição" : <span className="classification-locked">♙ Login necessário</span>}
                      </td>
                      <td data-label="Classificação">
                        {isAdmin ? (
                          <>
                        <select
                          className="classification-select"
                          aria-label={`Classificação do registro ${row.order || row.id}`}
                          value={otherFailureRows[row.id] ? "__other_failure__" : selectedCategory}
                          disabled={!isAdmin || (!loggedUser && !draft)}
                          onChange={(event) => {
                            if (event.target.value === "__other_failure__") {
                              setOtherFailureRows((current) => ({ ...current, [row.id]: true }));
                              return;
                            }
                            setOtherFailureRows((current) => ({ ...current, [row.id]: false }));
                            if (draft) updateEditDraft(row.id, "category", event.target.value);
                            else updateClassification(row.id, event.target.value);
                          }}
                        >
                          <option value="">Selecione uma classificação</option>
                          {classificationCategories.map((category) => (
                            <option key={category} value={category}>{category}</option>
                          ))}
                          <option value="__other_failure__">Outra falha</option>
                        </select>
                        {otherFailureRows[row.id] && (
                          <div className="classification-other-failure">
                            <input
                              aria-label={`Descreva outra falha para o registro ${row.order || row.id}`}
                              className="classification-edit-input"
                              maxLength={512}
                              value={otherFailureInputs[row.id] ?? ""}
                              onChange={(event) => setOtherFailureInputs((current) => ({
                                ...current,
                                [row.id]: event.target.value,
                              }))}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void addOtherFailure(row);
                                }
                              }}
                              placeholder="Digite o nome da falha"
                            />
                            <button
                              type="button"
                              className="button classification-edit-button"
                              disabled={!otherFailureInputs[row.id]?.trim() || Boolean(savingOtherFailureRows[row.id])}
                              onClick={() => void addOtherFailure(row)}
                            >
                              {savingOtherFailureRows[row.id] ? "Salvando..." : "Adicionar"}
                            </button>
                          </div>
                        )}
                        <div className="classification-actions">
                          {isApproved ? (
                            <span className="classification-approved-badge">Aprovado</span>
                          ) : (
                            <button
                              type="button"
                              className="button classification-approve-button"
                              disabled={!isAdmin || Boolean(draft) || Boolean(savingClassificationIds[row.id])}
                              onClick={() => void approveRow(row)}
                              title={isAdmin ? "Aprovar esta classificação" : "Acesso restrito para visitantes"}
                            >
                              {savingClassificationIds[row.id] ? "Salvando..." : "Aprovar"}
                            </button>
                          )}
                          {draft ? (
                            <>
                              <button
                                type="button"
                                className="button classification-edit-button"
                                onClick={() => void saveEditing(row.id)}
                              >
                                Salvar
                              </button>
                              <button
                                type="button"
                                className="classification-cancel-button"
                                onClick={() => cancelEditing(row.id)}
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="button classification-edit-button"
                              disabled={!isAdmin}
                              onClick={() => startEditing(row)}
                              title={isAdmin ? "Editar este registro" : "Acesso restrito para visitantes"}
                            >
                              Editar
                            </button>
                          )}
                        </div>
                          </>
                        ) : <span className="classification-locked">♙ Login necessário</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}