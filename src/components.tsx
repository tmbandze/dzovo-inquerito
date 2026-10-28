import { createContext, useContext, type ReactNode } from 'react'
import { ui, type Lang } from './i18n'
import type { Text } from './config/survey'
import type { Rating } from './state'

// ---------------------------------------------------------------------
// Idioma
// ---------------------------------------------------------------------
export const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'pt', setLang: () => {} })
export function useT() {
  const { lang } = useContext(LangContext)
  return (text: Text) => text[lang]
}

// ---------------------------------------------------------------------
// Ícones
// ---------------------------------------------------------------------
export type IconName = 'arrow' | 'back' | 'book' | 'check' | 'chevron' | 'clock' | 'location' | 'lock' | 'phone' | 'school' | 'send' | 'spark' | 'user' | 'alert' | 'users'

const PATHS: Record<IconName, ReactNode> = {
  arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  back: <><path d="M19 12H5" /><path d="m11 18-6-6 6-6" /></>,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  location: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  phone: <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></>,
  school: <><path d="m3 10 9-6 9 6" /><path d="M5 9v10h14V9" /><path d="M9 19v-6h6v6" /></>,
  send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
  spark: <><path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4Z" /><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16.5v.01" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18 14a6.5 6.5 0 0 1 3.5 6" /></>,
}

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {PATHS[name]}
    </svg>
  )
}

// ---------------------------------------------------------------------
// Marca da escola
// ---------------------------------------------------------------------
export function Brand({ compact = false }: { compact?: boolean }) {
  const t = useT()
  return (
    <div className={`brand ${compact ? 'compact' : ''}`} aria-label="Colégio Dzovo">
      <img src="./emblema.png" alt="" width={compact ? 44 : 112} />
      <span className="brand-text">
        <strong>COLÉGIO DZOVO</strong>
        {!compact && <small>{t(ui.schoolSub)} / Primary School</small>}
      </span>
    </div>
  )
}

export function LanguageButton() {
  const { lang, setLang } = useContext(LangContext)
  const t = useT()
  return (
    <button className="language-button" onClick={() => setLang(lang === 'pt' ? 'en' : 'pt')} aria-label={t(ui.language)}>
      <span className={lang === 'pt' ? 'active' : ''}>PT</span>
      <i />
      <span className={lang === 'en' ? 'active' : ''}>EN</span>
    </button>
  )
}

// ---------------------------------------------------------------------
// Estrutura de página
// ---------------------------------------------------------------------
export function PageIntro({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <div className="page-intro">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  )
}

export function SurveyButton({
  children, variant = 'primary', icon, onClick, disabled = false,
}: { children: ReactNode; variant?: 'primary' | 'secondary'; icon?: IconName; onClick?: () => void; disabled?: boolean }) {
  return (
    <button className={`survey-button ${variant}`} onClick={onClick} disabled={disabled} type="button">
      {variant === 'secondary' && icon && <Icon name={icon} />}
      <span>{children}</span>
      {variant === 'primary' && icon && <Icon name={icon} />}
    </button>
  )
}

export function ChoiceCard({
  title, detail, icon, selected, onClick,
}: { title: string; detail?: string; icon: IconName; selected?: boolean; onClick?: () => void }) {
  return (
    <button className={`choice-card ${selected ? 'selected' : ''}`} onClick={onClick} type="button" aria-pressed={!!selected}>
      <span className="choice-icon"><Icon name={icon} /></span>
      <span className="choice-copy">
        <strong>{title}</strong>
        {detail && <small>{detail}</small>}
      </span>
      <span className="radio-mark">{selected && <span />}</span>
    </button>
  )
}

export function Chip({ children, selected, onClick, disabled }: { children: ReactNode; selected?: boolean; onClick?: () => void; disabled?: boolean }) {
  return (
    <button className={`chip ${selected ? 'selected' : ''}`} onClick={onClick} type="button" aria-pressed={!!selected} disabled={disabled}>
      {children}
    </button>
  )
}

export function RatingScale({
  value, onChange, compact = false, label,
}: { value?: Rating; onChange: (v: Rating) => void; compact?: boolean; label: string }) {
  const t = useT()
  return (
    <div className={`rating-wrap ${compact ? 'compact' : ''}`}>
      <div className="rating-scale" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            className={value === n ? 'selected' : ''}
            onClick={() => onChange(n)}
            aria-label={`${n} ${t(ui.ofScale)}`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="scale-labels">
        <span>1 · {t(ui.veryUnsat)}</span>
        <span>5 · {t(ui.verySat)}</span>
      </div>
      <button type="button" className={`na-option ${value === 'NS' ? 'active' : ''}`} onClick={() => onChange('NS')} aria-pressed={value === 'NS'}>
        <span className="mini-check">{value === 'NS' && <Icon name="check" size={13} />}</span>
        {t(ui.dontKnow)}
      </button>
    </div>
  )
}

export function TextField({
  label, value, onChange, placeholder, rows = 4, optional = false, standalone = false, input,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
  optional?: boolean; standalone?: boolean; input?: 'text' | 'tel'
}) {
  const t = useT()
  return (
    <label className={`text-field ${standalone ? 'standalone' : ''}`}>
      <span>{label} {optional && <em>{t(ui.optional)}</em>}</span>
      {input ? (
        <input type={input} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={200} />
      ) : (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? t(ui.writeHere)} rows={rows} maxLength={2000} />
      )}
    </label>
  )
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="error-banner" role="alert">
      <Icon name="alert" size={18} />
      <span>{message}</span>
    </div>
  )
}
