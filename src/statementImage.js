// Draws a statement (see domain/statement.js) on a canvas and returns it as a PNG.
// Plain canvas 2D: no extra library, works offline, and the result is a real image that
// WhatsApp shows inline.

const WIDTH = 1080;
const PAD = 56;
const FONT = '"Cairo Variable", Cairo, system-ui, sans-serif';

const COLORS = {
  brand: '#0277bd',
  brandStrong: '#01579b',
  text: '#1c2228',
  muted: '#5b6770',
  border: '#dde3e8',
  stripe: '#f6f8fa',
  head: '#eef2f5',
  owes: '#c62828',
  owesSoft: '#fdecec',
  owed: '#2e7d32',
  owedSoft: '#e8f5e9',
  settled: '#1c2228',
  settledSoft: '#eef2f5',
  white: '#ffffff',
};

const HEADER_H = 200;
const CARD_H = 170;
const TABLE_HEAD_H = 64;
const ROW_H = 72;
const FOOTER_H = 96;

// Columns from right to left, as the eye reads Arabic. Widths add up to the table width.
const TABLE_W = WIDTH - PAD * 2;
const COLUMNS = [
  { key: 'date', title: 'التاريخ', width: 170, align: 'right' },
  { key: 'note', title: 'البيان', width: 240, align: 'right' },
  { key: 'took', title: 'خدت', width: 155, align: 'center' },
  { key: 'paid', title: 'دفعت', width: 155, align: 'center' },
  { key: 'balance', title: 'الرصيد', width: TABLE_W - 720, align: 'center' },
];

function font(size, weight = 400) {
  return `${weight} ${size}px ${FONT}`;
}

/** The statement's height in pixels for a given number of table lines. */
export function statementHeight(model) {
  const lines = model.rows.length + (model.opening ? 1 : 0);
  const table = lines > 0 ? TABLE_HEAD_H + lines * ROW_H + ROW_H : 0;
  return HEADER_H + PAD + CARD_H + PAD + table + (table ? PAD / 2 : 0) + FOOTER_H;
}

/** Cuts text to fit a width, ending with "…". */
function fit(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Writes text inside a column cell, honouring its alignment. */
function cell(ctx, column, right, y, text, maxWidth = column.width - 24) {
  const value = fit(ctx, text, maxWidth);
  if (column.align === 'center') {
    ctx.textAlign = 'center';
    ctx.fillText(value, right - column.width / 2, y);
  } else {
    ctx.textAlign = 'right';
    ctx.fillText(value, right - 12, y);
  }
}

function drawHeader(ctx, model) {
  ctx.fillStyle = COLORS.brand;
  ctx.fillRect(0, 0, WIDTH, HEADER_H);

  ctx.fillStyle = COLORS.white;
  ctx.textAlign = 'right';
  ctx.font = font(30, 600);
  ctx.globalAlpha = 0.85;
  ctx.fillText(model.shopName ? fit(ctx, model.shopName, WIDTH - PAD * 2 - 320) : 'كشف حساب', WIDTH - PAD, 78);
  ctx.globalAlpha = 1;

  ctx.font = font(48, 700);
  ctx.fillText(fit(ctx, model.clientName, WIDTH - PAD * 2), WIDTH - PAD, 148);

  ctx.textAlign = 'left';
  ctx.font = font(26, 500);
  ctx.globalAlpha = 0.85;
  ctx.fillText(model.shopName ? 'كشف حساب' : '', PAD, 78);
  ctx.globalAlpha = 1;
  ctx.font = font(26, 400);
  if (model.clientPhone) {
    ctx.save();
    ctx.direction = 'ltr';
    ctx.fillText(model.clientPhone, PAD, 148);
    ctx.restore();
  }
}

function drawBalanceCard(ctx, model, top) {
  const kind = model.balanceKind;
  roundRect(ctx, PAD, top, TABLE_W, CARD_H, 24);
  ctx.fillStyle = COLORS[`${kind}Soft`];
  ctx.fill();

  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.muted;
  ctx.font = font(28, 600);
  ctx.fillText(`${model.balanceLabel} لحد ${model.dateText}`, WIDTH - PAD - 36, top + 62);

  ctx.fillStyle = COLORS[kind];
  ctx.font = font(56, 800);
  ctx.fillText(model.balanceAmount, WIDTH - PAD - 36, top + 134);

  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.muted;
  ctx.font = font(26, 500);
  ctx.fillText(model.countText, PAD + 36, top + 134);

  if (model.dueText) {
    ctx.fillStyle = model.dueOverdue ? COLORS.owes : COLORS.text;
    ctx.font = font(26, 700);
    ctx.fillText(fit(ctx, model.dueText, 420), PAD + 36, top + 62);
  }
}

function drawTable(ctx, model, top) {
  const right = WIDTH - PAD;
  let y = top;

  roundRect(ctx, PAD, y, TABLE_W, TABLE_HEAD_H, 16);
  ctx.fillStyle = COLORS.head;
  ctx.fill();
  ctx.fillStyle = COLORS.muted;
  ctx.font = font(26, 700);
  let x = right;
  for (const column of COLUMNS) {
    cell(ctx, column, x, y + 42, column.title);
    x -= column.width;
  }
  y += TABLE_HEAD_H;

  const lines = [];
  if (model.opening) lines.push({ opening: true, ...model.opening });
  lines.push(...model.rows);

  lines.forEach((line, index) => {
    if (index % 2 === 1) {
      ctx.fillStyle = COLORS.stripe;
      ctx.fillRect(PAD, y, TABLE_W, ROW_H);
    }
    const base = y + 47;
    x = right;
    if (line.opening) {
      ctx.fillStyle = COLORS.muted;
      ctx.font = font(26, 600);
      const span = COLUMNS[0].width + COLUMNS[1].width + COLUMNS[2].width + COLUMNS[3].width;
      ctx.textAlign = 'right';
      ctx.fillText(fit(ctx, line.text, span - 24), x - 12, base);
      x -= span;
    } else {
      for (const column of COLUMNS.slice(0, 4)) {
        const value = line[column.key];
        if (column.key === 'date') {
          ctx.fillStyle = COLORS.muted;
          ctx.font = font(24, 500);
        } else if (column.key === 'note') {
          ctx.fillStyle = COLORS.text;
          ctx.font = font(27, 600);
        } else {
          ctx.fillStyle = column.key === 'took' ? COLORS.owes : COLORS.owed;
          ctx.font = font(27, 700);
        }
        if (value) cell(ctx, column, x, base, value);
        x -= column.width;
      }
    }
    const last = COLUMNS[4];
    ctx.fillStyle = COLORS[line.kind];
    ctx.font = font(24, 700);
    cell(ctx, last, x, base, line.balance);

    y += ROW_H;
    ctx.fillStyle = COLORS.border;
    ctx.fillRect(PAD, y - 1, TABLE_W, 1);
  });

  // Totals over the whole account, not just the rows shown.
  ctx.fillStyle = COLORS.text;
  ctx.font = font(26, 800);
  x = right;
  cell(ctx, { ...COLUMNS[0], width: COLUMNS[0].width + COLUMNS[1].width }, x, y + 47, 'الإجمالي');
  x -= COLUMNS[0].width + COLUMNS[1].width;
  ctx.fillStyle = COLORS.owes;
  cell(ctx, COLUMNS[2], x, y + 47, model.totals.took, COLUMNS[2].width - 6);
  x -= COLUMNS[2].width;
  ctx.fillStyle = COLORS.owed;
  cell(ctx, COLUMNS[3], x, y + 47, model.totals.paid, COLUMNS[3].width - 6);
}

function drawFooter(ctx, height) {
  ctx.fillStyle = COLORS.border;
  ctx.fillRect(PAD, height - FOOTER_H, TABLE_W, 1);
  ctx.fillStyle = COLORS.muted;
  ctx.font = font(22, 500);
  ctx.textAlign = 'center';
  ctx.fillText('اتعمل بدفتر HATAB', WIDTH / 2, height - FOOTER_H / 2 + 8);
}

/** Draws the statement on the given canvas, resizing it to fit. */
export function drawStatement(canvas, model) {
  const height = statementHeight(model);
  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.direction = 'rtl';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = COLORS.white;
  ctx.fillRect(0, 0, WIDTH, height);

  drawHeader(ctx, model);
  const cardTop = HEADER_H + PAD;
  drawBalanceCard(ctx, model, cardTop);
  if (model.rows.length > 0 || model.opening) drawTable(ctx, model, cardTop + CARD_H + PAD);
  drawFooter(ctx, height);
}

/** Waits for the app's font so the picture isn't drawn in a fallback one. */
async function loadFonts() {
  if (!document.fonts?.load) return;
  try {
    await Promise.all([400, 600, 700, 800].map((weight) => document.fonts.load(font(32, weight), 'كشف حساب')));
  } catch {
    // A missing font only changes the look; the statement is still readable.
  }
}

/** The statement as a PNG Blob. */
export async function renderStatement(model) {
  await loadFonts();
  const canvas = document.createElement('canvas');
  drawStatement(canvas, model);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob returned nothing'))), 'image/png');
  });
}
