import { isISODate } from './dates.js';
import { TX_TYPES } from './ledger.js';
import { parseAmount } from './money.js';
import { toWhatsAppNumber } from './phone.js';
import { cleanText, normalizeForSearch, toLatinDigits } from './text.js';

const result = (values, errors) => ({ values, errors, ok: Object.keys(errors).length === 0 });

/** Checks the client form. Returns { values, errors, ok } with messages ready to show. */
export function validateClientInput(input, existingClients = [], editingId = null) {
  const values = {
    name: cleanText(input.name),
    phone: cleanText(toLatinDigits(input.phone)),
    address: cleanText(input.address),
  };
  const errors = {};

  if (!values.name) {
    errors.name = 'اكتب اسم العميل';
  } else if (values.name.length > 80) {
    errors.name = 'الاسم طويل قوي';
  } else {
    const key = normalizeForSearch(values.name);
    const taken = existingClients.some(
      (client) => client.id !== editingId && normalizeForSearch(client.name) === key,
    );
    if (taken) errors.name = 'فيه عميل بنفس الاسم ده. زوّد حاجة تميّزه، زي اسم الشهرة أو المنطقة';
  }

  if (values.phone && !toWhatsAppNumber(values.phone)) {
    errors.phone = 'اكتب الرقم صح، زي 01012345678';
  }
  if (values.address.length > 200) errors.address = 'العنوان طويل قوي';

  return result(values, errors);
}

/** Checks the entry form. The amount comes back in piasters. */
export function validateTransactionInput(input) {
  const values = {
    type: input.type,
    amount: parseAmount(input.amount),
    date: input.date,
    note: cleanText(input.note),
    clientId: input.clientId || null,
  };
  const errors = {};

  if (!TX_TYPES.includes(values.type)) errors.type = 'اختار نوع الحركة';
  if (values.amount === null) errors.amount = 'اكتب مبلغ صحيح أكبر من صفر';
  if (!isISODate(values.date)) errors.date = 'اختار التاريخ';
  if (values.note.length > 200) errors.note = 'الملاحظة طويلة قوي';

  return result(values, errors);
}
