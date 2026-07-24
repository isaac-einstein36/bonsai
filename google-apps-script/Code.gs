/**
 * BonsaiOS — Google Apps Script backend
 *
 * SETUP
 * 1. Go to https://script.google.com, create a new project, paste this file
 *    in as Code.gs.
 * 2. In the same project, open the bound spreadsheet (Extensions > Apps
 *    Script keeps them linked), or set SPREADSHEET_ID below to an existing
 *    Google Sheet's ID.
 * 3. Deploy > New deployment > type "Web app".
 *      - Execute as: Me
 *      - Who has access: Anyone  (required so the static GitHub Pages site
 *        can POST to it; the script itself only ever touches this one sheet)
 * 4. Copy the web app URL into BonsaiOS Settings > Google Sheets.
 *
 * The sheet gets one tab named "Journal" with these columns, matching the
 * spec's secondary-storage layout:
 * Date | Weather | Temperature | Humidity | Watered | Fertilized | Flowers | Notes | Photo link | Health
 */

const CODE_VERSION = 'v3-2026-07-24';
const SPREADSHEET_ID = ''; // leave blank to use the container-bound spreadsheet
const SHEET_NAME = 'Journal';
const HEADERS = ['Date', 'Weather', 'Temperature', 'Humidity', 'Watered', 'Fertilized', 'Flowers', 'Notes', 'Photo link', 'Health'];

function getSheet_() {
  const props = PropertiesService.getScriptProperties();
  let ss;

  if (SPREADSHEET_ID) {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  } else {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) {
      ss = active;
    } else {
      // Standalone script with no bound sheet — create one once and remember its ID
      // in Script Properties so we reuse the same spreadsheet on every future call.
      const savedId = props.getProperty('BONSAIOS_SHEET_ID');
      if (savedId) {
        ss = SpreadsheetApp.openById(savedId);
      } else {
        ss = SpreadsheetApp.create('BonsaiOS Journal');
        props.setProperty('BONSAIOS_SHEET_ID', ss.getId());
      }
    }
  }

  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function doPost(e) {
  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut_({ ok: false, error: 'Invalid JSON body: ' + err.message });
  }

  try {
    if (payload.action === 'ping') {
      const sheet = getSheet_(); // exercises spreadsheet access so "Test connection" is meaningful
      return jsonOut_({ ok: true, message: `[${CODE_VERSION}] Reachable and writing to: ${sheet.getParent().getUrl()}` });
    }

    if (payload.action === 'appendEntry') {
      const entry = payload.entry || {};
      const sheet = getSheet_();

      // Upsert by date: if a row for this date already exists, overwrite it
      // instead of duplicating, so re-saving an entry stays idempotent.
      const lastRow = sheet.getLastRow();
      const dates = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat() : [];
      const existingRowIndex = dates.findIndex((d) => formatDate_(d) === entry.date);

      const row = [
        entry.date || '',
        entry.weatherDescription || '',
        entry.temperature ?? '',
        entry.humidity ?? '',
        entry.watered ? 'Yes' : 'No',
        entry.fertilized ? 'Yes' : 'No',
        entry.flowers ?? '',
        entry.notes || '',
        (entry.photos && entry.photos.length) ? entry.photos.join(', ') : '',
        entry.healthRating ?? ''
      ];

      if (existingRowIndex >= 0) {
        sheet.getRange(existingRowIndex + 2, 1, 1, row.length).setValues([row]);
      } else {
        sheet.appendRow(row);
      }

      return jsonOut_({ ok: true, row: existingRowIndex >= 0 ? existingRowIndex + 2 : sheet.getLastRow() });
    }

    if (payload.action === 'deleteEntry') {
      const sheet = getSheet_();
      const lastRow = sheet.getLastRow();
      const dates = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat() : [];
      const existingRowIndex = dates.findIndex((d) => formatDate_(d) === payload.date);
      if (existingRowIndex >= 0) {
        sheet.deleteRow(existingRowIndex + 2);
        return jsonOut_({ ok: true, deleted: true });
      }
      return jsonOut_({ ok: true, deleted: false, message: 'No matching row found.' });
    }

    return jsonOut_({ ok: false, error: 'Unknown action: ' + payload.action });
  } catch (err) {
    return jsonOut_({ ok: false, error: err.message });
  }
}

function doGet(e) {
  return jsonOut_({ ok: true, message: 'BonsaiOS Apps Script is live. POST to this URL to sync entries.' });
}

function formatDate_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value);
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
