/**
 * Inquérito aos Encarregados de Educação — Colégio Dzovo
 * Recebe as respostas do site e grava-as nesta Google Sheet.
 *
 * Folhas criadas automaticamente:
 *   • "Respostas"   — uma linha por resposta (organização, direção, administração, melhorias, comentários)
 *   • "Professores" — uma linha por professor avaliado (liga-se à resposta pela coluna id_resposta)
 *
 * Instalação: ver README do projeto (secção "Ligar à Google Sheet").
 *
 * @OnlyCurrentDoc
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
// e arruma o aspeto das folhas Respostas e Professores.
// Os filtros (recinto, currículo, classe, edição) escolhem-se no topo do Painel.
// Se as perguntas do inquérito mudarem, atualizar AREAS e PERGUNTAS_PROF.
// =====================================================================

const SHEET_PAINEL = 'Painel'
const SHEET_PAINEL_PROF = 'Painel Professores'
const EMBLEMA_URL = 'https://tmbandze.github.io/dzovo-inquerito/emblema.png'
const FONTE = 'Inter'
const COR = {
  azul: '#1c3a63', azulSuave: '#e8eef6', texto: '#1f2937', cinza: '#6b7280',
  linha: '#e5e7eb', cartao: '#f4f6fa', zebra: '#f8fafc',
  verde: '#15803d', ambar: '#b45309', vermelho: '#b91c1c',
  verdeSuave: '#dcfce7', ambarSuave: '#fef3c7', vermelhoSuave: '#fee2e2',
}

/** Nomes curtos das perguntas. As chaves são as colunas da folha Respostas. */
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
  { nome: 'Direção', curto: 'Direção', colunas: {
    dir_acessivel: 'Diretor acessível',
    dir_ouvido: 'Preocupações ouvidas',
    dir_resolve: 'Resolução de problemas',
    dir_decisoes: 'Comunicação das decisões',
    dir_confianca: 'Confiança na liderança',
    dir_dir_geral: 'Satisfação geral',
  } },
  { nome: 'Administração / Secretaria', curto: 'Administração', colunas: {
    adm_cordialidade: 'Cordialidade no atendimento',
    adm_rapidez: 'Rapidez no atendimento',
    adm_propinas: 'Informação sobre propinas',
    adm_documentos: 'Obtenção de documentos',
    adm_contacto: 'Facilidade de contacto',
    adm_adm_geral: 'Satisfação geral',
  } },
]

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
  dir_dir_comentario: 'Para a Direção',
  adm_adm_comentario: 'Sobre a Administração',
  melhoria_outro: 'Outra melhoria',
}
const TEMPOS = ['Menos de 1 ano', '1–2 anos', '3–4 anos', '5 anos ou mais']

const FILTROS = [
  { coluna: 'recinto', nome: 'Recinto' },
  { coluna: 'curriculo', nome: 'Currículo' },
  { coluna: 'classe', nome: 'Classe' },
  { coluna: 'edicao', nome: 'Edição' },
]
const TODOS = 'Todos'
const LINHA_FILTROS = 6
/** Colunas de cada cartão / filtro no Painel: B, C:D, E:F, G:H */
const BLOCOS = [[2, 2], [3, 4], [5, 6], [7, 8]]

// ---------------------------------------------------------------------
// Menu e atualização
// ---------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Inquérito')
    .addItem('Atualizar painel', 'atualizarPainel')
    .addItem('Atualizar automaticamente (de hora a hora)', 'ativarAtualizacaoAutomatica')
    .addSeparator()
    .addItem('Apagar respostas de teste', 'apagarRespostasTeste')
    .addToUi()
}

/** Ao mudar um filtro no Painel, os painéis são recalculados. */
function onEdit(e) {
  if (!e) return
  const sh = e.range.getSheet()
  if (sh.getName() === SHEET_PAINEL && e.range.getRow() === LINHA_FILTROS) desenharPaineis_(e.source)
}

function atualizarPainel() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  atualizarPaineis_(ss)
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

function desenharPaineis_(ss) {
  const painel = ss.getSheetByName(SHEET_PAINEL) || ss.insertSheet(SHEET_PAINEL, 0)
  const filtros = lerFiltros_(painel)
  const passa = passaFiltros_(filtros)
  const todas = lerRegistos_(ss, SHEET_RESPOSTAS)
  const ctx = {
    tz: ss.getSpreadsheetTimeZone(),
    filtros: filtros,
    todas: todas,
    respostas: todas.filter(passa),
    professores: lerRegistos_(ss, SHEET_PROFESSORES).filter(passa),
  }
  desenharPainel_(painel, ctx)
  desenharPainelProf_(ss.getSheetByName(SHEET_PAINEL_PROF) || ss.insertSheet(SHEET_PAINEL_PROF, 1), ctx)
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
  const v = []
  registos.forEach(function (r) {
    const x = String(r[campo])
    if (x !== '' && v.indexOf(x) === -1) v.push(x)
  })
  return v.sort(function (a, b) {
    return ordem ? ordem.indexOf(a) - ordem.indexOf(b) : a.localeCompare(b, 'pt', { numeric: true })
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
  subtitulo: function (r) { r.setFontColor(COR.cinza) },
  rotulo: function (r) { r.setFontSize(8).setFontWeight('bold').setFontColor(COR.cinza).setVerticalAlignment('bottom') },
  cartaoValor: function (r) { r.setFontSize(24).setFontWeight('bold').setFontColor(COR.azul) },
  nota: function (r) { r.setFontSize(9).setFontColor(COR.cinza) },
  secao: function (r) { r.setFontSize(13).setFontWeight('bold').setFontColor(COR.azul).setVerticalAlignment('bottom').setBorder(null, null, true, null, null, null, COR.azul, SpreadsheetApp.BorderStyle.SOLID_MEDIUM) },
  subsecao: function (r) { r.setFontWeight('bold').setFontColor(COR.azul).setVerticalAlignment('bottom') },
  cabecalho: function (r) { r.setFontSize(8).setFontWeight('bold').setFontColor(COR.cinza) },
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
  meta: function (r) { r.setFontSize(9).setFontColor(COR.cinza) },
  rodape: function (r) { r.setFontSize(9).setFontStyle('italic').setFontColor(COR.cinza) },
  margem: function (r) { r.setBorder(null, true, null, true, null, null, '#ffffff', SpreadsheetApp.BorderStyle.SOLID_THICK) },
}

function novaGrelha_(colunas) {
  const g = { colunas: colunas, linhas: [], alturas: [], estilos: {}, unioes: [], gradientes: [], formatos: [] }
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

function aplicarGrelha_(sh, g, larguras) {
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
  g.estilo('subtitulo', a1_(g.linha({ 2: sub }, 20), 2))
  // emblema do colégio no canto direito
  g.linhas[r - 1][ultima - 1] = '=IMAGE("' + EMBLEMA_URL + '")'
  g.unir(a1_(r, ultima, ultima, r + 1))
}

function secao_(g, texto, ultima) {
  espaco_(g, 22)
  g.estilo('secao', a1_(g.linha({ 2: texto }, 30), 2, ultima))
}

function cabecalho_(g, nomes, ultima, primeiraNum) {
  const r = g.linha(nomes, 24)
  g.estilo('cabecalho', a1_(r, 2, ultima)).estilo('centro', a1_(r, primeiraNum, ultima)).estilo('linha', a1_(r, 2, ultima))
  return r
}

/** Linha com média (1–5), barra colorida, % satisfeitos e nº de respostas. */
function linhaNota_(g, rotulo, e, forte) {
  const r = g.linha({ 2: rotulo, 3: e.media, 4: barra_(e.media, 5, corNota_(e.media)), 7: e.satisfeitos, 8: e.n }, 26)
  g.unir(a1_(r, 4, 6))
  g.estilo('linha', a1_(r, 2, 8)).estilo('media', a1_(r, 3)).estilo('pct', a1_(r, 7)).estilo('centro', a1_(r, 8))
  if (forte) g.estilo('forte', a1_(r, 2))
  g.gradientes.push(a1_(r, 3))
}

/** Linha com contagem, barra e percentagem do total. */
function linhaContagem_(g, rotulo, n, total, cor) {
  const pct = total ? n / total : 0
  const r = g.linha({ 2: rotulo, 3: n, 4: barra_(pct, 1, cor || COR.azul), 7: pct }, 26)
  g.unir(a1_(r, 4, 6))
  g.estilo('linha', a1_(r, 2, 8)).estilo('centro', a1_(r, 3)).estilo('pct', a1_(r, 7))
}

function atualizadoEm_(ctx) {
  return Utilities.formatDate(new Date(), ctx.tz, 'dd/MM/yyyy HH:mm')
}

// ---------------------------------------------------------------------
// Separador "Painel"
// ---------------------------------------------------------------------

function desenharPainel_(sh, ctx) {
  const R = ctx.respostas, P = ctx.professores
  const g = novaGrelha_(8)

  titulo_(g, 'Inquérito aos Encarregados de Educação',
    'Colégio Dzovo  ·  ' + descreverFiltros_(ctx.filtros) + '  ·  atualizado em ' + atualizadoEm_(ctx), 8)
  espaco_(g, 12)

  // filtros
  const rotulos = {}, valores = {}
  FILTROS.forEach(function (d, i) {
    rotulos[BLOCOS[i][0]] = d.nome.toUpperCase()
    valores[BLOCOS[i][0]] = ctx.filtros[d.coluna]
  })
  const rRot = g.linha(rotulos, 18), rFil = g.linha(valores, 30)
  if (rFil !== LINHA_FILTROS) throw new Error('A linha dos filtros tem de ser a ' + LINHA_FILTROS)
  BLOCOS.forEach(function (b) {
    g.unir(a1_(rRot, b[0], b[1])).unir(a1_(rFil, b[0], b[1]))
    g.estilo('rotulo', a1_(rRot, b[0], b[1])).estilo('centro', a1_(rRot, b[0], b[1]))
    g.estilo('filtro', a1_(rFil, b[0], b[1])).estilo('margem', a1_(rRot, b[0], b[1], rFil))
  })
  g.estilo('nota', a1_(g.linha({ 2: 'Escolha nos campos acima para filtrar os resultados. "Todos" mostra tudo.' }, 22), 2))
  espaco_(g, 10)

  // cartões
  const geral = estatisticaGeral_(R, P), rec = recomendacao_(R)
  const cartoes = [
    { rotulo: 'RESPOSTAS', valor: R.length, formato: '0',
      nota: R.length === ctx.todas.length ? 'encarregados responderam' : 'de ' + ctx.todas.length + ' no total' },
    { rotulo: 'SATISFAÇÃO MÉDIA', valor: geral.media, formato: '0.0" / 5"',
      nota: typeof geral.satisfeitos === 'number' ? Math.round(geral.satisfeitos * 100) + '% de notas 4 ou 5' : 'sem notas' },
    { rotulo: 'RECOMENDAÇÃO', valor: rec.media, formato: '0.0" / 10"', nota: 'recomendaria a escola?' },
    { rotulo: 'NPS', valor: rec.nps, formato: '+0;-0;0',
      nota: rec.n ? pct_(rec.promotores, rec.n) + ' promotores · ' + pct_(rec.criticos, rec.n) + ' críticos' : 'sem respostas' },
  ]
  const l1 = {}, l2 = {}, l3 = {}
  cartoes.forEach(function (k, i) {
    const c = BLOCOS[i][0]
    l1[c] = k.rotulo; l2[c] = typeof k.valor === 'number' ? k.valor : '—'; l3[c] = k.nota
  })
  const r1 = g.linha(l1, 26), r2 = g.linha(l2, 46), r3 = g.linha(l3, 26)
  BLOCOS.forEach(function (b, i) {
    ;[r1, r2, r3].forEach(function (r) { g.unir(a1_(r, b[0], b[1])) })
    g.estilo('cartao', a1_(r1, b[0], b[1], r3)).estilo('margem', a1_(r1, b[0], b[1], r3))
    g.estilo('rotulo', a1_(r1, b[0], b[1])).estilo('cartaoValor', a1_(r2, b[0], b[1])).estilo('nota', a1_(r3, b[0], b[1]))
    g.formatos.push({ a1: a1_(r2, b[0]), formato: cartoes[i].formato })
  })

  if (!R.length) {
    secao_(g, 'Ainda não há respostas para estes filtros.', 8)
    aplicarGrelha_(sh, g, [20, 230, 115, 115, 115, 115, 115, 115])
    validarFiltros_(sh, ctx)
    return
  }

  const todasAreas = AREAS.concat([AREA_PROF])

  // satisfação por área
  secao_(g, 'Satisfação por área', 8)
  cabecalho_(g, { 2: 'ÁREA', 3: 'MÉDIA', 7: 'SATISFEITOS', 8: 'RESPOSTAS' }, 8, 3)
  todasAreas.forEach(function (a) {
    const e = estatisticaArea_(a, R, P)
    linhaNota_(g, a.nome, { media: e.media, satisfeitos: e.satisfeitos, n: e.pessoas })
  })

  // pontos fortes e a melhorar
  const perguntas = []
  todasAreas.forEach(function (a) {
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
    cabecalho_(g, { 2: 'PERGUNTA', 3: 'MÉDIA', 7: 'SATISFEITOS', 8: 'RESPOSTAS' }, 8, 3)
    perguntas.slice(0, k).forEach(function (p) { linhaNota_(g, p.rotulo, p.e) })
    secao_(g, 'Pontos a melhorar', 8)
    cabecalho_(g, { 2: 'PERGUNTA', 3: 'MÉDIA', 7: 'SATISFEITOS', 8: 'RESPOSTAS' }, 8, 3)
    perguntas.slice(-k).reverse().forEach(function (p) { linhaNota_(g, p.rotulo, p.e) })
  }

  // recomendação
  if (rec.n) {
    secao_(g, 'Recomendaria a escola a outras famílias? (0 a 10)', 8)
    cabecalho_(g, { 2: 'GRUPO', 3: 'PAIS', 7: '%' }, 8, 3)
    linhaContagem_(g, 'Promotores (9–10)', rec.promotores, rec.n, COR.verde)
    linhaContagem_(g, 'Neutros (7–8)', rec.neutros, rec.n, COR.ambar)
    linhaContagem_(g, 'Críticos (0–6)', rec.criticos, rec.n, COR.vermelho)
    g.estilo('nota', a1_(g.linha({ 2: 'NPS = % promotores − % críticos. Vai de −100 a +100: acima de 0 é positivo, acima de 50 é excelente.' }, 22), 2))
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
    const cab = { 2: 'ÁREA' }
    gs.forEach(function (gr, i) { cab[3 + i] = gr.nome.toUpperCase() })
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
    secao_(g, a.nome + ' — por pergunta', 8)
    cabecalho_(g, { 2: 'PERGUNTA', 3: 'MÉDIA', 7: 'SATISFEITOS', 8: 'RESPOSTAS' }, 8, 3)
    Object.keys(a.colunas).forEach(function (c) {
      linhaNota_(g, a.colunas[c], estatistica_(a.professores ? P : R, [c]), /_geral$/.test(c))
    })
  })

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
    cabecalho_(g, { 2: 'ÁREA A MELHORAR', 3: 'VOTOS', 7: '% DOS PAIS' }, 8, 3)
    melhorias.forEach(function (m) { linhaContagem_(g, m, votos[m], R.length) })
  }

  // quem respondeu
  secao_(g, 'Quem respondeu', 8)
  cabecalho_(g, { 3: 'RESPOSTAS', 7: '%' }, 8, 3)
  ;[['recinto', 'Recinto'], ['curriculo', 'Currículo'], ['classe', 'Classe'], ['tempo_na_escola', 'Tempo na escola']].forEach(function (d) {
    g.estilo('subsecao', a1_(g.linha({ 2: d[1] }, 26), 2))
    distintos_(R, d[0], d[0] === 'tempo_na_escola' ? TEMPOS : null).forEach(function (v) {
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
      const r = g.linha({ 2: meta, 3: clean_(c.texto) }, Math.max(42, Math.ceil(c.texto.length / 95) * 17 + 14))
      g.unir(a1_(r, 3, 8))
      g.estilo('meta', a1_(r, 2)).estilo('quebra', a1_(r, 2, 8)).estilo('linha', a1_(r, 2, 8))
    })
    if (comentarios.length > 15) {
      g.estilo('nota', a1_(g.linha({ 2: 'Mais ' + (comentarios.length - 15) + ' comentários na folha Respostas.' }, 22), 2))
    }
  }

  espaco_(g, 18)
  g.estilo('rodape', a1_(g.linha({ 2: 'Notas de 1 (muito insatisfeito) a 5 (muito satisfeito). "Satisfeitos" = notas 4 e 5.' }, 18), 2))
  g.estilo('rodape', a1_(g.linha({ 2: 'As respostas "Não sei" não entram nas contas. Os dados de contacto nunca aparecem neste painel.' }, 18), 2))

  aplicarGrelha_(sh, g, [20, 230, 115, 115, 115, 115, 115, 115])
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

function desenharPainelProf_(sh, ctx) {
  const P = ctx.professores
  const colunas = Object.keys(PERGUNTAS_PROF)
  const ultima = 6 + colunas.length // B–E dados, F… perguntas, última coluna = barra
  const g = novaGrelha_(ultima)

  titulo_(g, 'Avaliação dos professores',
    'CONFIDENCIAL — apenas para a Direção  ·  ' + descreverFiltros_(ctx.filtros) + '  ·  atualizado em ' + atualizadoEm_(ctx), ultima)
  g.estilo('nota', a1_(g.linha({ 2: 'Os filtros escolhem-se no separador Painel. Cada linha resume as avaliações dos encarregados a um(a) professor(a).' }, 22), 2))

  const grupos = {}
  P.forEach(function (p) {
    const k = [p.recinto, p.curriculo, p.professor, p.disciplina].join('|')
    if (!grupos[k]) grupos[k] = { p: p, regs: [], classes: [] }
    grupos[k].regs.push(p)
    if (grupos[k].classes.indexOf(String(p.classe)) === -1) grupos[k].classes.push(String(p.classe))
  })
  const chaves = Object.keys(grupos).sort(function (a, b) { return a.localeCompare(b, 'pt', { numeric: true }) })

  secao_(g, 'Resultados por professor', ultima)
  if (!chaves.length) {
    g.estilo('nota', a1_(g.linha({ 2: 'Ainda não há avaliações de professores para estes filtros.' }, 26), 2))
  } else {
    const cab = { 2: 'PROFESSOR(A)', 3: 'DISCIPLINA', 4: 'TURMA', 5: 'AVALIAÇÕES' }
    colunas.forEach(function (c, i) { cab[6 + i] = PERGUNTAS_PROF[c].toUpperCase() })
    const rc = cabecalho_(g, cab, ultima, 5)
    g.alturas[rc - 1] = 44
    g.estilo('envolver', a1_(rc, 2, ultima))

    chaves.forEach(function (k) {
      const gr = grupos[k], p = gr.p
      const classes = gr.classes.length > 2 ? gr.classes.length + ' classes' : gr.classes.join(', ')
      const v = { 2: p.professor, 3: p.disciplina, 4: p.recinto + ' · ' + String(p.curriculo).replace('Currículo ', '') + ' · ' + classes, 5: gr.regs.length }
      colunas.forEach(function (c, i) { v[6 + i] = estatistica_(gr.regs, [c]).media })
      const geral = estatistica_(gr.regs, ['prof_geral']).media
      v[ultima] = barra_(geral, 5, corNota_(geral))
      const r = g.linha(v, 28)
      g.estilo('linha', a1_(r, 2, ultima)).estilo('forte', a1_(r, 2)).estilo('centro', a1_(r, 5)).estilo('media', a1_(r, 6, ultima - 1))
      g.gradientes.push(a1_(r, 6, ultima - 1))
      if (gr.regs.length < 3) g.estilo('poucos', a1_(r, 2, 5))
    })
  }

  espaco_(g, 18)
  g.estilo('rodape', a1_(g.linha({ 2: 'Linhas a cinzento: menos de 3 avaliações, interpretar com cuidado.' }, 18), 2))
  g.estilo('rodape', a1_(g.linha({ 2: 'Notas de 1 a 5. As respostas "Não sei" não entram nas contas.' }, 18), 2))

  const larguras = [20, 210, 140, 220, 90]
  colunas.forEach(function () { larguras.push(95) })
  larguras.push(130)
  aplicarGrelha_(sh, g, larguras)
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
  const textoLongo = Object.keys(TEXTOS_ABERTOS).concat(['melhorias_prioritarias', 'contacto_assunto', 'comentario'])
  const coluna = function (i) { return letra_(i + 1) + '2:' + letra_(i + 1) + (nl + 1) }

  sh.setHiddenGridlines(true)
  sh.setFrozenRows(1)
  sh.setFrozenColumns(1)
  sh.getRange(1, 1, nl + 1, nc).setFontFamily(FONTE).setFontSize(10).setFontColor(COR.texto).setVerticalAlignment('middle')
  sh.getRange(1, 1, 1, nc).setFontSize(9).setFontWeight('bold').setFontColor('#ffffff').setBackground(COR.azul)
    .setWrap(true).setHorizontalAlignment('center')
  sh.setRowHeight(1, 42)

  const notas = [], rec = [], longos = [], ids = []
  cab.forEach(function (h, i) {
    let largura = 130
    if (h === 'data_hora') { largura = 125; sh.getRange(coluna(i)).setNumberFormat('dd/mm/yyyy hh:mm') }
    else if (h === 'id_resposta') { largura = 80; ids.push(coluna(i)) }
    else if (escala.indexOf(h) !== -1) { largura = 72; notas.push(coluna(i)) }
    else if (h === 'recomendacao_0_10') { largura = 90; rec.push(coluna(i)) }
    else if (textoLongo.indexOf(h) !== -1) { largura = 260; longos.push(coluna(i)) }
    sh.setColumnWidth(i + 1, largura)
  })
  if (ids.length) sh.getRangeList(ids).setFontSize(8).setFontColor(COR.cinza)
  if (notas.length) sh.getRangeList(notas).setHorizontalAlignment('center')
  if (rec.length) sh.getRangeList(rec).setHorizontalAlignment('center')
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
