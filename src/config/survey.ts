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
export const ENDPOINT_URL = 'https://script.google.com/macros/s/AKfycbyqCV4zEqRbD4G1xQiy8aJyV4xaCKhbVUXAEzzzKa6D3UPYk1VDFIBIlgJGs_SxwBNR/exec'

/** Muda este valor quando abrires uma nova edição do inquérito
 *  (ex.: '2027'). Fica gravado em cada resposta. */
export const EDICAO = '2026-T4'

// ---------------------------------------------------------------------
// Recintos, classes e currículos
// ---------------------------------------------------------------------
// O encarregado escolhe só a CLASSE: o recinto sai daí.
// Depois escolhe o currículo que o educando segue (PROGRAMS).

export type CampusId = 'dzovo1' | 'dzovo2'
export type CurriculumId = 'nacional' | 'cambridge'

export const CAMPUSES: { id: CampusId; name: string; detail: Text }[] = [
  { id: 'dzovo1', name: 'Dzovo 1', detail: { pt: 'Kinder à 3.ª classe', en: 'Kindergarten to Grade 3' } },
  { id: 'dzovo2', name: 'Dzovo 2', detail: { pt: '4.ª à 6.ª classe', en: 'Grades 4 to 6' } },
]

/** O que o encarregado escolhe. "curricula" diz que professores aparecem. */
export type ProgramId = 'bilingue' | 'cambridge' | 'nacional'
export const PROGRAMS: { id: ProgramId; name: Text; detail: Text; curricula: CurriculumId[] }[] = [
  { id: 'bilingue', name: { pt: 'Bilingue', en: 'Bilingual' }, detail: { pt: 'Currículo Nacional e Cambridge', en: 'National and Cambridge curricula' }, curricula: ['nacional', 'cambridge'] },
  { id: 'cambridge', name: { pt: 'Full Cambridge', en: 'Full Cambridge' }, detail: { pt: 'Só o currículo Cambridge', en: 'Cambridge curriculum only' }, curricula: ['cambridge'] },
  { id: 'nacional', name: { pt: 'Nacional', en: 'National' }, detail: { pt: 'Só o currículo nacional', en: 'National curriculum only' }, curricula: ['nacional'] },
]

/** programs: opções de currículo nessa classe. Lista vazia = a pergunta não aparece
 *  (o encarregado vê todos os professores da classe). */
export type Grade = { id: string; name: Text; campus: CampusId; programs: ProgramId[] }

const TODOS_CURRICULOS: ProgramId[] = ['bilingue', 'cambridge', 'nacional']

export const GRADES: Grade[] = [
  { id: 'kinder_prep', name: { pt: 'Kinder Preparatório', en: 'Kinder Preparatory' }, campus: 'dzovo1', programs: TODOS_CURRICULOS },
  { id: 'kinder', name: { pt: 'Kinder', en: 'Kinder' }, campus: 'dzovo1', programs: TODOS_CURRICULOS },
  { id: '1', name: { pt: '1.ª classe', en: 'Grade 1' }, campus: 'dzovo1', programs: TODOS_CURRICULOS },
  { id: '2', name: { pt: '2.ª classe', en: 'Grade 2' }, campus: 'dzovo1', programs: TODOS_CURRICULOS },
  { id: '3', name: { pt: '3.ª classe', en: 'Grade 3' }, campus: 'dzovo1', programs: TODOS_CURRICULOS },
  { id: '4', name: { pt: '4.ª classe', en: 'Grade 4' }, campus: 'dzovo2', programs: TODOS_CURRICULOS },
  { id: '5', name: { pt: '5.ª classe', en: 'Grade 5' }, campus: 'dzovo2', programs: TODOS_CURRICULOS },
  { id: '6', name: { pt: '6.ª classe', en: 'Grade 6' }, campus: 'dzovo2', programs: TODOS_CURRICULOS },
]

// ---------------------------------------------------------------------
// Professores
// ---------------------------------------------------------------------
// Cada encarregado só avalia os professores que dão aulas ao seu educando:
//   • grades    → classes onde o professor dá aulas (ids de GRADES)
//   • curricula → ['nacional']  aparece a quem faz Bilingue ou Nacional;
//                 ['cambridge'] aparece a quem faz Bilingue ou Full Cambridge;
//                 OS_DOIS       aparece a todos dessa classe.
// Os nomes ficam gravados na Google Sheet: não os mudar depois de o inquérito abrir.

export type Teacher = {
  name: string
  subject: Text
  grades: string[]
  curricula: CurriculumId[]
}

const OS_DOIS: CurriculumId[] = ['nacional', 'cambridge']

const educador: Text = { pt: 'Educador(a) do Kinder', en: 'Kinder teacher' }
const titularNacional: Text = { pt: 'Titular · Currículo Nacional', en: 'Class teacher · National Curriculum' }
const titularCambridge: Text = { pt: 'Titular · Cambridge', en: 'Class teacher · Cambridge' }
const titularAmbos: Text = { pt: 'Titular · Nacional e Cambridge', en: 'Class teacher · National and Cambridge' }

export const TEACHERS: Teacher[] = [
  // Dzovo 1 — Kinder à 3.ª classe
  { name: 'Generosa Boavida Guenha', subject: educador, grades: ['kinder_prep'], curricula: OS_DOIS },
  { name: 'Ilda', subject: educador, grades: ['kinder'], curricula: OS_DOIS },
  { name: 'Maria Perfeita', subject: titularNacional, grades: ['1'], curricula: ['nacional'] },
  { name: 'Judith Queluba Mabunda', subject: titularCambridge, grades: ['1'], curricula: ['cambridge'] },
  { name: 'Mary', subject: { pt: 'Professora · Cambridge', en: 'Teacher · Cambridge' }, grades: ['1'], curricula: ['cambridge'] },
  { name: 'Natália Nuvunga', subject: titularNacional, grades: ['2'], curricula: ['nacional'] },
  { name: 'Ogochukwu Cynthia Okoye', subject: titularCambridge, grades: ['2'], curricula: ['cambridge'] },
  { name: 'Margarethy Abdala', subject: titularNacional, grades: ['3'], curricula: ['nacional'] },
  { name: 'Delma Fadzai Takavendesa', subject: titularCambridge, grades: ['3'], curricula: ['cambridge'] },

  // Dzovo 2 — 4.ª à 6.ª classe (a 4.ª tem um só professor para os dois currículos)
  { name: 'Fernando Augusto Nuvunga', subject: titularAmbos, grades: ['4'], curricula: OS_DOIS },
  { name: 'Selma João Chume', subject: titularNacional, grades: ['5', '6'], curricula: ['nacional'] },
  { name: 'Geraldo Tarafa Murima', subject: titularCambridge, grades: ['5', '6'], curricula: ['cambridge'] },

  // Disciplinas (aparecem a todos os alunos dessas classes)
  { name: 'Anastácia', subject: { pt: 'Francês', en: 'French' }, grades: ['2', '3', '4', '5', '6'], curricula: OS_DOIS },
  { name: 'Tomás Mathe', subject: { pt: 'Computer Science', en: 'Computer Science' }, grades: ['4', '5', '6'], curricula: OS_DOIS },
  { name: 'Tomás Mathe', subject: { pt: 'História', en: 'History' }, grades: ['4', '5'], curricula: OS_DOIS },
]

// ---------------------------------------------------------------------
// Perguntas
// ---------------------------------------------------------------------
// Tipos:  'scale' = escala 1–5 com "Não sei / Não se aplica"
//         'choice' = uma das opções de CHOICE_OPTIONS (Sim, muito / Um pouco / …)
//         'text'  = resposta aberta
// required: true → o encarregado tem de responder (ou marcar "Não sei")

export type Question = {
  id: string
  type: 'scale' | 'choice' | 'text'
  text: Text
  required?: boolean
  /** Só para 'text': texto de ajuda dentro da caixa */
  placeholder?: Text
  /** Título que aparece antes desta pergunta, para separar partes da secção */
  group?: Text
  /** Secções com pergunta de entrada (gate): esta pergunta aparece também a quem
   *  não responde "sim" à entrada, mas aí é sempre opcional. */
  forAll?: boolean
}

export type Option = { id: string; text: Text }

/** Opções das perguntas 'choice'. O texto em português é o que fica gravado na folha. */
export const CHOICE_OPTIONS: Option[] = [
  { id: 'muito', text: { pt: 'Sim, muito', en: 'Yes, a lot' } },
  { id: 'pouco', text: { pt: 'Um pouco', en: 'A little' } },
  { id: 'nao', text: { pt: 'Não notei', en: "I haven't noticed" } },
  { id: 'ns', text: { pt: 'Não sei', en: "Don't know" } },
]

export type RatingSection = {
  id: string
  eyebrow: Text
  title: Text
  subtitle: Text
  /** Pergunta de entrada: só quem escolhe a opção "open" vê a secção toda. */
  gate?: { id: string; text: Text; options: Option[]; open: string; closedNote: Text }
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
  subtitle: {
    pt: 'Na pessoa do Diretor da escola. São poucas perguntas: queremos sobretudo ouvir a sua opinião, escrita por si.',
    en: 'Thinking of the Head of School. Just a few questions: above all, we want to hear your opinion in your own words.',
  },
  questions: [
    { id: 'acessivel', type: 'scale', required: true, text: { pt: 'O Diretor é acessível e ouve as minhas preocupações', en: 'The Head is approachable and listens to my concerns' } },
    { id: 'resolve', type: 'scale', required: true, text: { pt: 'Os problemas apresentados à Direção são resolvidos em tempo útil', en: 'Problems raised with the leadership are resolved in good time' } },
    { id: 'decisoes', type: 'scale', required: true, text: { pt: 'As decisões importantes são comunicadas aos pais com clareza', en: 'Important decisions are communicated clearly to parents' } },
    { id: 'dir_geral', type: 'scale', required: true, text: { pt: 'Satisfação geral com a Direção', en: 'Overall satisfaction with the leadership' } },
    {
      id: 'dir_bem', type: 'text',
      text: { pt: 'Na sua opinião, o que a Direção está a fazer bem?', en: 'In your opinion, what is the leadership doing well?' },
      placeholder: { pt: 'Escreva à vontade, com as suas palavras…', en: 'Write freely, in your own words…' },
    },
    {
      id: 'dir_mudar', type: 'text',
      text: { pt: 'O que gostaria que a Direção mudasse ou melhorasse?', en: 'What would you like the leadership to change or improve?' },
      placeholder: { pt: 'Todas as opiniões são lidas pela Direção…', en: 'Every opinion is read by the leadership…' },
    },
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
    { id: 'adm_comentario', type: 'text', text: { pt: 'Comentário sobre a Administração', en: 'Comment on the administration' } },
  ],
}

export const EDUCACAO_CRISTA: RatingSection = {
  id: 'ec',
  eyebrow: { pt: 'Estudos Bíblicos', en: 'Bible Study' },
  title: { pt: 'Educação Cristã', en: 'Christian Education' },
  subtitle: {
    pt: 'Sobre os Estudos Bíblicos (Bible Study) deste ano. Se a sua família não é cristã, não precisa de responder às perguntas sobre as aulas.',
    en: "About this year's Bible Study. If your family is not Christian, you do not need to answer the questions about the lessons.",
  },
  gate: {
    id: 'familia',
    text: { pt: 'A sua família é cristã?', en: 'Is your family Christian?' },
    options: [
      { id: 'sim', text: { pt: 'Sim', en: 'Yes' } },
      { id: 'nao', text: { pt: 'Não', en: 'No' } },
      { id: 'pnd', text: { pt: 'Prefiro não dizer', en: 'Prefer not to say' } },
    ],
    open: 'sim',
    closedNote: {
      pt: 'Obrigado. Não precisa de responder ao resto desta secção e pode avançar. Se quiser, diga-nos se sente que a escola respeita a fé da sua família.',
      en: "Thank you. You do not need to answer the rest of this section and can continue. If you wish, tell us whether you feel the school respects your family's faith.",
    },
  },
  questions: [
    { id: 'aulas', type: 'scale', required: true, text: { pt: 'Qualidade das aulas de Estudos Bíblicos', en: 'Quality of the Bible Study lessons' } },
    { id: 'idade', type: 'scale', required: true, text: { pt: 'Os temas e as histórias são adequados à idade do meu educando', en: "The topics and stories suit my child's age" } },
    { id: 'informa', type: 'scale', required: true, text: { pt: 'A escola informa os pais sobre o que é ensinado (temas, versículos, atividades)', en: 'The school tells parents what is taught (topics, verses, activities)' } },
    { id: 'momentos', type: 'scale', required: true, text: { pt: 'Organização dos momentos de oração e devocionais', en: 'Organisation of prayer and devotional times' } },
    { id: 'respeito', type: 'scale', required: true, forAll: true, text: { pt: 'A escola respeita a fé e as convicções de cada família', en: "The school respects each family's faith and beliefs" } },
    { id: 'geral', type: 'scale', required: true, text: { pt: 'Satisfação geral com a Educação Cristã este ano', en: 'Overall satisfaction with Christian Education this year' } },

    {
      id: 'dev_fala', type: 'choice', required: true,
      group: { pt: 'O que notou no seu educando ao longo do ano?', en: 'What have you noticed in your child this year?' },
      text: { pt: 'Fala em casa sobre o que aprende nos Estudos Bíblicos', en: 'Talks at home about what they learn in Bible Study' },
    },
    { id: 'dev_conhece', type: 'choice', required: true, text: { pt: 'Conhece mais histórias bíblicas, orações ou versículos do que no início do ano', en: 'Knows more Bible stories, prayers or verses than at the start of the year' } },
    { id: 'dev_valores', type: 'choice', required: true, text: { pt: 'Mostra mais respeito, partilha, perdão e responsabilidade', en: 'Shows more respect, sharing, forgiveness and responsibility' } },
    { id: 'dev_gosta', type: 'choice', required: true, text: { pt: 'Gosta das aulas e dos momentos de oração', en: 'Enjoys the lessons and prayer times' } },

    {
      id: 'bem', type: 'text',
      group: { pt: 'A sua opinião', en: 'Your opinion' },
      text: { pt: 'O que correu bem este ano na Educação Cristã?', en: 'What went well in Christian Education this year?' },
      placeholder: { pt: 'Escreva à vontade, com as suas palavras…', en: 'Write freely, in your own words…' },
    },
    {
      id: 'errado', type: 'text',
      text: { pt: 'O que correu mal ou o que deveria mudar?', en: 'What went wrong, or what should change?' },
      placeholder: { pt: 'Todas as opiniões são lidas pela Direção…', en: 'Every opinion is read by the leadership…' },
    },
    { id: 'obs', type: 'text', forAll: true, text: { pt: 'Outros comentários ou observações', en: 'Other comments or observations' } },
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
  { id: 'educacao_crista', text: { pt: 'Educação Cristã', en: 'Christian Education' } },
  { id: 'outro', text: { pt: 'Outro', en: 'Other' } },
]

export const MAX_IMPROVEMENTS = 3
