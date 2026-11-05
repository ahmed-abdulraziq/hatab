import { formatDate, todayISO } from './dates.js';
import { formatMoney } from './money.js';
import { toWhatsAppNumber } from './phone.js';

/** A short, polite reminder with the client's balance, ready to send on WhatsApp. */
export function reminderMessage({ clientName, balance, shopName = '', today = todayISO() }) {
  const asOf = `لحد النهارده (${formatDate(today)})`;
  const lines = [`السلام عليكم يا ${clientName}،`];

  if (balance > 0) lines.push(`حسابك عندنا ${asOf}: عليك ${formatMoney(balance)}.`);
  else if (balance < 0) lines.push(`حسابك عندنا ${asOf}: ليك عندنا ${formatMoney(-balance)}.`);
  else lines.push(`حسابك عندنا ${asOf} خالص، مفيش عليك أي حاجة.`);

  lines.push('شكرًا لتعاملك معانا.');
  const signature = shopName.trim();
  if (signature) lines.push(signature);
  return lines.join('\n');
}

/**
 * A wa.me link that opens a chat with the message typed in. Without a valid number,
 * WhatsApp asks which chat to send it to.
 */
export function whatsappUrl(phone, text) {
  const number = phone ? toWhatsAppNumber(phone) : null;
  return `https://wa.me/${number ?? ''}?text=${encodeURIComponent(text)}`;
}
