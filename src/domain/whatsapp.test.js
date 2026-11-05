import { describe, expect, it } from 'vitest';
import { reminderMessage, whatsappUrl } from './whatsapp.js';

const today = '2026-11-05';

describe('reminderMessage', () => {
  it('tells a client how much they owe, signed with the shop name', () => {
    const text = reminderMessage({ clientName: 'أحمد', balance: 5000, shopName: ' محل الأمل ', today });
    expect(text).toBe(
      [
        'السلام عليكم يا أحمد،',
        'حسابك عندنا لحد النهارده (5 نوفمبر 2026): عليك 50 ج.م.',
        'شكرًا لتعاملك معانا.',
        'محل الأمل',
      ].join('\n'),
    );
  });

  it('handles credit and settled accounts', () => {
    expect(reminderMessage({ clientName: 'منى', balance: -3050, today })).toContain('ليك عندنا 30.50 ج.م');
    const settled = reminderMessage({ clientName: 'سامح', balance: 0, today });
    expect(settled).toContain('خالص');
    expect(settled.split('\n')).toHaveLength(3);
  });
});

describe('whatsappUrl', () => {
  it('opens a chat with the number and the message', () => {
    const url = new URL(whatsappUrl('010 1234 5678', 'السلام عليكم\nسطر تاني'));
    expect(url.origin + url.pathname).toBe('https://wa.me/201012345678');
    expect(url.searchParams.get('text')).toBe('السلام عليكم\nسطر تاني');
  });

  it('lets WhatsApp ask for the chat when there is no valid number', () => {
    expect(whatsappUrl('', 'hi')).toBe('https://wa.me/?text=hi');
    expect(whatsappUrl('123', 'hi')).toBe('https://wa.me/?text=hi');
  });
});
