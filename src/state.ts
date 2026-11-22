import {
  ADMINISTRACAO, CAMPUSES, CHOICE_OPTIONS, DIRECAO, DURATION_OPTIONS, EDUCACAO_CRISTA, EDICAO, ENDPOINT_URL, GRADES,
  IMPROVEMENT_OPTIONS, ORGANIZACAO, PROGRAMS, TEACHERS, TEACHER_QUESTIONS,
  type CurriculumId, type ProgramId, type Question, type RatingSection, type Teacher,
} from './config/survey'
import type { Lang } from './i18n'

/** Valor de uma pergunta de escala: 1–5 ou 'NS' (Não sei / Não se aplica). */
export type Rating = number | 'NS'

export type TeacherAnswer = { ratings: Record<string, Rating>; comment: string }

export type Answers = {
  /** id da classe (GRADES) */
  grade?: string
  /** currículo que o educando segue (PROGRAMS); só nas classes com escolha */
  program?: ProgramId
  duration?: number
  /** chave: `${secção}.${pergunta}` */
  ratings: Record<string, Rating>
  /** perguntas 'choice' — chave: `${secção}.${pergunta}`, valor: id de CHOICE_OPTIONS */
  choices: Record<string, string>
  /** chave: `${secção}.${pergunta}` */
  texts: Record<string, string>
  teachers: Record<string, TeacherAnswer>
  improvements: string[]
  improvementOther: string
  like: string
  improve: string
  nps?: number
  comments: string
  contact: { wants: boolean; name: string; phone: string; subject: string }
}

export const emptyAnswers = (): Answers => ({
  ratings: {}, choices: {}, texts: {}, teachers: {}, improvements: [], improvementOther: '',
  like: '', improve: '', comments: '', contact: { wants: false, name: '', phone: '', subject: '' },
})

/** Todas as secções de perguntas, pela ordem das colunas na folha. */
export const RATING_SECTIONS: RatingSection[] = [ORGANIZACAO, DIRECAO, ADMINISTRACAO, EDUCACAO_CRISTA]

/** Resposta à pergunta de entrada da secção (id da opção), se houver. */
export const gateOf = (s: RatingSection, a: Answers) => (s.gate ? a.choices[`${s.id}.${s.gate.id}`] : undefined)

/** Perguntas que o encarregado vê, conforme a resposta à pergunta de entrada.
 *  Sem resposta à entrada: nenhuma. Entrada fechada: só as "forAll", todas opcionais. */
export function visibleQuestions(s: RatingSection, a: Answers): { q: Question; required: boolean }[] {
  const all = s.questions.map((q) => ({ q, required: !!q.required }))
  if (!s.gate) return all
  const g = gateOf(s, a)
  if (g === undefined) return []
  if (g === s.gate.open) return all
  return all.filter(({ q }) => q.forAll).map(({ q }) => ({ q, required: false }))
}

export const teacherKey = (t: Teacher) => `${t.name}|${t.subject.pt}`

export const gradeOf = (a: Answers) => GRADES.find((g) => g.id === a.grade)
export const campusOf = (a: Answers) => CAMPUSES.find((c) => c.id === gradeOf(a)?.campus)
/** Currículo escolhido, só se for válido para a classe. */
export const programOf = (a: Answers) => {
  const g = gradeOf(a)
  return g?.programs.includes(a.program!) ? PROGRAMS.find((p) => p.id === a.program) : undefined
}
/** A classe pede a escolha do currículo? */
export const needsProgram = (a: Answers) => (gradeOf(a)?.programs.length ?? 0) > 1

/** Só os professores que dão aulas ao educando (classe + currículo). */
export function teachersFor(a: Answers): Teacher[] {
  const g = gradeOf(a)
  if (!g) return []
  let curricula: CurriculumId[] = ['nacional', 'cambridge']
  if (g.programs.length) {
    const p = PROGRAMS.find((x) => x.id === (g.programs.length === 1 ? g.programs[0] : a.program))
    if (!p) return []
    curricula = p.curricula
  }
  return TEACHERS.filter((t) => t.grades.includes(g.id) && t.curricula.some((c) => curricula.includes(c)))
}

// ---------------------------------------------------------------------
// Rascunho guardado no telemóvel (para quem é interrompido a meio)
// ---------------------------------------------------------------------
const DRAFT_KEY = `dzovo-inquerito-${EDICAO}-v2`
const LANG_KEY = 'dzovo-inquerito-lang'

export type Draft = { answers: Answers; screen: number; savedAt: number }

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as Draft
    // rascunhos com mais de 7 dias são ignorados
    if (Date.now() - d.savedAt > 7 * 24 * 3600 * 1000) return null
    // rascunhos de antes de haver campos novos (ex.: choices) recebem os valores vazios
    return { ...d, answers: { ...emptyAnswers(), ...d.answers } }
  } catch {
    return null
  }
}

export function saveDraft(answers: Answers, screen: number) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers, screen, savedAt: Date.now() }))
  } catch { /* armazenamento indisponível: continua sem rascunho */ }
}

export function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
}

export function loadLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY)
    if (v === 'pt' || v === 'en') return v
  } catch { /* ignore */ }
  return 'pt'
}

export function saveLang(lang: Lang) {
  try { localStorage.setItem(LANG_KEY, lang) } catch { /* ignore */ }
}

// ---------------------------------------------------------------------
// Envio para a Google Sheet
// ---------------------------------------------------------------------

function uid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Constrói o registo no formato das colunas da folha (sempre em português). */
export function buildPayload(a: Answers, lang: Lang) {
  const id = uid()
  const campus = campusOf(a)?.name ?? ''
  const grade = gradeOf(a)
  const g = grade?.programs.length === 1 ? { ...a, program: grade.programs[0] } : a
  const curriculum = programOf(g)?.name.pt ?? ''
  const classe = grade?.name.pt ?? ''

  const resposta: Record<string, string | number> = {
    id_resposta: id,
    edicao: EDICAO,
    idioma: lang.toUpperCase(),
    recinto: campus,
    curriculo: curriculum,
    classe,
    tempo_na_escola: a.duration !== undefined ? DURATION_OPTIONS[a.duration].pt : '',
  }

  for (const s of RATING_SECTIONS) {
    if (s.gate) resposta[`${s.id}_${s.gate.id}`] = s.gate.options.find((o) => o.id === gateOf(s, a))?.text.pt ?? ''
    // perguntas escondidas vão vazias (ex.: respondeu "Sim" e depois mudou para "Não")
    const visible = new Set(visibleQuestions(s, a).map(({ q }) => q.id))
    for (const q of s.questions) {
      const key = `${s.id}.${q.id}`
      const col = `${s.id}_${q.id}`
      if (!visible.has(q.id)) { resposta[col] = ''; continue }
      if (q.type === 'scale') resposta[col] = a.ratings[key] ?? ''
      else if (q.type === 'choice') resposta[col] = CHOICE_OPTIONS.find((o) => o.id === a.choices[key])?.text.pt ?? ''
      else resposta[col] = (a.texts[key] ?? '').trim()
    }
  }

  resposta.melhorias_prioritarias = a.improvements
    .map((id) => IMPROVEMENT_OPTIONS.find((o) => o.id === id)?.text.pt ?? id)
    .join('; ')
  resposta.melhoria_outro = a.improvementOther.trim()
  resposta.o_que_mais_gosta = a.like.trim()
  resposta.como_melhorar = a.improve.trim()
  resposta.recomendacao_0_10 = a.nps ?? ''
  resposta.comentarios_gerais = a.comments.trim()
  resposta.quer_contacto = a.contact.wants ? 'Sim' : 'Não'
  resposta.contacto_nome = a.contact.wants ? a.contact.name.trim() : ''
  resposta.contacto_telefone = a.contact.wants ? a.contact.phone.trim() : ''
  resposta.contacto_assunto = a.contact.wants ? a.contact.subject.trim() : ''

  const professores = teachersFor(a).map((t) => {
    const ans = a.teachers[teacherKey(t)]
    const row: Record<string, string | number> = {
      id_resposta: id,
      edicao: EDICAO,
      recinto: campus,
      curriculo: curriculum,
      classe,
      professor: t.name,
      disciplina: t.subject.pt,
    }
    for (const q of TEACHER_QUESTIONS) row[q.id] = ans?.ratings[q.id] ?? ''
    row.comentario = ans?.comment.trim() ?? ''
    return row
  })

  return { resposta, professores }
}

export type SubmitResult = 'ok' | 'demo'

export async function submit(a: Answers, lang: Lang): Promise<SubmitResult> {
  const payload = buildPayload(a, lang)
  if (!ENDPOINT_URL) {
    console.info('[Modo demonstração] Resposta que seria enviada:', payload)
    await new Promise((r) => setTimeout(r, 700))
    return 'demo'
  }
  // Corpo em texto simples evita o "preflight" CORS, que o Apps Script não suporta.
  const res = await fetch(ENDPOINT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json().catch(() => ({ ok: true }))
  if (data && data.ok === false) throw new Error(data.error || 'Erro no servidor')
  return 'ok'
}
