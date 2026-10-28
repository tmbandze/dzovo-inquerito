/* =====================================================================
   CONFIGURAÇÃO DO INQUÉRITO — COLÉGIO DZOVO
   ---------------------------------------------------------------------
   Este é o ÚNICO ficheiro que precisa de ser editado para:
     • mudar, acrescentar ou retirar perguntas (depois da decisão do Conselho)
     • atualizar recintos, classes e a lista de professores
     • ligar o inquérito à Google Sheet (ENDPOINT_URL)
   Cada texto tem versão em português (pt) e inglês (en).
   Os "id" são os nomes das colunas na Google Sheet: não usar espaços nem
   acentos, e não mudar o id de uma pergunta depois de o inquérito abrir.
   ===================================================================== */

export type Text = { pt: string; en: string }

/** URL da aplicação web do Google Apps Script (ver README).
 *  Enquanto estiver vazio, o inquérito funciona em MODO DEMONSTRAÇÃO
 *  e as respostas não são enviadas. */
export const ENDPOINT_URL = ''

/** Muda este valor quando abrires uma nova edição do inquérito
 *  (ex.: '2027'). Fica gravado em cada resposta. */
export const EDICAO = '2026-T4'

// ---------------------------------------------------------------------
// Recintos, currículos e classes
// ---------------------------------------------------------------------

export type CampusId = 'dzovo1' | 'dzovo2'
export type CurriculumId = 'nacional' | 'cambridge'

export const CAMPUSES: { id: CampusId; name: string; detail: Text }[] = [
  // TODO: substituir pelos bairros/moradas reais
  { id: 'dzovo1', name: 'Dzovo 1', detail: { pt: 'Bairro / morada a confirmar', en: 'Address to be confirmed' } },
  { id: 'dzovo2', name: 'Dzovo 2', detail: { pt: 'Bairro / morada a confirmar', en: 'Address to be confirmed' } },
]

export const CURRICULA: { id: CurriculumId; name: Text; detail: Text }[] = [
  { id: 'nacional', name: { pt: 'Currículo Nacional', en: 'National Curriculum' }, detail: { pt: 'Programa moçambicano', en: 'Mozambican programme' } },
  { id: 'cambridge', name: { pt: 'Currículo Cambridge', en: 'Cambridge Curriculum' }, detail: { pt: 'Cambridge Primary', en: 'Cambridge Primary' } },
]

/** Classes disponíveis em cada currículo (confirmar com a Direção). */
export const GRADES: Record<CurriculumId, string[]> = {
  nacional: ['1.ª classe', '2.ª classe', '3.ª classe', '4.ª classe', '5.ª classe', '6.ª classe', '7.ª classe'],
  cambridge: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7'],
}

/** Se um recinto não tiver algum currículo, retira-o daqui. */
export const CURRICULA_BY_CAMPUS: Record<CampusId, CurriculumId[]> = {
  dzovo1: ['nacional', 'cambridge'],
  dzovo2: ['nacional', 'cambridge'],
}

// ---------------------------------------------------------------------
// Professores
// ---------------------------------------------------------------------
// Uma linha por professor e por turma. "grades" aceita uma ou várias classes.
// Exemplo real: { campus: 'dzovo2', curriculum: 'cambridge', grades: ['Grade 4', 'Grade 5'], name: 'Nome Apelido', subject: { pt: 'Matemática', en: 'Mathematics' } }

export type Teacher = {
  campus: CampusId
  curriculum: CurriculumId
  grades: string[]
  name: string
  subject: Text
}

const titular: Text = { pt: 'Professor(a) titular', en: 'Class teacher' }
const ingles: Text = { pt: 'Inglês', en: 'English' }
const computing: Text = { pt: 'Computing', en: 'Computing' }
const musica: Text = { pt: 'Música', en: 'Music' }

// TODO: SUBSTITUIR TODA ESTA LISTA PELOS PROFESSORES REAIS
function exemplos(): Teacher[] {
  const list: Teacher[] = []
  let n = 1
  for (const campus of ['dzovo1', 'dzovo2'] as CampusId[]) {
    for (const grade of GRADES.nacional) {
      list.push({ campus, curriculum: 'nacional', grades: [grade], name: `Professor(a) Exemplo ${n++}`, subject: titular })
    }
    list.push({ campus, curriculum: 'nacional', grades: GRADES.nacional, name: `Professor(a) Exemplo ${n++}`, subject: ingles })
    for (const grade of GRADES.cambridge) {
      list.push({ campus, curriculum: 'cambridge', grades: [grade], name: `Professor(a) Exemplo ${n++}`, subject: titular })
    }
    list.push({ campus, curriculum: 'cambridge', grades: GRADES.cambridge, name: `Professor(a) Exemplo ${n++}`, subject: computing })
    list.push({ campus, curriculum: 'cambridge', grades: GRADES.cambridge, name: `Professor(a) Exemplo ${n++}`, subject: musica })
  }
  return list
}

export const TEACHERS: Teacher[] = exemplos()

// ---------------------------------------------------------------------
// Perguntas
// ---------------------------------------------------------------------
// Tipos:  'scale' = escala 1–5 com "Não sei / Não se aplica"
//         'text'  = resposta aberta
// required: true → o encarregado tem de responder (ou marcar "Não sei")

export type Question = {
  id: string
  type: 'scale' | 'text'
  text: Text
  required?: boolean
}

export type RatingSection = {
  id: string
  eyebrow: Text
  title: Text
  subtitle: Text
  questions: Question[]
}

export const ORGANIZACAO: RatingSection = {
  id: 'org',
  eyebrow: { pt: 'A escola no dia a dia', en: 'School day to day' },
  title: { pt: 'Organização da escola', en: 'School organisation' },
  subtitle: { pt: 'Qual o seu grau de satisfação com…', en: 'How satisfied are you with…' },
  questions: [
    { id: 'comunicacao', type: 'scale', required: true, text: { pt: 'Comunicação da escola com os pais (avisos, circulares, mensagens)', en: "The school's communication with parents (notices, letters, messages)" } },
    { id: 'antecedencia', type: 'scale', required: true, text: { pt: 'Antecedência com que é informado sobre eventos, reuniões e mudanças', en: 'How far in advance you are told about events, meetings and changes' } },
    { id: 'horarios', type: 'scale', required: true, text: { pt: 'Cumprimento dos horários (início e fim das aulas)', en: 'Punctuality (start and end of lessons)' } },
    { id: 'entrada_saida', type: 'scale', required: true, text: { pt: 'Organização da entrada e da saída dos alunos', en: 'Organisation of student drop-off and pick-up' } },
    { id: 'seguranca', type: 'scale', required: true, text: { pt: 'Segurança dos alunos dentro da escola', en: 'Student safety inside the school' } },
    { id: 'controlo_acesso', type: 'scale', required: true, text: { pt: 'Controlo de quem entra e sai da escola', en: 'Control of who enters and leaves the school' } },
    { id: 'limpeza_salas', type: 'scale', required: true, text: { pt: 'Limpeza e higiene das salas de aula', en: 'Cleanliness of classrooms' } },
    { id: 'limpeza_wc', type: 'scale', required: true, text: { pt: 'Limpeza e higiene das casas de banho', en: 'Cleanliness of toilets' } },
    { id: 'salas', type: 'scale', required: true, text: { pt: 'Condições das salas de aula (espaço, ventilação, mobiliário)', en: 'Classroom conditions (space, ventilation, furniture)' } },
    { id: 'eventos', type: 'scale', required: true, text: { pt: 'Organização de eventos e datas comemorativas', en: 'Organisation of events and celebrations' } },
    { id: 'extracurriculares', type: 'scale', required: true, text: { pt: 'Variedade e qualidade das atividades extracurriculares', en: 'Range and quality of extracurricular activities' } },
    { id: 'disciplina', type: 'scale', required: true, text: { pt: 'Disciplina e comportamento geral dos alunos', en: 'General discipline and student behaviour' } },
    { id: 'bullying', type: 'scale', required: true, text: { pt: 'Atuação da escola na prevenção e resolução de casos de bullying', en: 'How the school prevents and handles bullying' } },
    { id: 'org_geral', type: 'scale', required: true, text: { pt: 'Satisfação geral com a organização da escola', en: 'Overall satisfaction with school organisation' } },
  ],
}

export const DIRECAO: RatingSection = {
  id: 'dir',
  eyebrow: { pt: 'Liderança', en: 'Leadership' },
  title: { pt: 'Direção da escola', en: 'School leadership' },
  subtitle: { pt: 'Na pessoa do Diretor da escola. Até que ponto concorda?', en: 'Thinking of the Head of School. How satisfied are you?' },
  questions: [
    { id: 'acessivel', type: 'scale', required: true, text: { pt: 'O Diretor é acessível quando preciso de falar com ele', en: 'The Head is accessible when I need to talk to him' } },
    { id: 'ouvido', type: 'scale', required: true, text: { pt: 'As minhas preocupações são ouvidas com atenção e respeito', en: 'My concerns are listened to with attention and respect' } },
    { id: 'resolve', type: 'scale', required: true, text: { pt: 'Os problemas apresentados à Direção são resolvidos em tempo útil', en: 'Problems raised with the leadership are resolved in good time' } },
    { id: 'decisoes', type: 'scale', required: true, text: { pt: 'As decisões importantes são comunicadas aos pais com clareza', en: 'Important decisions are communicated clearly to parents' } },
    { id: 'confianca', type: 'scale', required: true, text: { pt: 'Confio na liderança e no rumo que a escola está a seguir', en: "I trust the leadership and the school's direction" } },
    { id: 'dir_geral', type: 'scale', required: true, text: { pt: 'Satisfação geral com a Direção', en: 'Overall satisfaction with the leadership' } },
    { id: 'dir_comentario', type: 'text', text: { pt: 'Há algo que gostaria de dizer diretamente à Direção? (opcional)', en: 'Is there anything you would like to tell the leadership directly? (optional)' } },
  ],
}

export const ADMINISTRACAO: RatingSection = {
  id: 'adm',
  eyebrow: { pt: 'Atendimento', en: 'Front office' },
  title: { pt: 'Administração / Secretaria', en: 'Administration / Front office' },
  subtitle: { pt: 'Qual o seu grau de satisfação com…', en: 'How satisfied are you with…' },
  questions: [
    { id: 'cordialidade', type: 'scale', required: true, text: { pt: 'Cordialidade e simpatia no atendimento', en: 'Friendliness of the service' } },
    { id: 'rapidez', type: 'scale', required: true, text: { pt: 'Rapidez no atendimento e na resolução de pedidos', en: 'Speed of service and of handling requests' } },
    { id: 'propinas', type: 'scale', required: true, text: { pt: 'Clareza das informações sobre propinas, pagamentos e prazos', en: 'Clarity of information on fees, payments and deadlines' } },
    { id: 'documentos', type: 'scale', required: true, text: { pt: 'Facilidade em obter documentos (declarações, recibos, boletins)', en: 'Ease of getting documents (letters, receipts, reports)' } },
    { id: 'contacto', type: 'scale', required: true, text: { pt: 'Facilidade de contacto (telefone, WhatsApp, presencial)', en: 'Ease of contact (phone, WhatsApp, in person)' } },
    { id: 'adm_geral', type: 'scale', required: true, text: { pt: 'Satisfação geral com a Administração', en: 'Overall satisfaction with the administration' } },
    { id: 'adm_comentario', type: 'text', text: { pt: 'Comentário sobre a Administração (opcional)', en: 'Comment on the administration (optional)' } },
  ],
}

/** Perguntas repetidas para CADA professor da turma. */
export const TEACHER_QUESTIONS: Question[] = [
  { id: 'comunica_progresso', type: 'scale', required: true, text: { pt: 'Comunica comigo sobre o progresso do meu educando', en: "Communicates with me about my child's progress" } },
  { id: 'informacao_clara', type: 'scale', required: true, text: { pt: 'Dá informação clara sobre as dificuldades e os pontos fortes', en: 'Gives clear information about difficulties and strengths' } },
  { id: 'disponivel', type: 'scale', required: true, text: { pt: 'Está disponível quando preciso de falar com ele(a)', en: 'Is available when I need to talk to them' } },
  { id: 'relacao', type: 'scale', required: true, text: { pt: 'Tem uma boa relação com o meu educando e trata-o com respeito', en: 'Has a good relationship with my child and treats them with respect' } },
  { id: 'gosta_aulas', type: 'scale', required: true, text: { pt: 'O meu educando gosta das aulas deste(a) professor(a)', en: "My child enjoys this teacher's lessons" } },
  { id: 'prof_geral', type: 'scale', required: true, text: { pt: 'Satisfação geral com este(a) professor(a)', en: 'Overall satisfaction with this teacher' } },
]

export const DURATION_OPTIONS: Text[] = [
  { pt: 'Menos de 1 ano', en: 'Less than 1 year' },
  { pt: '1–2 anos', en: '1–2 years' },
  { pt: '3–4 anos', en: '3–4 years' },
  { pt: '5 anos ou mais', en: '5 years or more' },
]

export const IMPROVEMENT_OPTIONS: { id: string; text: Text }[] = [
  { id: 'comunicacao', text: { pt: 'Comunicação', en: 'Communication' } },
  { id: 'seguranca', text: { pt: 'Segurança', en: 'Safety' } },
  { id: 'instalacoes', text: { pt: 'Instalações', en: 'Facilities' } },
  { id: 'limpeza', text: { pt: 'Limpeza', en: 'Cleanliness' } },
  { id: 'ensino', text: { pt: 'Qualidade do ensino', en: 'Teaching quality' } },
  { id: 'extracurriculares', text: { pt: 'Atividades extracurriculares', en: 'Extracurricular activities' } },
  { id: 'disciplina', text: { pt: 'Disciplina', en: 'Discipline' } },
  { id: 'atendimento', text: { pt: 'Atendimento', en: 'Front office service' } },
  { id: 'tecnologia', text: { pt: 'Tecnologia', en: 'Technology' } },
  { id: 'horarios', text: { pt: 'Horários', en: 'Timetables' } },
  { id: 'outro', text: { pt: 'Outro', en: 'Other' } },
]

export const MAX_IMPROVEMENTS = 3
