import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  CAMPUSES, CURRICULA, CURRICULA_BY_CAMPUS, DURATION_OPTIONS, GRADES, IMPROVEMENT_OPTIONS,
  MAX_IMPROVEMENTS, TEACHER_QUESTIONS, type RatingSection, type Teacher,
} from './config/survey'
import { ui, type Lang } from './i18n'
import {
  Brand, ChoiceCard, Chip, ErrorBanner, Icon, LangContext, LanguageButton, PageIntro,
  RatingScale, SurveyButton, TextField, useT,
} from './components'
import {
  RATING_SECTIONS, clearDraft, emptyAnswers, loadDraft, loadLang, saveDraft, saveLang,
  submit, teacherKey, teachersFor, type Answers, type Rating, type SubmitResult,
} from './state'

// Ecrãs: 0 boas-vindas · 1 identificação · 2–4 secções de escala · 5 professores
//        6 melhorias · 7 final · 8 agradecimento
const TOTAL_SECTIONS = 7
const THANKS = 8

type Patch = (fn: (a: Answers) => Answers) => void

// ---------------------------------------------------------------------
// Validação: devolve os ids dos elementos em falta (para destacar e fazer scroll)
// ---------------------------------------------------------------------
function missingFor(screen: number, a: Answers): string[] {
  const miss: string[] = []
  if (screen === 1) {
    if (!a.campus) miss.push('f-campus')
    if (!a.curriculum) miss.push('f-curriculum')
    if (!a.grade) miss.push('f-grade')
    if (a.duration === undefined) miss.push('f-duration')
  }
  if (screen >= 2 && screen <= 4) {
    const s = RATING_SECTIONS[screen - 2]
    for (const q of s.questions) {
      if (q.required && q.type === 'scale' && a.ratings[`${s.id}.${q.id}`] === undefined) miss.push(`q-${s.id}.${q.id}`)
    }
  }
  if (screen === 5) {
    for (const t of teachersFor(a)) {
      const ans = a.teachers[teacherKey(t)]
      for (const q of TEACHER_QUESTIONS) {
        if (q.required && ans?.ratings[q.id] === undefined) miss.push(`t-${teacherKey(t)}-${q.id}`)
      }
    }
  }
  return miss
}

export default function App() {
  const [lang, setLangState] = useState<Lang>(loadLang)
  const [answers, setAnswers] = useState<Answers>(emptyAnswers)
  const [screen, setScreen] = useState(0)
  const [draft] = useState(loadDraft)
  const [missing, setMissing] = useState<string[]>([])
  const [attempt, setAttempt] = useState(0)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(false)
  const [result, setResult] = useState<SubmitResult>('ok')

  const setLang = (l: Lang) => {
    setLangState(l)
    saveLang(l)
  }

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  // Guarda o rascunho a cada alteração
  useEffect(() => {
    if (screen > 0 && screen < THANKS) saveDraft(answers, screen)
  }, [answers, screen])

  // Quando o utilizador corrige uma resposta, retira-a da lista de erros
  useEffect(() => {
    if (missing.length) setMissing((m) => m.filter((id) => missingFor(screen, answers).includes(id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers])

  const patch: Patch = (fn) => setAnswers((a) => fn(a))

  const go = (next: number) => {
    setMissing([])
    setSendError(false)
    setScreen(next)
    window.scrollTo({ top: 0 })
  }

  const tryNext = async () => {
    const miss = missingFor(screen, answers)
    if (miss.length) {
      setMissing(miss)
      setAttempt((n) => n + 1)
      requestAnimationFrame(() => {
        document.getElementById(miss[0])?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
      return
    }
    if (screen === 7) {
      setSending(true)
      setSendError(false)
      try {
        const r = await submit(answers, lang)
        setResult(r)
        clearDraft()
        go(THANKS)
      } catch (e) {
        console.error(e)
        setSendError(true)
      } finally {
        setSending(false)
      }
      return
    }
    go(screen + 1)
  }

  const startNew = () => {
    clearDraft()
    setAnswers(emptyAnswers())
    go(1)
  }

  const resume = () => {
    if (!draft) return
    setAnswers(draft.answers)
    go(Math.min(Math.max(draft.screen, 1), 7))
  }

  /** Mantém recinto/currículo/classe ao responder por outro educando? Não: começa limpo. */
  const another = () => startNew()

  let content: ReactNode
  if (screen === 0) content = <Welcome hasDraft={!!draft} onStart={startNew} onResume={resume} />
  else if (screen === THANKS) content = <ThankYou result={result} onAnother={another} />
  else {
    const ctx = { answers, patch, missing, attempt }
    content = (
      <PageShell section={screen} onHome={() => go(0)}>
        {screen === 1 && <Identification {...ctx} />}
        {screen >= 2 && screen <= 4 && <RatingPage section={RATING_SECTIONS[screen - 2]} {...ctx} />}
        {screen === 5 && <Teachers {...ctx} />}
        {screen === 6 && <Improvements {...ctx} />}
        {screen === 7 && <FinalComments {...ctx} />}
        <Actions
          onBack={() => go(screen - 1)}
          onNext={tryNext}
          last={screen === 7}
          sending={sending}
          error={missing.length > 0 ? 'required' : sendError ? 'send' : undefined}
        />
      </PageShell>
    )
  }

  return <LangContext.Provider value={{ lang, setLang }}>{content}</LangContext.Provider>
}

type Ctx = { answers: Answers; patch: Patch; missing: string[]; attempt: number }

// ---------------------------------------------------------------------
// Estrutura comum
// ---------------------------------------------------------------------
function PageShell({ section, onHome, children }: { section: number; onHome: () => void; children: ReactNode }) {
  const t = useT()
  return (
    <div className="survey-app">
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={TOTAL_SECTIONS} aria-valuenow={section}>
        <div className="progress-value" style={{ width: `${(section / TOTAL_SECTIONS) * 100}%` }} />
      </div>
      <header className="app-header">
        <button className="logo-button" onClick={onHome} aria-label={t(ui.home)}>
          <Brand compact />
        </button>
        <span className="section-count">{t(ui.section)} {section} {t(ui.of)} {TOTAL_SECTIONS}</span>
        <LanguageButton />
      </header>
      <main className="page-container">{children}</main>
    </div>
  )
}

function Actions({
  onBack, onNext, last, sending, error,
}: { onBack: () => void; onNext: () => void; last: boolean; sending: boolean; error?: 'required' | 'send' }) {
  const t = useT()
  return (
    <>
      {error === 'send' && <ErrorBanner message={t(ui.errSend)} />}
      <div className="page-actions">
        {error === 'required' && <p className="actions-error"><Icon name="alert" size={16} /> {t(ui.errRequired)}</p>}
        <SurveyButton variant="secondary" icon="back" onClick={onBack}>{t(ui.back)}</SurveyButton>
        <SurveyButton icon={last ? 'send' : 'arrow'} onClick={onNext} disabled={sending}>
          {sending ? t(ui.sending) : last ? (error === 'send' ? t(ui.retry) : t(ui.send)) : t(ui.next)}
        </SurveyButton>
      </div>
    </>
  )
}

function ContextTag({ answers }: { answers: Answers }) {
  const campus = CAMPUSES.find((c) => c.id === answers.campus)?.name
  const t = useT()
  const curriculum = CURRICULA.find((c) => c.id === answers.curriculum)
  if (!campus || !curriculum) return null
  return (
    <div className="context-tag">
      <Icon name="location" size={16} />
      {campus} <b>·</b> {t(curriculum.name).replace(/^Currículo |Curriculum$/g, '').trim()} <b>·</b> {answers.grade}
    </div>
  )
}

// ---------------------------------------------------------------------
// 0 · Boas-vindas
// ---------------------------------------------------------------------
function Welcome({ hasDraft, onStart, onResume }: { hasDraft: boolean; onStart: () => void; onResume: () => void }) {
  const t = useT()
  return (
    <div className="welcome-page">
      <div className="welcome-top"><LanguageButton /></div>
      <div className="welcome-card">
        <Brand />
        <PageIntro eyebrow={t(ui.welcomeEyebrow)} title={t(ui.welcomeTitle)} subtitle={t(ui.welcomeText)} />
        <div className="privacy-badge">
          <Icon name="lock" size={18} />
          <span>
            <strong>{t(ui.anonTitle)}</strong>
            <small>{t(ui.anonText)}</small>
          </span>
        </div>
        <p className="welcome-hint"><Icon name="users" size={16} /> {t(ui.oneEach)}</p>
        {hasDraft ? (
          <div className="welcome-buttons">
            <SurveyButton icon="arrow" onClick={onResume}>{t(ui.resume)}</SurveyButton>
            <SurveyButton variant="secondary" onClick={onStart}>{t(ui.restart)}</SurveyButton>
          </div>
        ) : (
          <SurveyButton icon="arrow" onClick={onStart}>{t(ui.start)}</SurveyButton>
        )}
        <p className="welcome-note"><Icon name="clock" size={16} /> {t(ui.minutes)}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// 1 · Identificação
// ---------------------------------------------------------------------
function FieldGroup({ id, title, missing, children }: { id: string; title: string; missing: string[]; children: ReactNode }) {
  const t = useT()
  const err = missing.includes(id)
  return (
    <section className={`form-section ${err ? 'has-error' : ''}`} id={id}>
      <h2>{title}</h2>
      {children}
      {err && <p className="field-error"><Icon name="alert" size={15} /> {t(ui.errChoose)}</p>}
    </section>
  )
}

function Identification({ answers, patch, missing }: Ctx) {
  const t = useT()
  const curricula = answers.campus ? CURRICULA_BY_CAMPUS[answers.campus] : CURRICULA.map((c) => c.id)
  const grades = answers.curriculum ? GRADES[answers.curriculum] : []
  return (
    <>
      <PageIntro eyebrow={t(ui.idEyebrow)} title={t(ui.idTitle)} subtitle={t(ui.idSubtitle)} />
      <FieldGroup id="f-campus" title={t(ui.qCampus)} missing={missing}>
        <div className="choice-grid">
          {CAMPUSES.map((c) => (
            <ChoiceCard
              key={c.id}
              title={c.name}
              detail={t(c.detail)}
              icon="location"
              selected={answers.campus === c.id}
              onClick={() => patch((a) => {
                const keep = a.curriculum && CURRICULA_BY_CAMPUS[c.id].includes(a.curriculum)
                return { ...a, campus: c.id, curriculum: keep ? a.curriculum : undefined, grade: keep ? a.grade : undefined, teachers: {} }
              })}
            />
          ))}
        </div>
      </FieldGroup>
      <FieldGroup id="f-curriculum" title={t(ui.qCurriculum)} missing={missing}>
        <div className="choice-grid">
          {CURRICULA.filter((c) => curricula.includes(c.id)).map((c) => (
            <ChoiceCard
              key={c.id}
              title={t(c.name)}
              detail={t(c.detail)}
              icon={c.id === 'nacional' ? 'school' : 'book'}
              selected={answers.curriculum === c.id}
              onClick={() => patch((a) => (a.curriculum === c.id ? a : { ...a, curriculum: c.id, grade: undefined, teachers: {} }))}
            />
          ))}
        </div>
      </FieldGroup>
      {answers.curriculum && (
        <FieldGroup id="f-grade" title={t(ui.qGrade)} missing={missing}>
          <div className="chip-list">
            {grades.map((g) => (
              <Chip key={g} selected={answers.grade === g} onClick={() => patch((a) => (a.grade === g ? a : { ...a, grade: g, teachers: {} }))}>
                {g}
              </Chip>
            ))}
          </div>
        </FieldGroup>
      )}
      <FieldGroup id="f-duration" title={t(ui.qDuration)} missing={missing}>
        <div className="chip-list wide">
          {DURATION_OPTIONS.map((d, i) => (
            <Chip key={d.pt} selected={answers.duration === i} onClick={() => patch((a) => ({ ...a, duration: i }))}>{t(d)}</Chip>
          ))}
        </div>
      </FieldGroup>
    </>
  )
}

// ---------------------------------------------------------------------
// 2–4 · Secções com escala (Organização, Direção, Administração)
// ---------------------------------------------------------------------
function RatingPage({ section, answers, patch, missing }: Ctx & { section: RatingSection }) {
  const t = useT()
  const setRating = (key: string, v: Rating) => patch((a) => ({ ...a, ratings: { ...a.ratings, [key]: v } }))
  const setText = (key: string, v: string) => patch((a) => ({ ...a, texts: { ...a.texts, [key]: v } }))
  return (
    <>
      <ContextTag answers={answers} />
      <PageIntro eyebrow={t(section.eyebrow)} title={t(section.title)} subtitle={t(section.subtitle)} />
      <div className="question-list">
        {section.questions.map((q) => {
          const key = `${section.id}.${q.id}`
          if (q.type === 'text') {
            return (
              <TextField key={key} standalone label={t(q.text)} value={answers.texts[key] ?? ''} onChange={(v) => setText(key, v)} rows={3} />
            )
          }
          const value = answers.ratings[key]
          const err = missing.includes(`q-${key}`)
          return (
            <article key={key} id={`q-${key}`} className={`question-card ${value !== undefined ? 'answered' : ''} ${err ? 'has-error' : ''}`}>
              <div className="question-top">
                <h2>{t(q.text)}</h2>
                {value !== undefined && <span className="answered-badge"><Icon name="check" size={14} />{t(ui.answered)}</span>}
              </div>
              <RatingScale label={t(q.text)} value={value} onChange={(v) => setRating(key, v)} />
            </article>
          )
        })}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------
// 5 · Professores
// ---------------------------------------------------------------------
function teacherComplete(a: Answers, tc: Teacher) {
  const ans = a.teachers[teacherKey(tc)]
  return TEACHER_QUESTIONS.every((q) => !q.required || ans?.ratings[q.id] !== undefined)
}

function Teachers({ answers, patch, missing, attempt }: Ctx) {
  const t = useT()
  const list = useMemo(() => teachersFor(answers), [answers.campus, answers.curriculum, answers.grade]) // eslint-disable-line react-hooks/exhaustive-deps
  const firstIncomplete = list.findIndex((tc) => !teacherComplete(answers, tc))
  const [open, setOpen] = useState<number>(firstIncomplete === -1 ? -1 : firstIncomplete)

  // Ao validar, abre o primeiro professor com respostas em falta
  useEffect(() => {
    if (!attempt || !missing.length) return
    const idx = list.findIndex((tc) => missing.some((m) => m.startsWith(`t-${teacherKey(tc)}-`)))
    if (idx !== -1) setOpen(idx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  const update = (tc: Teacher, fn: (r: { ratings: Record<string, Rating>; comment: string }) => { ratings: Record<string, Rating>; comment: string }) =>
    patch((a) => {
      const k = teacherKey(tc)
      const cur = a.teachers[k] ?? { ratings: {}, comment: '' }
      const nextAns = fn(cur)
      const next = { ...a, teachers: { ...a.teachers, [k]: nextAns } }
      return next
    })

  return (
    <>
      <PageIntro eyebrow={t(ui.tEyebrow)} title={t(ui.tTitle)} subtitle={t(ui.tSubtitle)} />
      <ContextTag answers={answers} />
      {list.length === 0 && <div className="empty-note"><Icon name="users" /> {t(ui.tNone)}</div>}
      <div className="teacher-list">
        {list.map((tc, i) => {
          const k = teacherKey(tc)
          const ans = answers.teachers[k]
          const done = teacherComplete(answers, tc)
          const isOpen = open === i
          const answeredCount = TEACHER_QUESTIONS.filter((q) => ans?.ratings[q.id] !== undefined).length
          const hasErr = missing.some((m) => m.startsWith(`t-${k}-`))
          const initials = tc.name.split(/\s+/).filter((w) => /^[A-Za-zÀ-ÿ]/.test(w)).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
          return (
            <article key={k} className={`teacher-card ${isOpen ? 'open' : done ? 'done' : 'closed'} ${hasErr ? 'has-error' : ''}`} style={{ ['--avatar' as string]: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
              <button type="button" className="teacher-summary" onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen}>
                <span className="avatar">{initials}</span>
                <span className="teacher-copy">
                  <strong>{tc.name}</strong>
                  <span className="teacher-meta">
                    <small>{t(tc.subject)}</small>
                    {!done && <em>{answeredCount}/{TEACHER_QUESTIONS.length} {t(ui.tProgress)}</em>}
                  </span>
                </span>
                {done && !isOpen ? (
                  <span className="done-icon"><Icon name="check" /></span>
                ) : (
                  <span className="expand-icon"><Icon name="chevron" /></span>
                )}
              </button>
              {isOpen && (
                <div className="teacher-body">
                  <div className="teacher-questions">
                    {TEACHER_QUESTIONS.map((q) => {
                      const errQ = missing.includes(`t-${k}-${q.id}`)
                      return (
                        <div className={`teacher-question ${errQ ? 'has-error' : ''}`} key={q.id} id={`t-${k}-${q.id}`}>
                          <p>{t(q.text)}</p>
                          <RatingScale
                            compact
                            label={t(q.text)}
                            value={ans?.ratings[q.id]}
                            onChange={(v) => update(tc, (r) => ({ ...r, ratings: { ...r.ratings, [q.id]: v } }))}
                          />
                        </div>
                      )
                    })}
                  </div>
                  <TextField
                    label={t(ui.tComment)}
                    optional
                    rows={3}
                    value={ans?.comment ?? ''}
                    onChange={(v) => update(tc, (r) => ({ ...r, comment: v }))}
                  />
                  {i < list.length - 1 && (
                    <button type="button" className="next-teacher" onClick={() => setOpen(i + 1)}>
                      {list[i + 1].name} <Icon name="arrow" size={16} />
                    </button>
                  )}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </>
  )
}

const AVATAR_COLORS = ['#1c3a63', '#526a8b', '#7a5776', '#2f6b5e', '#8a5a2b', '#3d4f9a']

// ---------------------------------------------------------------------
// 6 · Melhorias
// ---------------------------------------------------------------------
function Improvements({ answers, patch }: Ctx) {
  const t = useT()
  const sel = answers.improvements
  const toggle = (id: string) =>
    patch((a) => {
      if (a.improvements.includes(id)) return { ...a, improvements: a.improvements.filter((x) => x !== id), improvementOther: id === 'outro' ? '' : a.improvementOther }
      if (a.improvements.length >= MAX_IMPROVEMENTS) return a
      return { ...a, improvements: [...a.improvements, id] }
    })
  return (
    <>
      <PageIntro eyebrow={t(ui.impEyebrow)} title={t(ui.impTitle)} subtitle={t(ui.impSubtitle)} />
      <div className="selection-counter">
        <span>{sel.length} {t(ui.of)} {MAX_IMPROVEMENTS} {t(ui.selected)}</span>
        <div><i style={{ width: `${(sel.length / MAX_IMPROVEMENTS) * 100}%` }} /></div>
      </div>
      <div className="chip-list topic-chips">
        {IMPROVEMENT_OPTIONS.map((o) => {
          const on = sel.includes(o.id)
          return (
            <Chip key={o.id} selected={on} disabled={!on && sel.length >= MAX_IMPROVEMENTS} onClick={() => toggle(o.id)}>
              {on && <Icon name="check" size={15} />}
              {t(o.text)}
            </Chip>
          )
        })}
      </div>
      {sel.includes('outro') && (
        <div className="other-field">
          <TextField input="text" label={t(ui.qOther)} value={answers.improvementOther} onChange={(v) => patch((a) => ({ ...a, improvementOther: v }))} />
        </div>
      )}
      <div className="text-fields">
        <TextField label={t(ui.qLike)} optional placeholder={t(ui.qLikePh)} rows={4} value={answers.like} onChange={(v) => patch((a) => ({ ...a, like: v }))} />
        <TextField label={t(ui.qImprove)} optional placeholder={t(ui.qImprovePh)} rows={4} value={answers.improve} onChange={(v) => patch((a) => ({ ...a, improve: v }))} />
      </div>
    </>
  )
}

// ---------------------------------------------------------------------
// 7 · Comentários finais
// ---------------------------------------------------------------------
function FinalComments({ answers, patch }: Ctx) {
  const t = useT()
  const c = answers.contact
  const setContact = (p: Partial<Answers['contact']>) => patch((a) => ({ ...a, contact: { ...a.contact, ...p } }))
  return (
    <>
      <PageIntro eyebrow={t(ui.finEyebrow)} title={t(ui.finTitle)} subtitle={t(ui.finSubtitle)} />
      <article className="nps-card">
        <h2>{t(ui.qNps)}</h2>
        <div className="nps-scale" role="radiogroup" aria-label={t(ui.qNps)}>
          {Array.from({ length: 11 }, (_, n) => (
            <button key={n} type="button" role="radio" aria-checked={answers.nps === n} className={answers.nps === n ? 'selected' : ''} onClick={() => patch((a) => ({ ...a, nps: n }))}>
              {n}
            </button>
          ))}
        </div>
        <div className="scale-labels">
          <span>0 · {t(ui.npsLow)}</span>
          <span>10 · {t(ui.npsHigh)}</span>
        </div>
      </article>
      <TextField standalone label={t(ui.qComments)} optional placeholder={t(ui.qCommentsPh)} rows={5} value={answers.comments} onChange={(v) => patch((a) => ({ ...a, comments: v }))} />
      <article className={`contact-card ${c.wants ? 'open' : ''}`}>
        <button type="button" className="contact-toggle" onClick={() => setContact({ wants: !c.wants })} aria-expanded={c.wants}>
          <span className="contact-icon"><Icon name="phone" /></span>
          <span>
            <strong>{t(ui.contactTitle)}</strong>
            <small>{t(ui.optional).replace(/[()]/g, '')}</small>
          </span>
          <Icon name="chevron" />
        </button>
        {c.wants && (
          <div className="contact-fields">
            <div className="privacy-warning">
              <Icon name="lock" size={18} />
              <span><strong>{t(ui.contactWarnTitle)}</strong>{t(ui.contactWarn)}</span>
            </div>
            <TextField input="text" label={t(ui.name)} placeholder={t(ui.namePh)} value={c.name} onChange={(v) => setContact({ name: v })} />
            <TextField input="tel" label={t(ui.phone)} placeholder="+258 84 000 0000" value={c.phone} onChange={(v) => setContact({ phone: v })} />
            <div className="span-2">
              <TextField input="text" label={t(ui.subject)} placeholder={t(ui.subjectPh)} value={c.subject} onChange={(v) => setContact({ subject: v })} />
            </div>
          </div>
        )}
      </article>
    </>
  )
}

// ---------------------------------------------------------------------
// 8 · Agradecimento
// ---------------------------------------------------------------------
function ThankYou({ result, onAnother }: { result: SubmitResult; onAnother: () => void }) {
  const t = useT()
  return (
    <div className="thanks-page">
      <div className="thanks-header">
        <Brand compact />
        <LanguageButton />
      </div>
      <main className="thanks-card">
        <div className="success-illustration">
          <span className="success-ring"><Icon name="check" size={56} /></span>
          <span className="confetti c1" /><span className="confetti c2" /><span className="confetti c3" /><span className="confetti c4" />
        </div>
        <PageIntro title={t(ui.thanksTitle)} subtitle={result === 'demo' ? undefined : t(ui.thanksText)} />
        {result === 'demo' && <p className="demo-note"><Icon name="alert" size={16} /> {t(ui.demo)}</p>}
        <div className="impact-note">
          <Icon name="spark" />
          <p><strong>{t(ui.impactTitle)}</strong><br />{t(ui.impactText)}</p>
        </div>
        <SurveyButton variant="secondary" icon="user" onClick={onAnother}>{t(ui.another)}</SurveyButton>
      </main>
      <p className="footer-note">{t(ui.footer)}</p>
    </div>
  )
}
