import type { ChatRow } from '../types.ts';

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Splits pasted text on blank lines (one or more empty/whitespace-only lines).
 */
export function parseBlankLineChats(rawText: string): string[] {
  if (!rawText.trim()) return [];
  return rawText
    .replace(/\r\n/g, '\n')
    .split(/\n[ \t]*\n+/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
}

/**
 * Minimal RFC-4180 compliant CSV parser supporting quoted multiline fields and escaped quotes.
 */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  const input = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const nextChar = input[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      currentRow.push(currentCell);
      currentCell = '';
    } else if (char === '\n') {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
}

const KNOWN_CHAT_HEADERS = new Set([
  'chat',
  'conversation',
  'conversations',
  'transcript',
  'message',
  'messages',
  'text',
  'body',
]);

export function parseUploadedChats(fileName: string, content: string): string[] {
  const lower = fileName.toLowerCase();
  if (!lower.endsWith('.csv')) {
    return parseBlankLineChats(content);
  }

  const csvRows = parseCsvRows(content);
  if (csvRows.length === 0) return [];

  const firstRow = csvRows[0].map((cell) => cell.trim().toLowerCase());
  const headerIdx = firstRow.findIndex((h) => KNOWN_CHAT_HEADERS.has(h));

  if (headerIdx !== -1) {
    return csvRows
      .slice(1)
      .map((row) => (row[headerIdx] ?? '').trim())
      .filter((cell) => cell.length > 0);
  }

  // If no known header match, check if first row looks like generic column headers
  const looksLikeHeader =
    csvRows.length > 1 &&
    firstRow.every((cell) => cell.length > 0 && cell.length < 32 && !cell.includes(' '));

  const startRow = looksLikeHeader ? 1 : 0;
  return csvRows
    .slice(startRow)
    .map((row) => {
      // Pick longest cell in row if multiple columns, or first column
      if (row.length === 1) return row[0].trim();
      const nonEmpty = row.map((c) => c.trim()).filter(Boolean);
      if (nonEmpty.length === 0) return '';
      return nonEmpty.reduce((longest, curr) => (curr.length > longest.length ? curr : longest), '');
    })
    .filter((cell) => cell.length > 0);
}

function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  // Protect against spreadsheet formula injection on untrusted user/LLM strings
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function buildApprovedCsv(rows: ChatRow[]): string {
  const approved = rows.filter((row) => row.status === 'success' && row.reviewStatus === 'approved');
  const headers = [
    'conversation',
    'intent',
    'friction',
    'evidence',
    'evidence_verified',
    'urgency',
    'suggested_reply',
    'edited_by_human',
    'review_status',
    'model',
  ];

  const lines = [headers.join(',')];
  for (const row of approved) {
    if (!row.result) continue;
    lines.push(
      [
        escapeCsvCell(row.chat),
        escapeCsvCell(row.result.intent),
        escapeCsvCell(row.result.friction),
        escapeCsvCell(row.result.evidence),
        escapeCsvCell(row.evidenceVerified ? 'verified' : 'evidence_not_found'),
        escapeCsvCell(row.result.urgency),
        escapeCsvCell(row.editedReply),
        escapeCsvCell(row.editedByHuman ? 'yes' : 'no'),
        escapeCsvCell(row.reviewStatus),
        escapeCsvCell(row.model ?? ''),
      ].join(',')
    );
  }

  return lines.join('\r\n');
}

export function downloadCsvFile(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
