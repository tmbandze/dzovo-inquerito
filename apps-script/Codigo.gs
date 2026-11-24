/**
 * Inquérito aos Encarregados de Educação — Colégio Dzovo
 * Recebe as respostas do site e grava-as nesta Google Sheet.
 *
 * Folhas criadas automaticamente:
 *   • "Respostas"   — uma linha por resposta (organização, direção, administração, educação cristã, melhorias, comentários)
 *   • "Professores" — uma linha por professor avaliado (liga-se à resposta pela coluna id_resposta)
 *
 * Instalação: ver README do projeto (secção "Ligar à Google Sheet").
 *
 * Autorizações: ler e escrever nesta folha, e criar os PDFs dos relatórios no Google Drive
 * de quem usa o menu "Criar PDF para imprimir" (pasta "Relatórios do Inquérito").
 */

const SHEET_RESPOSTAS = 'Respostas'
const SHEET_PROFESSORES = 'Professores'
const MAX_TEXTO = 2000

function doPost(e) {
  const lock = LockService.getScriptLock()
  try {
    lock.waitLock(30000)
    const data = JSON.parse(e.postData.contents)
    if (!data || typeof data.resposta !== 'object') throw new Error('Formato inválido')

    const ss = SpreadsheetApp.getActiveSpreadsheet()
    const agora = new Date()

    appendRow_(ss, SHEET_RESPOSTAS, Object.assign({ data_hora: agora }, data.resposta))
    ;(data.professores || []).forEach(function (p) {
      appendRow_(ss, SHEET_PROFESSORES, Object.assign({ data_hora: agora }, p))
    })

    // O painel é atualizado a cada resposta; uma falha aqui não perde a resposta já gravada
    try {
      atualizarPaineis_(ss)
    } catch (err) {
      console.error('Painel não atualizado: ' + err)
    }

    return json_({ ok: true })
  } catch (err) {
    return json_({ ok: false, error: String(err) })
  } finally {
    lock.releaseLock()
  }
}

/** Permite testar se a aplicação está publicada: abrir o URL no navegador. */
function doGet() {
  return json_({ ok: true, info: 'Inquérito Colégio Dzovo — serviço ativo' })
}

/**
 * Acrescenta uma linha, criando colunas novas automaticamente se o
 * inquérito ganhar perguntas. As colunas existentes nunca são reordenadas.
 */
function appendRow_(ss, name, record) {
  let sheet = ss.getSheetByName(name)
  if (!sheet) {
    sheet = ss.insertSheet(name)
    sheet.setFrozenRows(1)
  }
  const keys = Object.keys(record)
  let headers = sheet.getLastColumn() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    : []

  const novas = keys.filter(function (k) { return headers.indexOf(k) === -1 })
  if (novas.length) {
    sheet.getRange(1, headers.length + 1, 1, novas.length).setValues([novas])
    headers = headers.concat(novas)
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1c3a63').setFontColor('#ffffff')
  }

  const row = headers.map(function (h) { return clean_(record[h]) })
  sheet.appendRow(row)
}

/** Limita o tamanho e impede que um texto seja interpretado como fórmula. */
function clean_(v) {
  if (v === undefined || v === null) return ''
  if (v instanceof Date || typeof v === 'number') return v
  let s = String(v).slice(0, MAX_TEXTO)
  if (/^[=+\-@]/.test(s)) s = "'" + s
  return s
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}

// =====================================================================
// PAINEL — resumo das respostas, pronto a apresentar
// ---------------------------------------------------------------------
// Menu "Inquérito" → "Atualizar painel" cria ou atualiza:
//   • "Painel"             — resultados gerais (para apresentar / exportar em PDF)
//   • "Painel Professores" — resultados por professor (confidencial)
//   • "Painel Direção"     — liderança do Diretor em detalhe (confidencial)
// e arruma o aspeto das folhas Respostas e Professores.
// Os filtros (recinto, currículo, classe, edição) escolhem-se no topo do Painel.
// Se as perguntas do inquérito mudarem, atualizar AREAS, PERGUNTAS_PROF e DESENVOLVIMENTO.
// =====================================================================

const SHEET_PAINEL = 'Painel'
const SHEET_PAINEL_PROF = 'Painel Professores'
const SHEET_PAINEL_DIR = 'Painel Direção'
// versão com fundo branco: no PDF do Google, a transparência do PNG original sai a preto
const EMBLEMA_URL = 'https://tmbandze.github.io/dzovo-inquerito/emblema-impressao.png'
const FONTE = 'Inter'
const COR = {
  azul: '#1c3a63', azulSuave: '#e8eef6', texto: '#1f2937', cinza: '#6b7280',
  linha: '#e5e7eb', cartao: '#f4f6fa', zebra: '#f8fafc',
  verde: '#15803d', ambar: '#b45309', vermelho: '#b91c1c',
  verdeSuave: '#dcfce7', ambarSuave: '#fef3c7', vermelhoSuave: '#fee2e2',
}

/** Perguntas da Direção por tema (detalhe só no "Painel Direção", confidencial). */
const GRUPOS_DIR = [
  { nome: 'Relação com os pais', colunas: {
    dir_acessivel: 'Acessível e ouve as preocupações',
    dir_respeito: 'Trata os pais com respeito',
    dir_resolve: 'Resolve os problemas em tempo útil',
    dir_confianca: 'Confiança para uma situação séria',
  } },
  { nome: 'Comunicação e decisões', colunas: {
    dir_decisoes: 'Comunica as decisões com clareza',
    dir_explica: 'Explica as razões das mudanças',
    dir_ouve_pais: 'Tem em conta a opinião dos pais',
  } },
  { nome: 'Trabalho em equipa com os professores', colunas: {
    dir_ambiente: 'Bom ambiente com os professores',
    dir_apoia_prof: 'Apoia e valoriza os professores',
    dir_coerencia: 'Mensagem coerente com os professores',
    dir_mudancas_prof: 'Mudanças de professores bem geridas',
  } },
  { nome: 'Rumo da escola', colunas: {
    dir_rumo: 'Rumo claro e organizado',
    dir_conflitos: 'Situações difíceis com calma e justiça',
    dir_dir_geral: 'Satisfação geral',
  } },
]
/** Comparação com anos anteriores (coluna dir_evolucao) e cor de cada resposta. */
const OPCOES_EVOLUCAO = [['Melhorou', '#15803d'], ['Ficou igual', '#1c3a63'], ['Piorou', '#b91c1c'], ['Não sei', '#6b7280']]
/** Respostas abertas sobre a Direção: só aparecem no Painel Direção. */
const TEXTOS_DIRECAO = {
  dir_dir_bem: 'O que fez bem',
  dir_dir_mudar: 'O que fazer de forma diferente',
  dir_situacao: 'Situação partilhada',
}

/** Nomes curtos das perguntas. As chaves são as colunas da folha Respostas.
 *  confidencial: no Painel geral só aparece a média da área. */
const AREAS = [
  { nome: 'Organização da escola', curto: 'Organização', colunas: {
    org_comunicacao: 'Comunicação com os pais',
    org_antecedencia: 'Antecedência das informações',
    org_horarios: 'Cumprimento dos horários',
    org_entrada_saida: 'Entrada e saída dos alunos',
    org_seguranca: 'Segurança dos alunos',
    org_controlo_acesso: 'Controlo de acessos',
    org_limpeza_salas: 'Limpeza das salas',
    org_limpeza_wc: 'Limpeza das casas de banho',
    org_salas: 'Condições das salas',
    org_eventos: 'Eventos e datas comemorativas',
    org_extracurriculares: 'Atividades extracurriculares',
    org_disciplina: 'Disciplina dos alunos',
    org_bullying: 'Prevenção do bullying',
    org_org_geral: 'Satisfação geral',
  } },
  { nome: 'Direção', curto: 'Direção', confidencial: true, colunas: Object.assign.apply(null, [{}].concat(GRUPOS_DIR.map(function (g) { return g.colunas }))) },
  { nome: 'Administração / Secretaria', curto: 'Administração', colunas: {
    adm_cordialidade: 'Cordialidade no atendimento',
    adm_rapidez: 'Rapidez no atendimento',
    adm_propinas: 'Informação sobre propinas',
    adm_documentos: 'Obtenção de documentos',
    adm_contacto: 'Facilidade de contacto',
    adm_adm_geral: 'Satisfação geral',
  } },
  { nome: 'Educação Cristã', curto: 'Educação Cristã', colunas: {
    ec_aulas: 'Aulas de Estudos Bíblicos',
    ec_idade: 'Temas adequados à idade',
    ec_informa: 'Informação sobre o que é ensinado',
    ec_momentos: 'Momentos de oração e devocionais',
    ec_respeito: 'Respeito pela fé de cada família',
    ec_geral: 'Satisfação geral',
  } },
]

/** Educação Cristã: o que os pais notaram no educando (Sim, muito / Um pouco / Não notei / Não sei). */
const DESENVOLVIMENTO = {
  ec_dev_fala: 'Fala em casa do que aprende',
  ec_dev_conhece: 'Conhece mais histórias, orações e versículos',
  ec_dev_valores: 'Mais respeito, partilha, perdão e responsabilidade',
  ec_dev_gosta: 'Gosta das aulas e da oração',
}
const OPCOES_DEV = ['Sim, muito', 'Um pouco', 'Não notei', 'Não sei']
/** Pergunta de entrada da Educação Cristã (coluna ec_familia). */
const OPCOES_FAMILIA = ['Sim', 'Não', 'Prefiro não dizer']

/** Colunas da folha Professores. */
const PERGUNTAS_PROF = {
  comunica_progresso: 'Comunica o progresso',
  informacao_clara: 'Informação clara',
  disponivel: 'Disponibilidade',
  relacao: 'Relação com o aluno',
  gosta_aulas: 'Aluno gosta das aulas',
  prof_geral: 'Satisfação geral',
}
const AREA_PROF = { nome: 'Professores', curto: 'Professores', colunas: PERGUNTAS_PROF, professores: true }

const TEXTOS_ABERTOS = {
  o_que_mais_gosta: 'O que mais gosta',
  como_melhorar: 'Como melhorar',
  comentarios_gerais: 'Comentário geral',
  adm_adm_comentario: 'Sobre a Administração',
  ec_ec_bem: 'Educação Cristã: o que correu bem',
  ec_ec_errado: 'Educação Cristã: o que mudar',
  ec_ec_obs: 'Educação Cristã: observações',
  melhoria_outro: 'Outra melhoria',
}
const TEMPOS = ['Menos de 1 ano', '1–2 anos', '3–4 anos', '5 anos ou mais']
/** Ordem das classes nas listas (Kinder primeiro). */
const CLASSES = ['Kinder Preparatório', 'Kinder', '1.ª classe', '2.ª classe', '3.ª classe', '4.ª classe', '5.ª classe', '6.ª classe']
const ORDEM = { tempo_na_escola: TEMPOS, classe: CLASSES }

const FILTROS = [
  { coluna: 'recinto', nome: 'Recinto' },
  { coluna: 'curriculo', nome: 'Currículo' },
  { coluna: 'classe', nome: 'Classe' },
  { coluna: 'edicao', nome: 'Edição' },
]
const TODOS = 'Todos'
const LINHA_FILTROS = 6
/** Larguras das colunas do Painel e do Painel Direção: somam ≈ 718 px, a largura útil
 *  de um A4 ao alto, para o PDF sair a 100% e a letra não encolher. */
const LARGURAS_PAINEL = [12, 238, 78, 78, 78, 78, 80, 76]
const LARGURA_ROTULO = 228
const LARGURA_TEXTO = 706
/** Colunas de cada cartão / filtro no Painel: B, C:D, E:F, G:H */
const BLOCOS = [[2, 2], [3, 4], [5, 6], [7, 8]]

// ---------------------------------------------------------------------
// Menu e atualização
// ---------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Inquérito')
    .addItem('Atualizar painel', 'atualizarPainel')
    .addItem('Criar PDF para imprimir', 'criarPdfs')
    .addItem('Criar PDF de cada professor', 'criarPdfsProfessores')
    .addItem('Atualizar automaticamente (de hora a hora)', 'ativarAtualizacaoAutomatica')
    .addSeparator()
    .addItem('Apagar respostas de teste', 'apagarRespostasTeste')
    .addItem('Apagar TODAS as respostas (recomeçar do zero)', 'apagarTodasRespostas')
    .addToUi()
}

/** Ao mudar um filtro no Painel, ou ao editar/limpar dados à mão, os painéis são recalculados. */
function onEdit(e) {
  if (!e) return
  const sh = e.range.getSheet()
  const nome = sh.getName()
  if ((nome === SHEET_PAINEL && e.range.getRow() === LINHA_FILTROS) ||
      (nome === SHEET_PAINEL_PROF && e.range.getRow() === LINHA_FILTRO_PROF) ||
      nome === SHEET_RESPOSTAS || nome === SHEET_PROFESSORES) {
    redesenhar_(e.source)
  }
}

/** Acionador "ao alterar": apagar linhas ou separadores à mão não dispara o onEdit. */
function aoAlterarFolha(e) {
  if (!e || ['REMOVE_ROW', 'REMOVE_GRID'].indexOf(e.changeType) === -1) return
  const ss = e.source || SpreadsheetApp.getActiveSpreadsheet()
  // linhas apagadas nos próprios painéis (ao redesenhar) não contam
  if (e.changeType === 'REMOVE_ROW') {
    const ativa = ss.getActiveSheet().getName()
    if (ativa === SHEET_PAINEL || ativa === SHEET_PAINEL_PROF || ativa === SHEET_PAINEL_DIR) return
  }
  redesenhar_(ss)
}

/** Redesenha com o mesmo cadeado do doPost, para dois desenhos não se misturarem. */
function redesenhar_(ss) {
  const lock = LockService.getScriptLock()
  if (!lock.tryLock(20000)) return
  try {
    desenharPaineis_(ss)
  } finally {
    lock.releaseLock()
  }
}

function garantirAcionadorAlteracoes_() {
  const existe = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'aoAlterarFolha' })
  if (!existe) ScriptApp.newTrigger('aoAlterarFolha').forSpreadsheet(SpreadsheetApp.getActive()).onChange().create()
}

function atualizarPainel() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const lock = LockService.getScriptLock()
  lock.waitLock(30000)
  try {
    atualizarPaineis_(ss)
  } finally {
    lock.releaseLock()
  }
  try { garantirAcionadorAlteracoes_() } catch (err) { console.error('Acionador não criado: ' + err) }
  ss.toast('Painel atualizado.', 'Inquérito')
}

function atualizarPaineis_(ss) {
  formatarFolhaDados_(ss.getSheetByName(SHEET_RESPOSTAS))
  formatarFolhaDados_(ss.getSheetByName(SHEET_PROFESSORES))
  desenharPaineis_(ss)
}

function ativarAtualizacaoAutomatica() {
  const existe = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'atualizarPainel' })
  if (!existe) ScriptApp.newTrigger('atualizarPainel').timeBased().everyHours(1).create()
  garantirAcionadorAlteracoes_()
  SpreadsheetApp.getActiveSpreadsheet().toast('O painel passa a atualizar-se de hora a hora.', 'Inquérito')
}

/** Apaga as linhas com edicao = "TESTE" nas folhas Respostas e Professores. */
function apagarRespostasTeste() {
  const ui = SpreadsheetApp.getUi()
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const folhas = [SHEET_RESPOSTAS, SHEET_PROFESSORES].map(function (n) { return ss.getSheetByName(n) }).filter(Boolean)
  const linhasTeste = function (sh) {
    if (sh.getLastRow() < 2) return []
    const col = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].indexOf('edicao')
    if (col === -1) return []
    return sh.getRange(2, col + 1, sh.getLastRow() - 1, 1).getValues()
      .map(function (v, i) { return String(v[0]).trim().toUpperCase() === 'TESTE' ? i + 2 : 0 })
      .filter(Boolean)
  }
  const total = folhas.reduce(function (n, sh) { return n + linhasTeste(sh).length }, 0)
  if (!total) {
    ui.alert('Não há respostas de teste para apagar.')
    return
  }
  const ok = ui.alert('Apagar respostas de teste',
    'Vão ser apagadas ' + total + ' linhas com "TESTE" na coluna edicao (folhas Respostas e Professores). As outras respostas não são tocadas. Continuar?',
    ui.ButtonSet.YES_NO)
  if (ok !== ui.Button.YES) return
  folhas.forEach(function (sh) {
    const linhas = linhasTeste(sh)
    // O Sheets não deixa apagar todas as linhas abaixo do cabeçalho fixo
    if (sh.getMaxRows() - linhas.length <= sh.getFrozenRows()) sh.insertRowAfter(sh.getMaxRows())
    linhas.reverse().forEach(function (r) { sh.deleteRow(r) })
  })
  atualizarPainel()
  ss.toast(total + ' linhas de teste apagadas.', 'Inquérito')
}

/** Apaga as folhas Respostas e Professores por completo (voltam a ser criadas,
 *  com os cabeçalhos atuais, na próxima resposta). Usar antes de abrir aos pais. */
function apagarTodasRespostas() {
  const ui = SpreadsheetApp.getUi()
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const ok = ui.alert('Apagar TODAS as respostas',
    'Vão ser apagadas TODAS as respostas e avaliações de professores (separadores Respostas e Professores). Isto não se pode desfazer. Usar só para limpar os testes antes de abrir o inquérito aos pais. Continuar?',
    ui.ButtonSet.YES_NO)
  if (ok !== ui.Button.YES) return
  ;[SHEET_RESPOSTAS, SHEET_PROFESSORES].forEach(function (n) {
    const sh = ss.getSheetByName(n)
    if (sh) ss.deleteSheet(sh)
  })
  atualizarPainel()
  ss.toast('Todas as respostas foram apagadas.', 'Inquérito')
}

function desenharPaineis_(ss) {
  const ctx = contexto_(ss)
  desenharPainel_(ctx.painel, ctx)
  desenharPainelProf_(ss.getSheetByName(SHEET_PAINEL_PROF) || ss.insertSheet(SHEET_PAINEL_PROF, 1), ctx)
  desenharPainelDir_(ss.getSheetByName(SHEET_PAINEL_DIR) || ss.insertSheet(SHEET_PAINEL_DIR, 2), ctx)
}

/** Lê as respostas e os filtros do Painel: é o que os três painéis desenham. */
function contexto_(ss) {
  const painel = ss.getSheetByName(SHEET_PAINEL) || ss.insertSheet(SHEET_PAINEL, 0)
  const todas = lerRegistos_(ss, SHEET_RESPOSTAS)
  const filtros = lerFiltros_(painel)
  // um filtro que já não existe nos dados (ex.: respostas apagadas) volta a "Todos"
  FILTROS.forEach(function (d) {
    if (filtros[d.coluna] !== TODOS && distintos_(todas, d.coluna).indexOf(filtros[d.coluna]) === -1) filtros[d.coluna] = TODOS
  })
  const passa = passaFiltros_(filtros)
  // avaliações de professores cuja resposta foi apagada da folha Respostas não contam
  const ids = {}
  todas.forEach(function (r) { ids[r.id_resposta] = true })
  const todosProf = lerRegistos_(ss, SHEET_PROFESSORES).filter(function (p) { return ids[p.id_resposta] })
  return {
    painel: painel,
    tz: ss.getSpreadsheetTimeZone(),
    filtros: filtros,
    todas: todas,
    respostas: todas.filter(passa),
    todosProf: todosProf,
    professores: todosProf.filter(passa),
  }
}

const PASTA_RELATORIOS = 'Relatórios do Inquérito'

/**
 * Atualiza os painéis, cria os PDFs (A4, letra a 100%) na pasta "Relatórios do Inquérito"
 * do Google Drive e mostra os links. Os links abrem o visualizador do Google (com o botão
 * de imprimir): uma transferência direta a partir desta janela é bloqueada pelo Chrome.
 */
function criarPdfs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  ss.toast('A atualizar os painéis e a criar os PDFs… (pode demorar meio minuto)', 'Inquérito', 60)
  const lock = LockService.getScriptLock()
  lock.waitLock(30000)
  try {
    desenharPaineis_(ss)
    SpreadsheetApp.flush()
  } finally {
    lock.releaseLock()
  }

  const filtros = descreverFiltros_(lerFiltros_(ss.getSheetByName(SHEET_PAINEL)))
  const quando = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd HH.mm')
  const pasta = pastaRelatorios_(ss)
  let prof = lerProfessor_(ss.getSheetByName(SHEET_PAINEL_PROF))
  if (distintos_(contexto_(ss).todosProf, 'professor').indexOf(prof) === -1) prof = TODOS
  const itens = [
    [SHEET_PAINEL, 'Resultados gerais', true, ''],
    [SHEET_PAINEL_DIR, 'Liderança da escola', true, 'confidencial'],
    prof === TODOS
      ? [SHEET_PAINEL_PROF, 'Avaliação dos professores', false, 'confidencial, A4 deitado']
      : [SHEET_PAINEL_PROF, 'Avaliação: ' + prof, true, 'confidencial'],
  ].map(function (i) {
    const sh = ss.getSheetByName(i[0])
    if (!sh) return ''
    try {
      const pdf = exportarPdf_(ss, sh, i[2]).setName(i[1] + ' — ' + quando + '.pdf')
      const ficheiro = pasta.createFile(pdf)
      return '<a href="' + ficheiro.getUrl() + '" target="_blank"><b>' + i[1] + '</b><span>' + i[0] + (i[3] ? ' · ' + i[3] : '') + '</span></a>'
    } catch (err) {
      console.error('PDF não criado (' + i[0] + '): ' + err)
      return '<div class="erro"><b>' + i[1] + '</b><span>Não foi possível criar o PDF: ' + String(err).replace(/</g, '&lt;') + '</span></div>'
    }
  }).join('')

  const html = '<style>body{font-family:Arial,sans-serif;color:#1f2937;margin:0}p{margin:0 0 12px;font-size:14px;line-height:1.45}' +
    'a,.erro{display:block;margin:0 0 10px;padding:12px 14px;border:1px solid #dbe2ea;border-radius:10px;color:#1c3a63;text-decoration:none}' +
    'a:hover{background:#e8eef6}.erro{border-color:#fecaca;background:#fee2e2;color:#b91c1c}b{display:block;font-size:15px}span{font-size:13px;color:#6b7280}</style>' +
    '<p>Filtros: <b style="display:inline">' + filtros + '</b>. Para mudar, escolha no topo do separador Painel e volte a este menu.</p>' +
    '<p>Clique para abrir o PDF e use o botão de imprimir. Ficam guardados no Google Drive, na pasta <b style="display:inline">' + PASTA_RELATORIOS + '</b>. ' +
    'Os confidenciais são só para os responsáveis da escola.</p>' + itens
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(440).setHeight(400), 'PDF para imprimir')
}

/**
 * Um PDF por professor (relatório individual, A4 ao alto) numa subpasta nova de
 * "Relatórios do Inquérito". Usa os filtros do Painel (recinto, currículo, classe, edição).
 * O cadeado só é pedido para desenhar cada professor: uma resposta que chegue entretanto
 * é gravada sem esperar pelo fim.
 */
function criarPdfsProfessores() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const ui = SpreadsheetApp.getUi()
  const sh = ss.getSheetByName(SHEET_PAINEL_PROF) || ss.insertSheet(SHEET_PAINEL_PROF, 1)
  const ctx = contexto_(ss)
  const nomes = distintos_(ctx.professores, 'professor')
  if (!nomes.length) {
    ui.alert('Não há avaliações de professores para os filtros escolhidos no Painel.')
    return
  }
  ss.toast('A criar ' + nomes.length + ' PDFs (cerca de ' + Math.ceil(nomes.length * 8 / 60) + ' min). Não feche a folha.', 'Inquérito', 300)
  const original = lerProfessor_(sh)
  const quando = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd HH.mm')
  const pasta = pastaRelatorios_(ss).createFolder('Professores — ' + quando)
  const inicio = Date.now(), feitos = [], falhas = []
  try {
    nomes.forEach(function (nome) {
      if (Date.now() - inicio > 4.5 * 60 * 1000) { falhas.push(nome + ' (sem tempo: volte a usar o menu)'); return }
      const lock = LockService.getScriptLock()
      lock.waitLock(30000)
      try {
        desenharPainelProf_(sh, ctx, nome)
        SpreadsheetApp.flush()
      } finally {
        lock.releaseLock()
      }
      try {
        pasta.createFile(exportarPdf_(ss, sh, true).setName(nome + ' — ' + quando + '.pdf'))
        feitos.push(nome)
      } catch (err) {
        console.error('PDF de ' + nome + ' não criado: ' + err)
        falhas.push(nome + ' (' + err + ')')
      }
      Utilities.sleep(1000)
    })
  } finally {
    // o separador volta ao professor (ou "Todos") que estava escolhido
    const lock = LockService.getScriptLock()
    lock.waitLock(30000)
    try { desenharPainelProf_(sh, contexto_(ss), original) } finally { lock.releaseLock() }
  }
  const esc = function (t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;') }
  const html = '<style>body{font-family:Arial,sans-serif;color:#1f2937;margin:0}p{margin:0 0 12px;font-size:14px;line-height:1.45}' +
    'a{display:block;margin:0 0 12px;padding:12px 14px;border:1px solid #dbe2ea;border-radius:10px;color:#1c3a63;text-decoration:none;font-weight:bold}' +
    'a:hover{background:#e8eef6}ul{margin:0;padding-left:18px;font-size:13px;color:#b91c1c}</style>' +
    '<p>Criados <b>' + feitos.length + '</b> de ' + nomes.length + ' PDFs, um por professor, com os filtros: <b>' + esc(descreverFiltros_(ctx.filtros)) + '</b>.</p>' +
    '<a href="' + pasta.getUrl() + '" target="_blank">Abrir a pasta "' + esc(pasta.getName()) + '"</a>' +
    '<p>Os relatórios são confidenciais: só para a Direção e os responsáveis da escola.</p>' +
    (falhas.length ? '<p>Não foi possível criar:</p><ul><li>' + falhas.map(esc).join('</li><li>') + '</li></ul>' : '')
  ui.showModalDialog(HtmlService.createHtmlOutput(html).setWidth(440).setHeight(falhas.length ? 360 : 260), 'PDF de cada professor')
}

/** PDF de um separador, pedido ao Google com a conta de quem usa o menu. */
function exportarPdf_(ss, sh, aoAlto) {
  const url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=pdf&size=A4&fitw=true' +
    '&portrait=' + aoAlto + '&gid=' + sh.getSheetId() +
    '&left_margin=' + A4.margemLado + '&right_margin=' + A4.margemLado + '&top_margin=' + A4.margemTopo + '&bottom_margin=' + A4.margemTopo +
    '&gridlines=false&printtitle=false&sheetnames=false&pagenum=CENTER&horizontal_alignment=CENTER&fzr=false'
  const pedido = { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true }
  // O Google limita pedidos seguidos: se recusar, espera e tenta outra vez
  for (let tentativa = 1; ; tentativa++) {
    const res = UrlFetchApp.fetch(url, pedido)
    if (res.getResponseCode() === 200) return res.getBlob()
    if (tentativa >= 3) throw new Error('o Google respondeu ' + res.getResponseCode())
    Utilities.sleep(3000 * tentativa)
  }
}

/** Pasta "Relatórios do Inquérito" ao lado desta folha no Drive (criada na primeira vez). */
function pastaRelatorios_(ss) {
  const pais = DriveApp.getFileById(ss.getId()).getParents()
  const pai = pais.hasNext() ? pais.next() : DriveApp.getRootFolder()
  const existentes = pai.getFoldersByName(PASTA_RELATORIOS)
  return existentes.hasNext() ? existentes.next() : pai.createFolder(PASTA_RELATORIOS)
}


// ---------------------------------------------------------------------
// Leitura e contas
// ---------------------------------------------------------------------

function lerRegistos_(ss, nome) {
  const sh = ss.getSheetByName(nome)
  if (!sh || sh.getLastRow() < 2) return []
  const valores = sh.getDataRange().getValues()
  const cab = valores.shift()
  return valores.map(function (linha) {
    const r = {}
    cab.forEach(function (c, i) { r[c] = linha[i] })
    return r
  }).filter(function (r) { return r.id_resposta !== '' })
}

function lerFiltros_(sh) {
  const f = {}
  FILTROS.forEach(function (d, i) {
    const v = sh.getLastRow() >= LINHA_FILTROS ? String(sh.getRange(LINHA_FILTROS, BLOCOS[i][0]).getValue()) : ''
    f[d.coluna] = v || TODOS
  })
  return f
}

function passaFiltros_(f) {
  return function (r) {
    return FILTROS.every(function (d) { return f[d.coluna] === TODOS || String(r[d.coluna]) === f[d.coluna] })
  }
}

function descreverFiltros_(f) {
  const ativos = FILTROS.filter(function (d) { return f[d.coluna] !== TODOS }).map(function (d) { return f[d.coluna] })
  return ativos.length ? ativos.join(' · ') : 'todas as respostas'
}

function distintos_(registos, campo, ordem) {
  ordem = ordem || ORDEM[campo]
  const v = []
  registos.forEach(function (r) {
    const x = String(r[campo])
    if (x !== '' && v.indexOf(x) === -1) v.push(x)
  })
  return v.sort(function (a, b) {
    if (ordem && (ordem.indexOf(a) !== -1 || ordem.indexOf(b) !== -1)) {
      const ia = ordem.indexOf(a), ib = ordem.indexOf(b)
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
    }
    return a.localeCompare(b, 'pt', { numeric: true })
  })
}

function nota_(v) { return typeof v === 'number' && v >= 1 && v <= 5 ? v : null }

/** Média, % de satisfeitos (4 ou 5) e nº de notas, sem contar "Não sei". */
function estatistica_(registos, colunas) {
  let soma = 0, n = 0, nSat = 0, pessoas = 0
  registos.forEach(function (r) {
    let respondeu = false
    colunas.forEach(function (c) {
      const v = nota_(r[c])
      if (v === null) return
      soma += v; n++; respondeu = true
      if (v >= 4) nSat++
    })
    if (respondeu) pessoas++
  })
  return { media: n ? soma / n : '', satisfeitos: n ? nSat / n : '', n: n, soma: soma, nSat: nSat, pessoas: pessoas }
}

function estatisticaArea_(area, R, P) {
  return estatistica_(area.professores ? P : R, Object.keys(area.colunas))
}

function estatisticaGeral_(R, P) {
  const a = estatistica_(R, colunasDe_(AREAS)), b = estatistica_(P, Object.keys(PERGUNTAS_PROF))
  const n = a.n + b.n
  return { media: n ? (a.soma + b.soma) / n : '', satisfeitos: n ? (a.nSat + b.nSat) / n : '' }
}

function colunasDe_(areas) {
  return areas.reduce(function (lista, a) { return lista.concat(Object.keys(a.colunas)) }, [])
}

/** Recomendação 0–10 e NPS (% promotores 9–10 menos % críticos 0–6). */
function recomendacao_(registos) {
  const v = registos.map(function (r) { return r.recomendacao_0_10 }).filter(function (x) { return typeof x === 'number' })
  const conta = function (min, max) { return v.filter(function (x) { return x >= min && x <= max }).length }
  const n = v.length, p = conta(9, 10), d = conta(0, 6)
  return {
    n: n,
    media: n ? v.reduce(function (a, b) { return a + b }, 0) / n : '',
    promotores: p, neutros: n - p - d, criticos: d,
    nps: n ? Math.round((p - d) / n * 100) : '',
  }
}

// ---------------------------------------------------------------------
// Grelha: junta valores e estilos e escreve tudo de uma vez
// ---------------------------------------------------------------------

const ESTILOS = {
  cartao: function (r) { r.setBackground(COR.cartao).setHorizontalAlignment('center') },
  filtro: function (r) { r.setBackground(COR.azulSuave).setFontSize(11).setFontWeight('bold').setFontColor(COR.azul).setHorizontalAlignment('center') },
  titulo: function (r) { r.setFontSize(20).setFontWeight('bold').setFontColor(COR.azul) },
  subtitulo: function (r) { r.setFontColor(COR.cinza).setWrap(true).setVerticalAlignment('top') },
  rotulo: function (r) { r.setFontSize(10).setFontWeight('bold').setFontColor(COR.cinza).setVerticalAlignment('bottom') },
  cartaoValor: function (r) { r.setFontSize(24).setFontWeight('bold').setFontColor(COR.azul) },
  nota: function (r) { r.setFontSize(10).setFontColor(COR.cinza).setWrap(true).setVerticalAlignment('top') },
  secao: function (r) { r.setFontSize(14).setFontWeight('bold').setFontColor(COR.azul).setVerticalAlignment('bottom').setBorder(null, null, true, null, null, null, COR.azul, SpreadsheetApp.BorderStyle.SOLID_MEDIUM) },
  subsecao: function (r) { r.setFontWeight('bold').setFontColor(COR.azul).setVerticalAlignment('bottom') },
  cabecalho: function (r) { r.setFontSize(10).setFontWeight('bold').setFontColor(COR.cinza).setWrap(true).setVerticalAlignment('bottom') },
  linha: function (r) { r.setBorder(null, null, true, null, null, null, COR.linha, SpreadsheetApp.BorderStyle.SOLID) },
  centro: function (r) { r.setHorizontalAlignment('center') },
  inteiro: function (r) { r.setNumberFormat('0').setHorizontalAlignment('center') },
  media: function (r) { r.setNumberFormat('0.0').setFontWeight('bold').setHorizontalAlignment('center') },
  pct: function (r) { r.setNumberFormat('0%').setHorizontalAlignment('center') },
  nps: function (r) { r.setNumberFormat('+0;-0;0').setFontWeight('bold').setHorizontalAlignment('center') },
  forte: function (r) { r.setFontWeight('bold') },
  poucos: function (r) { r.setFontColor(COR.cinza).setFontStyle('italic') },
  envolver: function (r) { r.setWrap(true) },
  quebra: function (r) { r.setWrap(true).setVerticalAlignment('top') },
  meta: function (r) { r.setFontSize(10).setFontColor(COR.cinza) },
  rodape: function (r) { r.setFontSize(10).setFontStyle('italic').setFontColor(COR.cinza).setWrap(true).setVerticalAlignment('top') },
  margem: function (r) { r.setBorder(null, true, null, true, null, null, '#ffffff', SpreadsheetApp.BorderStyle.SOLID_THICK) },
}

/** largura: px disponíveis para o texto das colunas B… (para estimar as linhas de texto). */
function novaGrelha_(colunas, largura) {
  const g = { colunas: colunas, largura: largura || 700, linhas: [], alturas: [], estilos: {}, unioes: [], gradientes: [], formatos: [], secoes: [] }
  g.linha = function (valores, altura) {
    const l = []
    for (let c = 1; c <= colunas; c++) l.push(valores && valores[c] !== undefined ? valores[c] : '')
    g.linhas.push(l)
    g.alturas.push(altura || 24)
    return g.linhas.length
  }
  g.estilo = function (nome, a1) { (g.estilos[nome] = g.estilos[nome] || []).push(a1); return g }
  g.unir = function (a1) { g.unioes.push(a1); return g }
  return g
}

function letra_(c) {
  let s = ''
  while (c > 0) { s = String.fromCharCode(65 + (c - 1) % 26) + s; c = Math.floor((c - 1) / 26) }
  return s
}

/** a1_(5, 2, 4) → "B5:D5"; a1_(5, 2, 4, 7) → "B5:D7" */
function a1_(linha, c1, c2, linha2) {
  const fim = (c2 && c2 !== c1) || (linha2 && linha2 !== linha) ? ':' + letra_(c2 || c1) + (linha2 || linha) : ''
  return letra_(c1) + linha + fim
}

/** Folha A4 com as margens do PDF (polegadas): largura e altura úteis. */
const A4 = { largura: 8.27, altura: 11.69, margemLado: 0.4, margemTopo: 0.5 }

/**
 * Quebras de página: se uma secção não cabe no resto da página mas cabe numa página
 * inteira, a linha de espaço antes dela cresce até ao fim da página e a secção começa
 * na seguinte. O PDF ajusta a largura das colunas à folha, por isso a altura útil
 * em px é proporcional à largura total das colunas (medido num PDF real: 718 px de
 * largura → 1028 px de altura; o número de página fica na margem e não ocupa espaço).
 * A linha de espaço tem de acabar um pouco ANTES do fim real da página: se passar,
 * salta inteira para a página seguinte e deixa-a em branco no topo; se ficar mais de
 * 30 px antes, o título da secção ainda cabe e fica sozinho no fundo da página.
 */
function paginar_(g, larguraPx, paisagem) {
  const w = (paisagem ? A4.altura : A4.largura) - 2 * A4.margemLado
  const h = (paisagem ? A4.largura : A4.altura) - 2 * A4.margemTopo
  const pagina = larguraPx * h / w - 12
  const inicio = {}
  g.secoes.forEach(function (r) { inicio[r - 1] = true })
  let y = 0
  for (let i = 0; i < g.alturas.length; i++) {
    if (inicio[i] && y > 0) {
      let fim = i + 1
      while (fim < g.alturas.length && !inicio[fim]) fim++
      const altura = g.alturas.slice(i, fim).reduce(function (a, b) { return a + b }, 0)
      if (altura <= pagina && y + altura > pagina) {
        g.alturas[i] = Math.max(2, Math.floor(pagina - y))
        y = 0
        continue
      }
    }
    y = y + g.alturas[i] > pagina ? g.alturas[i] : y + g.alturas[i]
  }
}

/** Altura de uma linha com texto que pode ocupar várias linhas. */
function alturaTexto_(texto, larguraPx, minimo, tamanho) {
  const porLinha = Math.max(10, Math.floor(larguraPx / ((tamanho || 10) * 0.62)))
  const linhas = String(texto).split('\n').reduce(function (n, parte) { return n + Math.max(1, Math.ceil(parte.length / porLinha)) }, 0)
  return Math.max(minimo || 26, linhas * Math.round((tamanho || 10) * 1.6) + 10)
}

/** Nota ou rodapé numa linha própria, a toda a largura, com quebra de linha. */
function notaLinha_(g, estilo, texto) {
  const r = g.linha({ 2: texto }, alturaTexto_(texto, g.largura, 22))
  g.unir(a1_(r, 2, g.colunas)).estilo(estilo, a1_(r, 2, g.colunas))
  return r
}

function aplicarGrelha_(sh, g, larguras, paisagem) {
  paginar_(g, larguras.reduce(function (a, b) { return a + b }, 0), paisagem)
  const n = g.linhas.length, c = g.colunas
  sh.showColumns(1, sh.getMaxColumns())
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart().clear().clearDataValidations()
  sh.setConditionalFormatRules([])
  if (sh.getMaxRows() < n) sh.insertRowsAfter(sh.getMaxRows(), n - sh.getMaxRows())
  if (sh.getMaxColumns() < c) sh.insertColumnsAfter(sh.getMaxColumns(), c - sh.getMaxColumns())
  if (sh.getMaxRows() > n + 2) sh.deleteRows(n + 3, sh.getMaxRows() - n - 2)
  if (sh.getMaxColumns() > c) sh.hideColumns(c + 1, sh.getMaxColumns() - c)
  sh.setHiddenGridlines(true)
  larguras.forEach(function (w, i) { sh.setColumnWidth(i + 1, w) })

  sh.getRange(1, 1, sh.getMaxRows(), c).setFontFamily(FONTE).setFontSize(10).setFontColor(COR.texto).setVerticalAlignment('middle')
  sh.getRange(1, 1, n, c).setValues(g.linhas)
  g.unioes.forEach(function (a1) { sh.getRange(a1).merge() })
  Object.keys(ESTILOS).forEach(function (nome) {
    if (g.estilos[nome]) ESTILOS[nome](sh.getRangeList(g.estilos[nome]))
  })
  g.formatos.forEach(function (f) { sh.getRange(f.a1).setNumberFormat(f.formato) })

  // alturas das linhas, agrupando as seguidas que são iguais
  let inicio = 0
  for (let i = 1; i <= n; i++) {
    if (i === n || g.alturas[i] !== g.alturas[inicio]) {
      sh.setRowHeights(inicio + 1, i - inicio, g.alturas[inicio])
      inicio = i
    }
  }

  if (g.gradientes.length) {
    const T = SpreadsheetApp.InterpolationType.NUMBER
    sh.setConditionalFormatRules([SpreadsheetApp.newConditionalFormatRule()
      .setGradientMinpointWithValue(COR.vermelhoSuave, T, '1')
      .setGradientMidpointWithValue(COR.ambarSuave, T, '3')
      .setGradientMaxpointWithValue(COR.verdeSuave, T, '5')
      .setRanges(sh.getRangeList(g.gradientes).getRanges())
      .build()])
  }
}

function corNota_(v) { return v >= 4 ? COR.verde : v >= 3 ? COR.ambar : COR.vermelho }

function barra_(v, max, cor) {
  if (typeof v !== 'number') return ''
  // A fórmula é lida no formato regional da folha: com vírgula decimal (ex.: pt_MZ),
  // os argumentos separam-se com ";" e as colunas de uma lista {…} com "\"
  const virgula = usaVirgulaDecimal_()
  const arg = virgula ? ';' : ',', col = virgula ? '\\' : ','
  const num = function (x) { return virgula ? String(x).replace('.', ',') : String(x) }
  return '=SPARKLINE({' + num(v.toFixed(3)) + '}' + arg +
    '{"charttype"' + col + '"bar";"max"' + col + num(max) + ';"color1"' + col + '"' + cor + '"})'
}

let virgulaDecimal_
function usaVirgulaDecimal_() {
  if (virgulaDecimal_ === undefined) {
    const loc = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetLocale()
    const ponto = /^(en|ja|zh|ko|th|iw|he|hi|ms|fil|tl|ga)(_|$)|^(es_MX|es_US|de_CH|fr_CH|it_CH)$/
    virgulaDecimal_ = !ponto.test(loc)
  }
  return virgulaDecimal_
}

function pct_(n, total) { return total ? Math.round(n / total * 100) + '%' : '—' }

function espaco_(g, altura) { g.linha({}, altura || 14) }

function titulo_(g, texto, sub, ultima) {
  espaco_(g, 16)
  const r = g.linha({ 2: texto }, 36)
  g.estilo('titulo', a1_(r, 2))
  const rs = g.linha({ 2: sub }, alturaTexto_(sub, g.largura * 0.8, 22))
  g.unir(a1_(rs, 2, ultima - 1)).estilo('subtitulo', a1_(rs, 2, ultima - 1))
  // emblema do colégio no canto direito
  g.linhas[r - 1][ultima - 1] = '=IMAGE("' + EMBLEMA_URL + '")'
  g.unir(a1_(r, ultima, ultima, rs))
}

function secao_(g, texto, ultima) {
  espaco_(g, 22)
  g.secoes.push(g.linhas.length)
  g.estilo('secao', a1_(g.linha({ 2: texto }, 30), 2, ultima))
}

function cabecalho_(g, nomes, ultima, primeiraNum) {
  // nomes compridos (ex.: "Full Cambridge" numa coluna estreita) passam a duas linhas
  const longo = Object.keys(nomes).some(function (k) { return k > 2 && String(nomes[k]).length > 11 })
  const r = g.linha(nomes, longo ? 40 : 26)
  g.estilo('cabecalho', a1_(r, 2, ultima)).estilo('centro', a1_(r, primeiraNum, ultima)).estilo('linha', a1_(r, 2, ultima))
  return r
}

/** Linha com média (1–5), barra colorida, % satisfeitos e nº de respostas. */
function linhaNota_(g, rotulo, e, forte) {
  const r = g.linha({ 2: rotulo, 3: e.media, 4: barra_(e.media, 5, corNota_(e.media)), 7: e.satisfeitos, 8: e.n }, alturaTexto_(rotulo, LARGURA_ROTULO))
  g.unir(a1_(r, 4, 6))
  g.estilo('envolver', a1_(r, 2)).estilo('linha', a1_(r, 2, 8)).estilo('media', a1_(r, 3)).estilo('pct', a1_(r, 7)).estilo('centro', a1_(r, 8))
  if (forte) g.estilo('forte', a1_(r, 2))
  g.gradientes.push(a1_(r, 3))
}

/** Linha com contagem, barra e percentagem do total. */
function linhaContagem_(g, rotulo, n, total, cor) {
  const pct = total ? n / total : 0
  const r = g.linha({ 2: rotulo, 3: n, 4: barra_(pct, 1, cor || COR.azul), 7: pct }, alturaTexto_(rotulo, LARGURA_ROTULO))
  g.unir(a1_(r, 4, 6))
  g.estilo('envolver', a1_(r, 2)).estilo('linha', a1_(r, 2, 8)).estilo('inteiro', a1_(r, 3)).estilo('pct', a1_(r, 7))
}

/** Quatro cartões (rótulo, número grande, nota) nas colunas B, C:D, E:F e G:H. */
function cartoes_(g, cartoes) {
  const l1 = {}, l2 = {}, l3 = {}
  cartoes.forEach(function (k, i) {
    const c = BLOCOS[i][0]
    l1[c] = k.rotulo; l2[c] = typeof k.valor === 'number' ? k.valor : '—'; l3[c] = k.nota
  })
  const r1 = g.linha(l1, 28), r2 = g.linha(l2, 46), r3 = g.linha(l3, 40)
  BLOCOS.forEach(function (b, i) {
    ;[r1, r2, r3].forEach(function (r) { g.unir(a1_(r, b[0], b[1])) })
    g.estilo('cartao', a1_(r1, b[0], b[1], r3)).estilo('margem', a1_(r1, b[0], b[1], r3))
    g.estilo('rotulo', a1_(r1, b[0], b[1])).estilo('cartaoValor', a1_(r2, b[0], b[1])).estilo('nota', a1_(r3, b[0], b[1])).estilo('centro', a1_(r3, b[0], b[1]))
    g.formatos.push({ a1: a1_(r2, b[0]), formato: cartoes[i].formato })
  })
}

/** Linha com a média de uma pergunta, barra, média da escola para comparar e nº de respostas. */
function linhaComparada_(g, rotulo, e, escola, forte) {
  const r = g.linha({ 2: rotulo, 3: e.media, 4: barra_(e.media, 5, corNota_(e.media)), 7: escola, 8: e.n }, alturaTexto_(rotulo, LARGURA_ROTULO))
  g.unir(a1_(r, 4, 6))
  g.estilo('envolver', a1_(r, 2)).estilo('linha', a1_(r, 2, 8)).estilo('media', a1_(r, 3)).estilo('media', a1_(r, 7)).estilo('centro', a1_(r, 8))
  if (forte) g.estilo('forte', a1_(r, 2))
  g.gradientes.push(a1_(r, 3))
}

function atualizadoEm_(ctx) {
  return Utilities.formatDate(new Date(), ctx.tz, 'dd/MM/yyyy HH:mm')
}

// ---------------------------------------------------------------------
// Separador "Painel"
// ---------------------------------------------------------------------

function desenharPainel_(sh, ctx) {
  const R = ctx.respostas, P = ctx.professores
  const g = novaGrelha_(8, LARGURA_TEXTO)

  titulo_(g, 'Inquérito aos Encarregados de Educação',
    'Colégio Dzovo  ·  ' + descreverFiltros_(ctx.filtros) + '  ·  atualizado em ' + atualizadoEm_(ctx), 8)
  espaco_(g, 12)

  // filtros
  const rotulos = {}, valores = {}
  FILTROS.forEach(function (d, i) {
    rotulos[BLOCOS[i][0]] = d.nome
    valores[BLOCOS[i][0]] = ctx.filtros[d.coluna]
  })
  const rRot = g.linha(rotulos, 18), rFil = g.linha(valores, 30)
  if (rFil !== LINHA_FILTROS) throw new Error('A linha dos filtros tem de ser a ' + LINHA_FILTROS)
  BLOCOS.forEach(function (b) {
    g.unir(a1_(rRot, b[0], b[1])).unir(a1_(rFil, b[0], b[1]))
    g.estilo('rotulo', a1_(rRot, b[0], b[1])).estilo('centro', a1_(rRot, b[0], b[1]))
    g.estilo('filtro', a1_(rFil, b[0], b[1])).estilo('margem', a1_(rRot, b[0], b[1], rFil))
  })
  notaLinha_(g, 'nota', 'Escolha nos campos acima para filtrar os resultados. "Todos" mostra tudo.')
  espaco_(g, 10)

  // cartões
  const geral = estatisticaGeral_(R, P), rec = recomendacao_(R)
  const cartoes = [
    { rotulo: 'Respostas', valor: R.length, formato: '0',
      nota: R.length === ctx.todas.length ? 'encarregados responderam' : 'de ' + ctx.todas.length + ' no total' },
    { rotulo: 'Satisfação média', valor: geral.media, formato: '0.0" / 5"',
      nota: typeof geral.satisfeitos === 'number' ? Math.round(geral.satisfeitos * 100) + '% de notas 4 ou 5' : 'sem notas' },
    { rotulo: 'Recomendação', valor: rec.media, formato: '0.0" / 10"', nota: 'recomendaria a escola?' },
    { rotulo: 'NPS', valor: rec.nps, formato: '+0;-0;0',
      nota: rec.n ? pct_(rec.promotores, rec.n) + ' promotores · ' + pct_(rec.criticos, rec.n) + ' críticos' : 'sem respostas' },
  ]
  cartoes_(g, cartoes)

  if (!R.length) {
    secao_(g, 'Ainda não há respostas para estes filtros.', 8)
    aplicarGrelha_(sh, g, LARGURAS_PAINEL)
    validarFiltros_(sh, ctx)
    return
  }

  const todasAreas = AREAS.concat([AREA_PROF])

  // satisfação por área
  secao_(g, 'Satisfação por área', 8)
  cabecalho_(g, { 2: 'Área', 3: 'Média', 7: 'Satisfeitos', 8: 'Respostas' }, 8, 3)
  todasAreas.forEach(function (a) {
    const e = estatisticaArea_(a, R, P)
    linhaNota_(g, a.nome, { media: e.media, satisfeitos: e.satisfeitos, n: e.pessoas })
  })
  notaLinha_(g, 'nota', 'O detalhe da Direção está no separador "' + SHEET_PAINEL_DIR + '" (confidencial).')

  // pontos fortes e a melhorar
  const perguntas = []
  todasAreas.forEach(function (a) {
    if (a.confidencial) return
    Object.keys(a.colunas).forEach(function (c) {
      if (/_geral$/.test(c)) return
      const e = estatistica_(a.professores ? P : R, [c])
      if (e.n) perguntas.push({ rotulo: a.colunas[c] + '  ·  ' + a.curto, e: e })
    })
  })
  perguntas.sort(function (x, y) { return y.e.media - x.e.media })
  const k = Math.min(3, Math.floor(perguntas.length / 2))
  if (k > 0) {
    secao_(g, 'Pontos mais fortes', 8)
    cabecalho_(g, { 2: 'Pergunta', 3: 'Média', 7: 'Satisfeitos', 8: 'Respostas' }, 8, 3)
    perguntas.slice(0, k).forEach(function (p) { linhaNota_(g, p.rotulo, p.e) })
    secao_(g, 'Pontos a melhorar', 8)
    cabecalho_(g, { 2: 'Pergunta', 3: 'Média', 7: 'Satisfeitos', 8: 'Respostas' }, 8, 3)
    perguntas.slice(-k).reverse().forEach(function (p) { linhaNota_(g, p.rotulo, p.e) })
  }

  // recomendação
  if (rec.n) {
    secao_(g, 'Recomendaria a escola a outras famílias? (0 a 10)', 8)
    cabecalho_(g, { 2: 'Grupo', 3: 'Pais', 7: '%' }, 8, 3)
    linhaContagem_(g, 'Promotores (9–10)', rec.promotores, rec.n, COR.verde)
    linhaContagem_(g, 'Neutros (7–8)', rec.neutros, rec.n, COR.ambar)
    linhaContagem_(g, 'Críticos (0–6)', rec.criticos, rec.n, COR.vermelho)
    notaLinha_(g, 'nota', 'NPS = % promotores − % críticos. Vai de −100 a +100: acima de 0 é positivo, acima de 50 é excelente.')
  }

  // comparação entre recintos e currículos
  const grupos = [{ nome: 'Geral', R: R, P: P }]
  ;['recinto', 'curriculo'].forEach(function (campo) {
    const v = distintos_(R, campo)
    if (v.length < 2) return
    v.forEach(function (x) {
      grupos.push({
        nome: x.replace('Currículo ', ''),
        R: R.filter(function (r) { return String(r[campo]) === x }),
        P: P.filter(function (p) { return String(p[campo]) === x }),
      })
    })
  })
  if (grupos.length > 1) {
    const gs = grupos.slice(0, 6), ultimaG = 2 + gs.length
    secao_(g, 'Comparação entre recintos e currículos', 8)
    const cab = { 2: 'Área' }
    gs.forEach(function (gr, i) { cab[3 + i] = gr.nome })
    cabecalho_(g, cab, 8, 3)
    todasAreas.forEach(function (a) {
      const v = { 2: a.nome }
      gs.forEach(function (gr, i) { v[3 + i] = estatisticaArea_(a, gr.R, gr.P).media })
      const r = g.linha(v, 26)
      g.estilo('linha', a1_(r, 2, 8)).estilo('media', a1_(r, 3, ultimaG))
      g.gradientes.push(a1_(r, 3, ultimaG))
    })
    const lRec = { 2: 'Recomendação (0–10)' }, lNps = { 2: 'NPS' }, lN = { 2: 'Respostas' }
    gs.forEach(function (gr, i) {
      const rc = recomendacao_(gr.R)
      lRec[3 + i] = rc.media; lNps[3 + i] = rc.nps; lN[3 + i] = gr.R.length
    })
    let r = g.linha(lRec, 26); g.estilo('linha', a1_(r, 2, 8)).estilo('media', a1_(r, 3, ultimaG))
    r = g.linha(lNps, 26); g.estilo('linha', a1_(r, 2, 8)).estilo('nps', a1_(r, 3, ultimaG))
    r = g.linha(lN, 26); g.estilo('linha', a1_(r, 2, 8)).estilo('inteiro', a1_(r, 3, ultimaG))
  }

  // detalhe por pergunta
  todasAreas.forEach(function (a) {
    if (a.confidencial) return
    secao_(g, a.nome + ' — por pergunta', 8)
    cabecalho_(g, { 2: 'Pergunta', 3: 'Média', 7: 'Satisfeitos', 8: 'Respostas' }, 8, 3)
    Object.keys(a.colunas).forEach(function (c) {
      linhaNota_(g, a.colunas[c], estatistica_(a.professores ? P : R, [c]), /_geral$/.test(c))
    })
  })

  // educação cristã: o que os pais notaram no educando
  const dev = Object.keys(DESENVOLVIMENTO).map(function (c) {
    const conta = OPCOES_DEV.map(function (o) { return R.filter(function (r) { return String(r[c]) === o }).length })
    return { rotulo: DESENVOLVIMENTO[c], conta: conta, n: conta.reduce(function (a, b) { return a + b }, 0) }
  }).filter(function (d) { return d.n })
  // educação cristã: famílias cristãs / não cristãs e o respeito pela fé de cada uma
  const familias = distintos_(R.filter(function (r) { return r.ec_familia !== undefined }), 'ec_familia', OPCOES_FAMILIA)
  if (familias.length) {
    secao_(g, 'Educação Cristã — a família é cristã?', 8)
    cabecalho_(g, { 2: 'Resposta', 3: 'Pais', 7: '%' }, 8, 3)
    const nFam = R.filter(function (r) { return String(r.ec_familia || '') !== '' }).length
    familias.forEach(function (f) {
      linhaContagem_(g, f, R.filter(function (r) { return String(r.ec_familia) === f }).length, nFam)
    })
    g.estilo('subsecao', a1_(g.linha({ 2: 'Respeito pela fé de cada família, por grupo' }, 26), 2))
    cabecalho_(g, { 2: 'Grupo', 3: 'Média', 7: 'Satisfeitos', 8: 'Respostas' }, 8, 3)
    familias.forEach(function (f) {
      linhaNota_(g, f, estatistica_(R.filter(function (r) { return String(r.ec_familia) === f }), ['ec_respeito']))
    })
    notaLinha_(g, 'nota', 'Só as famílias que responderam "Sim" veem as perguntas sobre as aulas; as outras podem responder ao respeito pela fé e deixar observações.')
  }
  if (dev.length) {
    secao_(g, 'Educação Cristã — o que os pais notaram no educando', 8)
    cabecalho_(g, { 2: 'Pergunta', 3: 'Sim, muito', 4: 'Um pouco', 5: 'Não notei', 6: 'Não sei', 7: 'Notaram', 8: 'Respostas' }, 8, 3)
    dev.forEach(function (d) {
      const sabem = d.n - d.conta[3]
      const v = { 2: d.rotulo, 7: sabem ? (d.conta[0] + d.conta[1]) / sabem : '', 8: d.n }
      d.conta.forEach(function (x, i) { v[3 + i] = x / d.n })
      const r = g.linha(v, 26)
      g.estilo('linha', a1_(r, 2, 8)).estilo('pct', a1_(r, 3, 7)).estilo('forte', a1_(r, 7)).estilo('centro', a1_(r, 8))
    })
    notaLinha_(g, 'nota', '"Notaram" = Sim, muito + Um pouco, sem contar quem respondeu "Não sei". Filtre por classe ou recinto no topo.')
  }

  // melhorias prioritárias
  const votos = {}
  R.forEach(function (r) {
    String(r.melhorias_prioritarias || '').split(';').forEach(function (m) {
      m = m.trim()
      if (m) votos[m] = (votos[m] || 0) + 1
    })
  })
  const melhorias = Object.keys(votos).sort(function (a, b) { return votos[b] - votos[a] })
  if (melhorias.length) {
    secao_(g, 'Melhorias prioritárias (cada encarregado escolhe até 3)', 8)
    cabecalho_(g, { 2: 'Área a melhorar', 3: 'Votos', 7: '% dos pais' }, 8, 3)
    melhorias.forEach(function (m) { linhaContagem_(g, m, votos[m], R.length) })
  }

  // quem respondeu
  secao_(g, 'Quem respondeu', 8)
  cabecalho_(g, { 3: 'Respostas', 7: '%' }, 8, 3)
  ;[['recinto', 'Recinto'], ['curriculo', 'Currículo'], ['classe', 'Classe'], ['tempo_na_escola', 'Tempo na escola']].forEach(function (d) {
    g.estilo('subsecao', a1_(g.linha({ 2: d[1] }, 26), 2))
    distintos_(R, d[0]).forEach(function (v) {
      linhaContagem_(g, v, R.filter(function (r) { return String(r[d[0]]) === v }).length, R.length)
    })
  })

  // comentários
  const comentarios = []
  R.forEach(function (r) {
    Object.keys(TEXTOS_ABERTOS).forEach(function (c) {
      const t = String(r[c] || '').trim()
      if (t) comentarios.push({ data: r.data_hora, recinto: r.recinto, tipo: TEXTOS_ABERTOS[c], texto: t })
    })
  })
  const tempo = function (d) { return d instanceof Date ? d.getTime() : 0 }
  comentarios.sort(function (a, b) { return tempo(b.data) - tempo(a.data) })
  if (comentarios.length) {
    secao_(g, 'Comentários mais recentes', 8)
    comentarios.slice(0, 15).forEach(function (c) {
      const meta = (c.data instanceof Date ? Utilities.formatDate(c.data, ctx.tz, 'dd/MM') + ' · ' : '') + c.recinto + '\n' + c.tipo
      const r = g.linha({ 2: meta, 3: clean_(c.texto) }, Math.max(alturaTexto_(c.texto, LARGURA_TEXTO - LARGURAS_PAINEL[1]), alturaTexto_(meta, LARGURA_ROTULO, 42)))
      g.unir(a1_(r, 3, 8))
      g.estilo('meta', a1_(r, 2)).estilo('quebra', a1_(r, 2, 8)).estilo('linha', a1_(r, 2, 8))
    })
    if (comentarios.length > 15) {
      notaLinha_(g, 'nota', 'Mais ' + (comentarios.length - 15) + ' comentários na folha Respostas.')
    }
  }

  espaco_(g, 18)
  notaLinha_(g, 'rodape', 'Notas de 1 (muito insatisfeito) a 5 (muito satisfeito). "Satisfeitos" = notas 4 e 5.')
  notaLinha_(g, 'rodape', 'As respostas "Não sei" não entram nas contas. Os dados de contacto nunca aparecem neste painel.')

  aplicarGrelha_(sh, g, LARGURAS_PAINEL)
  validarFiltros_(sh, ctx)
}

function validarFiltros_(sh, ctx) {
  FILTROS.forEach(function (d, i) {
    const opcoes = [TODOS].concat(distintos_(ctx.todas, d.coluna))
    sh.getRange(LINHA_FILTROS, BLOCOS[i][0]).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(opcoes, true).setAllowInvalid(false).build())
  })
}

// ---------------------------------------------------------------------
// Separador "Painel Professores" (confidencial)
// ---------------------------------------------------------------------

/** Linha do campo "Professor(a)" no separador Painel Professores (coluna B). */
const LINHA_FILTRO_PROF = 6

function lerProfessor_(sh) {
  if (!sh || sh.getLastRow() < LINHA_FILTRO_PROF) return TODOS
  return String(sh.getRange(LINHA_FILTRO_PROF, 2).getValue()) || TODOS
}

/**
 * Com "Todos": tabela de todos os professores (A4 deitado).
 * Com um nome: relatório individual desse professor (A4 ao alto).
 * professor: opcional; sem ele, usa o nome escolhido no próprio separador.
 */
function desenharPainelProf_(sh, ctx, professor) {
  const nomes = distintos_(ctx.todosProf, 'professor')
  let escolhido = professor || lerProfessor_(sh)
  if (escolhido !== TODOS && nomes.indexOf(escolhido) === -1) escolhido = TODOS

  const individual = escolhido !== TODOS
  const colunas = Object.keys(PERGUNTAS_PROF)
  const ultima = individual ? 8 : 6 + colunas.length // tabela: B–E dados, F… perguntas, última = barra
  const g = novaGrelha_(ultima, individual ? LARGURA_TEXTO : 1000)
  const sub = 'CONFIDENCIAL — apenas para a Direção e os responsáveis da escola  ·  ' + descreverFiltros_(ctx.filtros) + '  ·  atualizado em ' + atualizadoEm_(ctx)
  titulo_(g, individual ? escolhido : 'Avaliação dos professores', sub, ultima)
  espaco_(g, 12)

  // campo "Professor(a)"
  const rRot = g.linha({ 2: 'Professor(a)' }, 18), rFil = g.linha({ 2: escolhido }, 30)
  if (rFil !== LINHA_FILTRO_PROF) throw new Error('A linha do campo Professor(a) tem de ser a ' + LINHA_FILTRO_PROF)
  g.unir(a1_(rRot, 2, 4)).unir(a1_(rFil, 2, 4))
  g.estilo('rotulo', a1_(rRot, 2, 4)).estilo('filtro', a1_(rFil, 2, 4))
  notaLinha_(g, 'nota', individual
    ? 'Escolha "Todos" no campo acima para ver a tabela de todos os professores. Os outros filtros (recinto, currículo, classe, edição) escolhem-se no separador Painel.'
    : 'Escolha um nome no campo acima para ver o relatório individual, com os comentários dos pais. Os outros filtros escolhem-se no separador Painel.')

  if (individual) desenharProfessor_(g, ctx, escolhido)
  else desenharTabelaProf_(g, ctx, colunas, ultima)

  if (individual) {
    aplicarGrelha_(sh, g, LARGURAS_PAINEL)
  } else {
    // A4 deitado: as colunas somam ≈ 1028 px, a largura útil da folha
    const larguras = [12, 170, 110, 160, 72]
    colunas.forEach(function () { larguras.push(68) })
    larguras.push(96)
    aplicarGrelha_(sh, g, larguras, true)
  }
  sh.getRange(LINHA_FILTRO_PROF, 2).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList([TODOS].concat(nomes), true).setAllowInvalid(false).build())
}

function desenharTabelaProf_(g, ctx, colunas, ultima) {
  const P = ctx.professores
  const grupos = {}
  P.forEach(function (p) {
    // um professor = uma linha por disciplina, mesmo que dê aulas em várias classes (ex.: Francês)
    const k = [p.professor, p.disciplina].join('|')
    if (!grupos[k]) grupos[k] = { p: p, regs: [], classes: [], recintos: [] }
    grupos[k].regs.push(p)
    if (grupos[k].classes.indexOf(String(p.classe)) === -1) grupos[k].classes.push(String(p.classe))
    if (grupos[k].recintos.indexOf(String(p.recinto)) === -1) grupos[k].recintos.push(String(p.recinto))
  })
  const chaves = Object.keys(grupos).sort(function (a, b) { return a.localeCompare(b, 'pt', { numeric: true }) })

  secao_(g, 'Resultados por professor', ultima)
  if (!chaves.length) {
    notaLinha_(g, 'nota', 'Ainda não há avaliações de professores para estes filtros.')
  } else {
    const cab = { 2: 'Professor(a)', 3: 'Disciplina', 4: 'Turma', 5: 'Avaliações' }
    colunas.forEach(function (c, i) { cab[6 + i] = PERGUNTAS_PROF[c] })
    const rc = cabecalho_(g, cab, ultima, 5)
    g.alturas[rc - 1] = 58
    g.estilo('envolver', a1_(rc, 2, ultima))

    chaves.forEach(function (k) {
      const gr = grupos[k], p = gr.p
      gr.classes.sort(function (a, b) { return a.localeCompare(b, 'pt', { numeric: true }) })
      const classes = gr.classes.length > 3 ? gr.classes.length + ' classes' : gr.classes.join(', ')
      const v = { 2: p.professor, 3: p.disciplina, 4: gr.recintos.sort().join(' e ') + ' · ' + classes, 5: gr.regs.length }
      colunas.forEach(function (c, i) { v[6 + i] = estatistica_(gr.regs, [c]).media })
      const geral = estatistica_(gr.regs, ['prof_geral']).media
      v[ultima] = barra_(geral, 5, corNota_(geral))
      const r = g.linha(v, Math.max(alturaTexto_(v[2], 160, 30), alturaTexto_(v[4], 150, 30)))
      g.estilo('envolver', a1_(r, 2, 4)).estilo('linha', a1_(r, 2, ultima)).estilo('forte', a1_(r, 2)).estilo('centro', a1_(r, 5)).estilo('media', a1_(r, 6, ultima - 1))
      g.gradientes.push(a1_(r, 6, ultima - 1))
      if (gr.regs.length < 3) g.estilo('poucos', a1_(r, 2, 5))
    })
  }

  espaco_(g, 18)
  notaLinha_(g, 'rodape', 'Linhas a cinzento: menos de 3 avaliações, interpretar com cuidado.')
  notaLinha_(g, 'rodape', 'Notas de 1 a 5. As respostas "Não sei" não entram nas contas.')
}

/** Relatório de um professor: resumo, cada pergunta ao lado da média da escola, turmas e comentários. */
function desenharProfessor_(g, ctx, nome) {
  const P = ctx.professores
  const regs = P.filter(function (p) { return String(p.professor) === nome })
  const colunas = Object.keys(PERGUNTAS_PROF)
  if (!regs.length) {
    secao_(g, 'Sem avaliações deste professor para os filtros escolhidos no Painel.', 8)
    return
  }
  const turma = function (p) { return [p.classe, String(p.curriculo || '').replace('Currículo ', '')].filter(String).join(' · ') }
  const disciplinas = distintos_(regs, 'disciplina')
  notaLinha_(g, 'nota', 'Disciplina' + (disciplinas.length > 1 ? 's' : '') + ': ' + disciplinas.join('; ') +
    '  ·  Turmas: ' + distintos_(regs, 'classe').join(', ') + '  ·  ' + distintos_(regs, 'recinto').join(' e '))
  espaco_(g, 10)

  const comentarios = regs.filter(function (p) { return String(p.comentario || '').trim() })
  const geral = estatistica_(regs, ['prof_geral']), escolaGeral = estatistica_(P, ['prof_geral'])
  const todas = estatistica_(regs, colunas)
  cartoes_(g, [
    { rotulo: 'Avaliações', valor: regs.length, formato: '0', nota: regs.length < 3 ? 'poucas: interpretar com cuidado' : 'encarregados avaliaram' },
    { rotulo: 'Satisfação geral', valor: geral.media, formato: '0.0" / 5"',
      nota: typeof escolaGeral.media === 'number' ? 'escola: ' + escolaGeral.media.toFixed(1).replace('.', ',') : '' },
    { rotulo: 'Satisfeitos', valor: todas.satisfeitos, formato: '0%', nota: 'notas 4 ou 5' },
    { rotulo: 'Comentários', valor: comentarios.length, formato: '0', nota: 'escritos pelos pais' },
  ])

  secao_(g, 'Por pergunta', 8)
  cabecalho_(g, { 2: 'Pergunta', 3: 'Média', 7: 'Escola', 8: 'Respostas' }, 8, 3)
  colunas.forEach(function (c) {
    linhaComparada_(g, PERGUNTAS_PROF[c], estatistica_(regs, [c]), estatistica_(P, [c]).media, /_geral$/.test(c))
  })

  // por turma e disciplina, quando o professor dá aulas a mais do que uma
  const grupos = {}
  regs.forEach(function (p) {
    const k = (disciplinas.length > 1 ? p.disciplina + '  ·  ' : '') + turma(p)
    ;(grupos[k] = grupos[k] || []).push(p)
  })
  const chaves = Object.keys(grupos).sort(function (a, b) { return a.localeCompare(b, 'pt', { numeric: true }) })
  if (chaves.length > 1) {
    secao_(g, 'Por turma', 8)
    cabecalho_(g, { 2: 'Turma', 3: 'Média', 7: 'Satisfeitos', 8: 'Avaliações' }, 8, 3)
    chaves.forEach(function (k) {
      const e = estatistica_(grupos[k], colunas)
      linhaNota_(g, k, { media: e.media, satisfeitos: e.satisfeitos, n: grupos[k].length })
    })
  }

  secao_(g, 'Comentários dos pais (' + comentarios.length + ')', 8)
  if (!comentarios.length) {
    notaLinha_(g, 'nota', 'Nenhum encarregado escreveu um comentário sobre este professor.')
  } else {
    const tempo = function (d) { return d instanceof Date ? d.getTime() : 0 }
    comentarios.sort(function (a, b) { return tempo(b.data_hora) - tempo(a.data_hora) })
    comentarios.forEach(function (p) {
      const texto = String(p.comentario).trim()
      const meta = (p.data_hora instanceof Date ? Utilities.formatDate(p.data_hora, ctx.tz, 'dd/MM') + ' · ' : '') + turma(p) +
        (disciplinas.length > 1 ? '\n' + p.disciplina : '')
      const linha = g.linha({ 2: meta, 3: clean_(texto) },
        Math.max(alturaTexto_(texto, LARGURA_TEXTO - LARGURAS_PAINEL[1]), alturaTexto_(meta, LARGURA_ROTULO, 34)))
      g.unir(a1_(linha, 3, 8))
      g.estilo('meta', a1_(linha, 2)).estilo('quebra', a1_(linha, 2, 8)).estilo('linha', a1_(linha, 2, 8))
    })
  }

  espaco_(g, 18)
  notaLinha_(g, 'rodape', 'Notas de 1 (muito insatisfeito) a 5 (muito satisfeito). "Escola" = média de todos os professores com os mesmos filtros. "Não sei" não entra nas contas.')
}

// ---------------------------------------------------------------------
// Separador "Painel Direção" (confidencial)
// ---------------------------------------------------------------------

function desenharPainelDir_(sh, ctx) {
  const R = ctx.respostas
  const g = novaGrelha_(8, LARGURA_TEXTO)
  const semGeral = function (cols) { return cols.filter(function (c) { return !/_geral$/.test(c) }) }

  titulo_(g, 'Liderança da escola — Direção',
    'CONFIDENCIAL — apenas para os responsáveis da escola  ·  ' + descreverFiltros_(ctx.filtros) + '  ·  atualizado em ' + atualizadoEm_(ctx), 8)
  notaLinha_(g, 'nota', 'Os filtros escolhem-se no separador Painel. As respostas são anónimas; os comentários aparecem tal como foram escritos.')

  const todas = colunasDe_(GRUPOS_DIR)
  if (!estatistica_(R, todas).n) {
    secao_(g, 'Ainda não há respostas sobre a Direção para estes filtros.', 8)
    aplicarGrelha_(sh, g, LARGURAS_PAINEL)
    return
  }

  // resumo e temas
  secao_(g, 'Resumo', 8)
  cabecalho_(g, { 2: '', 3: 'Média', 7: 'Satisfeitos', 8: 'Respostas' }, 8, 3)
  linhaNota_(g, 'Satisfação geral com a Direção', estatistica_(R, ['dir_dir_geral']), true)
  GRUPOS_DIR.forEach(function (gr) {
    linhaNota_(g, gr.nome, estatistica_(R, semGeral(Object.keys(gr.colunas))))
  })

  // pontos fortes e a melhorar
  const perguntas = semGeral(todas).map(function (c) {
    return { rotulo: GRUPOS_DIR.reduce(function (r, gr) { return r || gr.colunas[c] }, ''), e: estatistica_(R, [c]) }
  }).filter(function (p) { return p.e.n })
  perguntas.sort(function (x, y) { return y.e.media - x.e.media })
  const k = Math.min(3, Math.floor(perguntas.length / 2))
  if (k > 0) {
    secao_(g, 'Pontos mais fortes', 8)
    cabecalho_(g, { 2: 'Pergunta', 3: 'Média', 7: 'Satisfeitos', 8: 'Respostas' }, 8, 3)
    perguntas.slice(0, k).forEach(function (p) { linhaNota_(g, p.rotulo, p.e) })
    secao_(g, 'Pontos a melhorar', 8)
    cabecalho_(g, { 2: 'Pergunta', 3: 'Média', 7: 'Satisfeitos', 8: 'Respostas' }, 8, 3)
    perguntas.slice(-k).reverse().forEach(function (p) { linhaNota_(g, p.rotulo, p.e) })
  }

  // comparação com anos anteriores
  const evol = R.filter(function (r) { return String(r.dir_evolucao || '') !== '' })
  if (evol.length) {
    secao_(g, 'Comparando com anos anteriores, a liderança da escola…', 8)
    cabecalho_(g, { 2: 'Resposta', 3: 'Pais', 7: '%' }, 8, 3)
    OPCOES_EVOLUCAO.forEach(function (o) {
      linhaContagem_(g, o[0], evol.filter(function (r) { return String(r.dir_evolucao) === o[0] }).length, evol.length, o[1])
    })
    notaLinha_(g, 'nota', 'Só respondem os pais com o educando na escola há mais de 1 ano.')
  }

  // por pergunta
  GRUPOS_DIR.forEach(function (gr) {
    secao_(g, gr.nome, 8)
    cabecalho_(g, { 2: 'Pergunta', 3: 'Média', 7: 'Satisfeitos', 8: 'Respostas' }, 8, 3)
    Object.keys(gr.colunas).forEach(function (c) {
      linhaNota_(g, gr.colunas[c], estatistica_(R, [c]), /_geral$/.test(c))
    })
  })

  // comparação entre recintos e currículos
  const grupos = []
  ;['recinto', 'curriculo'].forEach(function (campo) {
    const v = distintos_(R, campo)
    if (v.length < 2) return
    v.forEach(function (x) {
      grupos.push({ nome: x.replace('Currículo ', ''), R: R.filter(function (r) { return String(r[campo]) === x }) })
    })
  })
  if (grupos.length) {
    const gs = [{ nome: 'Geral', R: R }].concat(grupos).slice(0, 6), ultimaG = 2 + gs.length
    secao_(g, 'Comparação entre recintos e currículos', 8)
    const cab = { 2: 'Tema' }
    gs.forEach(function (gr, i) { cab[3 + i] = gr.nome })
    cabecalho_(g, cab, 8, 3)
    GRUPOS_DIR.map(function (gr) { return [gr.nome, semGeral(Object.keys(gr.colunas))] })
      .concat([['Satisfação geral', ['dir_dir_geral']]])
      .forEach(function (linha) {
        const v = { 2: linha[0] }
        gs.forEach(function (gr, i) { v[3 + i] = estatistica_(gr.R, linha[1]).media })
        const r = g.linha(v, 26)
        g.estilo('linha', a1_(r, 2, 8)).estilo('media', a1_(r, 3, ultimaG))
        g.gradientes.push(a1_(r, 3, ultimaG))
      })
  }

  // comentários (todos, os mais recentes primeiro)
  const tempo = function (d) { return d instanceof Date ? d.getTime() : 0 }
  Object.keys(TEXTOS_DIRECAO).forEach(function (c) {
    const lista = R.filter(function (r) { return String(r[c] || '').trim() })
      .sort(function (a, b) { return tempo(b.data_hora) - tempo(a.data_hora) })
    if (!lista.length) return
    secao_(g, TEXTOS_DIRECAO[c] + ' (' + lista.length + ')', 8)
    lista.forEach(function (r) {
      const texto = String(r[c]).trim()
      const meta = (r.data_hora instanceof Date ? Utilities.formatDate(r.data_hora, ctx.tz, 'dd/MM') + ' · ' : '') + r.recinto
      const linha = g.linha({ 2: meta, 3: clean_(texto) }, Math.max(alturaTexto_(texto, LARGURA_TEXTO - LARGURAS_PAINEL[1]), alturaTexto_(meta, LARGURA_ROTULO, 34)))
      g.unir(a1_(linha, 3, 8))
      g.estilo('meta', a1_(linha, 2)).estilo('quebra', a1_(linha, 2, 8)).estilo('linha', a1_(linha, 2, 8))
    })
  })

  espaco_(g, 18)
  notaLinha_(g, 'rodape', 'Notas de 1 (muito insatisfeito) a 5 (muito satisfeito). "Satisfeitos" = notas 4 e 5. "Não sei" não entra nas contas.')
  notaLinha_(g, 'rodape', 'As perguntas novas deste ano só contam as respostas dadas depois de terem sido acrescentadas ao inquérito.')

  aplicarGrelha_(sh, g, LARGURAS_PAINEL)
}

// ---------------------------------------------------------------------
// Aspeto das folhas Respostas e Professores
// (os cabeçalhos não mudam: são os nomes que o doPost usa)
// ---------------------------------------------------------------------

function formatarFolhaDados_(sh) {
  if (!sh || sh.getLastColumn() === 0) return
  const nc = sh.getLastColumn(), nl = Math.max(sh.getMaxRows() - 1, 1)
  const cab = sh.getRange(1, 1, 1, nc).getValues()[0]
  const escala = colunasDe_(AREAS).concat(Object.keys(PERGUNTAS_PROF))
  const opcoes = Object.keys(DESENVOLVIMENTO).concat(['ec_familia', 'dir_evolucao'])
  const textoLongo = Object.keys(TEXTOS_ABERTOS).concat(Object.keys(TEXTOS_DIRECAO), ['melhorias_prioritarias', 'contacto_assunto', 'comentario'])
  const coluna = function (i) { return letra_(i + 1) + '2:' + letra_(i + 1) + (nl + 1) }

  sh.setHiddenGridlines(true)
  sh.setFrozenRows(1)
  sh.setFrozenColumns(1)
  sh.getRange(1, 1, nl + 1, nc).setFontFamily(FONTE).setFontSize(10).setFontColor(COR.texto).setVerticalAlignment('middle')
  sh.getRange(1, 1, 1, nc).setFontSize(9).setFontWeight('bold').setFontColor('#ffffff').setBackground(COR.azul)
    .setWrap(true).setHorizontalAlignment('center')
  sh.setRowHeight(1, 42)

  const notas = [], rec = [], longos = [], ids = [], centro = []
  cab.forEach(function (h, i) {
    let largura = 130
    if (h === 'data_hora') { largura = 125; sh.getRange(coluna(i)).setNumberFormat('dd/mm/yyyy hh:mm') }
    else if (h === 'id_resposta') { largura = 80; ids.push(coluna(i)) }
    else if (escala.indexOf(h) !== -1) { largura = 72; notas.push(coluna(i)) }
    else if (opcoes.indexOf(h) !== -1) { largura = 95; centro.push(coluna(i)) }
    else if (h === 'recomendacao_0_10') { largura = 90; rec.push(coluna(i)) }
    else if (textoLongo.indexOf(h) !== -1) { largura = 260; longos.push(coluna(i)) }
    sh.setColumnWidth(i + 1, largura)
  })
  if (ids.length) sh.getRangeList(ids).setFontSize(8).setFontColor(COR.cinza)
  if (notas.length) sh.getRangeList(notas).setHorizontalAlignment('center')
  if (rec.length) sh.getRangeList(rec).setHorizontalAlignment('center')
  if (centro.length) sh.getRangeList(centro).setHorizontalAlignment('center')
  if (longos.length) sh.getRangeList(longos).setWrap(true)

  const corpo = sh.getRange(2, 1, nl, nc)
  const regra = function (a1s, min, max, fundo, texto) {
    return SpreadsheetApp.newConditionalFormatRule().whenNumberBetween(min, max)
      .setBackground(fundo).setFontColor(texto).setRanges(sh.getRangeList(a1s).getRanges()).build()
  }
  const regras = []
  if (notas.length) {
    regras.push(regra(notas, 1, 2.99, COR.vermelhoSuave, COR.vermelho),
      regra(notas, 3, 3.99, COR.ambarSuave, COR.ambar),
      regra(notas, 4, 5, COR.verdeSuave, COR.verde))
  }
  if (rec.length) {
    regras.push(regra(rec, 0, 6, COR.vermelhoSuave, COR.vermelho),
      regra(rec, 7, 8, COR.ambarSuave, COR.ambar),
      regra(rec, 9, 10, COR.verdeSuave, COR.verde))
  }
  regras.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('NS').setFontColor(COR.cinza).setRanges([corpo]).build())
  regras.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=ISEVEN(ROW())').setBackground(COR.zebra).setRanges([corpo]).build())
  sh.setConditionalFormatRules(regras)
}
