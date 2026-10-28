import {
  ADMINISTRACAO, CAMPUSES, CURRICULA, DIRECAO, DURATION_OPTIONS, EDICAO, ENDPOINT_URL,
  IMPROVEMENT_OPTIONS, ORGANIZACAO, TEACHERS, TEACHER_QUESTIONS,
  type CampusId, type CurriculumId, type RatingSection, type Teacher,
} from './config/survey'
import type { Lang } from './i18n'

/** Valor de uma pergunta de escala: 1–5 ou 'NS' (Não sei / Não se aplica). */
export type Rating = number | 'NS'

export type TeacherAnswer = { ratings: Record<string, Rating>; comment: string }

export type Answers = {
  campus?: CampusId
  curriculum?: CurriculumId
  grade?: string
  duration?: number
  /** chave: `${secção}.${pergunta}` */
  ratings: Record<string, Rating>
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
  ratings: {}, texts: {}, teachers: {}, improvements: [], improvementOther: '',
  like: '', improve: '', comments: '', contact: { wants: false, name: '', phone: '', subject: '' },
})

export const RATING_SECTIONS: RatingSection[] = [ORGANIZACAO, DIRECAO, ADMINISTRACAO]

export const teacherKey = (t: Teacher) => `${t.campus}|${t.curriculum}|${t.name}|${t.subject.pt}`

export function teachersFor(a: Answers): Teacher[] {
  if (!a.campus || !a.curriculum || !a.grade) return []
  return TEACHERS.filter((t) => t.campus === a.campus && t.curriculum === a.curriculum && t.grades.includes(a.grade!))
}

// ---------------------------------------------------------------------
// Rascunho guardado no telemóvel (para quem é interrompido a meio)
// ---------------------------------------------------------------------
const DRAFT_KEY = `dzovo-inquerito-${EDICAO}`
const LANG_KEY = 'dzovo-inquerito-lang'

export type Draft = { answers: Answers; screen: number; savedAt: number }

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as Draft
    // rascunhos com mais de 7 dias são ignorados
    if (Date.now() - d.savedAt > 7 * 24 * 3600 * 1000) return null
    return d
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
  const campus = CAMPUSES.find((c) => c.id === a.campus)?.name ?? ''
  const curriculum = CURRICULA.find((c) => c.id === a.curriculum)?.name.pt ?? ''

  const resposta: Record<string, string | number> = {
    id_resposta: id,
    edicao: EDICAO,
    idioma: lang.toUpperCase(),
    recinto: campus,
    curriculo: curriculum,
    classe: a.grade ?? '',
    tempo_na_escola: a.duration !== undefined ? DURATION_OPTIONS[a.duration].pt : '',
  }

  for (const s of RATING_SECTIONS) {
    for (const q of s.questions) {
      const key = `${s.id}.${q.id}`
      resposta[`${s.id}_${q.id}`] = q.type === 'scale' ? (a.ratings[key] ?? '') : (a.texts[key] ?? '').trim()
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
      classe: a.grade ?? '',
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
