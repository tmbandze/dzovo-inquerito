/**
 * Inquérito aos Encarregados de Educação — Colégio Dzovo
 * Recebe as respostas do site e grava-as nesta Google Sheet.
 *
 * Folhas criadas automaticamente:
 *   • "Respostas"   — uma linha por resposta (organização, direção, administração, melhorias, comentários)
 *   • "Professores" — uma linha por professor avaliado (liga-se à resposta pela coluna id_resposta)
 *
 * Instalação: ver README do projeto (secção "Ligar à Google Sheet").
 */

const SHEET_RESPOSTAS = 'Respostas'
const SHEET_PROFESSORES = 'Professores'
const MAX_TEXTO = 2000

function doPost(e) {
  const lock = LockService.getScriptLock()
  try {
    lock.waitLock(20000)
    const data = JSON.parse(e.postData.contents)
    if (!data || typeof data.resposta !== 'object') throw new Error('Formato inválido')

    const ss = SpreadsheetApp.getActiveSpreadsheet()
    const agora = new Date()

    appendRow_(ss, SHEET_RESPOSTAS, Object.assign({ data_hora: agora }, data.resposta))
    ;(data.professores || []).forEach(function (p) {
      appendRow_(ss, SHEET_PROFESSORES, Object.assign({ data_hora: agora }, p))
    })

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
