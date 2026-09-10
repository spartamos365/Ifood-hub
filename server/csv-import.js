// Parser de CSV para import de extrato financeiro. Formato esperado (nosso
// próprio, documentado no README — não tenta adivinhar o formato de bancos
// específicos, que variam demais e mudam sem aviso):
//
//   data,descricao,valor,categoria
//   2026-01-05,Salário,6000,salario
//   05/01/2026,Supermercado,-380.50,mercado
//
// Aceita "," ou ";" como separador, e datas em ISO (AAAA-MM-DD) ou BR
// (DD/MM/AAAA). Valor aceita ponto ou vírgula como separador decimal.

function detectDelimiter(headerLine) {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

function parseCsvLine(line, delimiter) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i += 1; }
      else inQuotes = !inQuotes;
    } else if (c === delimiter && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result.map(s => s.trim());
}

function parseAmount(raw) {
  const s = raw.trim();
  if (s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return parseFloat(s);
}

function isValidDate(y, m, d) {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function parseDate(raw) {
  const s = raw.trim();

  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const d = Number(br[1]);
    const m = Number(br[2]);
    const y = Number(br[3]);
    if (!isValidDate(y, m, d)) return null;
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    if (!isValidDate(y, m, d)) return null;
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  return null;
}

function findColumn(header, ...names) {
  for (const name of names) {
    const idx = header.indexOf(name);
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines[0]);
  const header = parseCsvLine(lines[0], delimiter).map(h => h.toLowerCase());
  const idx = {
    date: findColumn(header, 'data', 'date'),
    description: findColumn(header, 'descricao', 'descrição', 'description'),
    amount: findColumn(header, 'valor', 'amount'),
    category: findColumn(header, 'categoria', 'category'),
  };

  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i], delimiter);
    const dateRaw = idx.date >= 0 ? cols[idx.date] : null;
    const description = idx.description >= 0 ? cols[idx.description] : null;
    const amountRaw = idx.amount >= 0 ? cols[idx.amount] : null;
    const category = idx.category >= 0 ? cols[idx.category] : null;
    const lineNumber = i + 1;

    if (!description || !amountRaw) {
      rows.push({ line: lineNumber, error: 'linha incompleta (faltando descrição ou valor)' });
      continue;
    }

    const amount = parseAmount(amountRaw);
    if (Number.isNaN(amount)) {
      rows.push({ line: lineNumber, error: `valor inválido: "${amountRaw}"` });
      continue;
    }

    const occurred_at = dateRaw ? parseDate(dateRaw) : null;
    if (dateRaw && !occurred_at) {
      rows.push({ line: lineNumber, error: `data inválida: "${dateRaw}"` });
      continue;
    }

    rows.push({ line: lineNumber, description, amount, category: category || null, occurred_at });
  }
  return rows;
}

module.exports = { parseCsv };
