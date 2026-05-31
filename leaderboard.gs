// Backend per la classifica del minigioco del matrimonio.
// Da incollare nell'editor Apps Script collegato al Google Sheet
// che vuoi usare come database. Il foglio "Leaderboard" viene creato
// automaticamente la prima volta.
//
// Deploy:
//   - Pubblica > Distribuisci come app web
//   - "Esegui come": Me
//   - "Chi ha accesso": Chiunque
//   - Copia l'URL e incollalo in minigame.js -> LEADERBOARD_URL.

const SHEET_NAME = 'Leaderboard';
const MAX_ENTRIES = 10;
const NAME_LENGTH = 3;
// Anti-spam: punteggi oltre questa soglia vengono scartati.
const MAX_REASONABLE_SCORE = 100000;

function doGet(e) {
  return jsonResponse(getTopScores());
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const name = sanitizeName(data.name);
    const score = sanitizeScore(data.score);
    if (!name || !isFinite(score)) {
      return jsonResponse({ error: 'invalid input' });
    }
    appendScore(name, score);
    return jsonResponse(getTopScores());
  } catch (err) {
    return jsonResponse({ error: String(err) });
  }
}

function sanitizeName(s) {
  if (typeof s !== 'string') return null;
  const cleaned = s.toUpperCase().replace(/[^A-Z]/g, '').slice(0, NAME_LENGTH);
  return cleaned.length === NAME_LENGTH ? cleaned : null;
}

function sanitizeScore(s) {
  const n = Number(s);
  if (!isFinite(n)) return NaN;
  const rounded = Math.floor(n);
  if (rounded <= 0 || rounded > MAX_REASONABLE_SCORE) return NaN;
  return rounded;
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['Nome', 'Punti', 'Data']);
  }
  return sheet;
}

function appendScore(name, score) {
  const sheet = getSheet();
  sheet.appendRow([name, score, new Date()]);
}

function getTopScores() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const range = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  return range
    .filter(function (r) { return r[0] && typeof r[1] === 'number'; })
    .map(function (r) { return { name: String(r[0]), score: Number(r[1]) }; })
    .sort(function (a, b) { return b.score - a.score; })
    .slice(0, MAX_ENTRIES);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
