import nodemailer from 'nodemailer';
import type { NotifyEvent } from './telegramNotifier.js';

let transporter: nodemailer.Transporter | null = null;

function getTransport(): nodemailer.Transporter | null {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.yandex.ru',
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: String(process.env.SMTP_SECURE ?? 'true') !== 'false',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

function buildEmail(event: NotifyEvent): { subject: string; html: string } | null {
  if (event.type === 'anomaly') {
    const a = event.anomaly;
    if (a.severity === 'high') {
      return {
        subject: `🔴 Аномалия цены: ${a.product_name}`,
        html: `<p><strong>Аномалия цены</strong></p>
          <p>Товар: ${a.product_name}<br/>
          Поставщик: ${a.supplier_name}<br/>
          Было: ${a.price_before} → Стало: ${a.price_after} (${a.change_pct >= 0 ? '+' : ''}${a.change_pct.toFixed(1)}%)</p>`,
      };
    }
    return {
      subject: `Изменение цены: ${a.product_name}`,
      html: `<p>Товар: ${a.product_name}, изменение ${a.change_pct >= 0 ? '+' : ''}${a.change_pct.toFixed(1)}%</p>`,
    };
  }
  if (event.type === 'recommendation') {
    const r = event.rec;
    return {
      subject: `Рекомендация закупки: ${r.product_name ?? r.product_id}`,
      html: `<p>Рекомендация по товару ${r.product_name ?? r.product_id}</p>`,
    };
  }
  if (event.type === 'recommendation_batch') {
    return {
      subject: `Новые рекомендации закупок (${event.lines.length} шт.)`,
      html: `<pre>${event.lines.slice(0, 50).join('\n')}</pre>`,
    };
  }
  if (event.type === 'order_status') {
    return {
      subject: `Заявка «${event.order.title ?? '#'}»: статус изменён`,
      html: `<p>Статус: ${event.oldStatus} → ${event.newStatus}</p>`,
    };
  }
  return null;
}

export async function sendEmailNotification(to: string, event: NotifyEvent): Promise<void> {
  const t = getTransport();
  if (!t) return;
  const body = buildEmail(event);
  if (!body) return;
  const from = process.env.SMTP_FROM ?? `PriceRadar <${process.env.SMTP_USER}>`;
  await t.sendMail({
    from,
    to,
    subject: body.subject,
    html: body.html,
  });
}
