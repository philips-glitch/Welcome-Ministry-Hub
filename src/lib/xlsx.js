// Minimal spreadsheet reader for imports, without a dependency: .xlsx (a zip of XML files, unzipped with
// the browser's DecompressionStream) and .csv. Returns [{ name, rows: string[][] }], one entry per sheet.

export async function readSheets(file) {
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') return [{ name: file.name, rows: parseCsv(await file.text()) }];
  const zip = await unzip(new Uint8Array(await file.arrayBuffer()));
  const text = async (path) => (zip.has(path) ? new TextDecoder().decode(await zip.get(path)()) : null);
  const xml = (s) => new DOMParser().parseFromString(s, 'application/xml');

  const wb = await text('xl/workbook.xml');
  if (!wb) throw new Error('Bukan file Excel (.xlsx) yang valid.');
  const rels = xml((await text('xl/_rels/workbook.xml.rels')) || '<Relationships/>');
  const target = Object.fromEntries([...rels.getElementsByTagName('Relationship')].map((r) => [r.getAttribute('Id'), r.getAttribute('Target')]));
  const ss = await text('xl/sharedStrings.xml');
  const shared = ss ? [...xml(ss).getElementsByTagName('si')].map((si) => [...si.getElementsByTagName('t')].map((t) => t.textContent).join('')) : [];

  const sheets = [];
  for (const s of xml(wb).getElementsByTagName('sheet')) {
    const t = target[s.getAttribute('r:id')] || '';
    const path = t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '');
    const doc = await text(path);
    if (doc) sheets.push({ name: s.getAttribute('name'), rows: sheetRows(xml(doc), shared) });
  }
  return sheets;
}

function sheetRows(doc, shared) {
  const col = (ref) => [...ref.replace(/\d+/g, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  return [...doc.getElementsByTagName('row')].map((row) => {
    const out = [];
    for (const c of row.getElementsByTagName('c')) {
      const type = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
      const val = type === 's' ? shared[Number(v)] ?? ''
        : type === 'inlineStr' ? [...c.getElementsByTagName('t')].map((t) => t.textContent).join('')
        : v;
      out[col(c.getAttribute('r') || '')] = val;
    }
    return Array.from(out, (x) => (x ?? '').toString());
  });
}

// Zip: read the central directory, inflate entries on demand. Returns Map<path, () => Promise<Uint8Array>>.
async function unzip(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Bukan file Excel (.xlsx) yang valid.');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const files = new Map();
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const size = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen));
    files.set(name, async () => {
      const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      const data = buf.subarray(start, start + size);
      if (method === 0) return data;
      if (method !== 8) throw new Error('Format kompresi Excel tidak didukung.');
      return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

// RFC 4180-ish: quoted fields, doubled quotes, commas or semicolons.
function parseCsv(s) {
  const sep = (s.split('\n')[0].match(/;/g) || []).length > (s.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const rows = [[]];
  let cur = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { rows[rows.length - 1].push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      rows[rows.length - 1].push(cur); cur = ''; rows.push([]);
    } else cur += ch;
  }
  rows[rows.length - 1].push(cur);
  return rows.filter((r) => r.some((x) => x.trim()));
}
