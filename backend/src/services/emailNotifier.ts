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

function wrapEmail(content: string): string {
  const emailHeader = `
<div style="background:#0F0F1A;padding:24px 32px;border-radius:12px 12px 0 0">
  <div style="display:flex;align-items:center;gap:10px">
    <div style="width:32px;height:32px;background:#4F46E5;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;color:#fff">⊕</div>
    <span style="color:#fff;font-weight:600;font-size:18px;letter-spacing:-0.3px">Vizor<span style="color:#818CF8">360</span></span>
  </div>
</div>`;
  const emailFooter = `
<div style="padding:24px 32px;border-top:1px solid #E4E4E7;text-align:center;color:#A1A1AA;font-size:12px">
  <p>Vizor360 — система контроля закупок</p>
  <p style="margin-top:4px">
    <a href="https://vizor360.ru" style="color:#4F46E5">vizor360.ru</a>
    &nbsp;·&nbsp;
    <a href="https://vizor360.ru/unsubscribe" style="color:#A1A1AA">Отписаться</a>
  </p>
</div>`;
  return `<div style="max-width:680px;margin:0 auto;background:#fff;border:1px solid #E4E4E7;border-radius:12px;overflow:hidden">${emailHeader}<div style="padding:24px 32px">${content}</div>${emailFooter}</div>`;
}

export async function sendEmailNotification(to: string, event: NotifyEvent): Promise<void> {
  const t = getTransport();
  if (!t) return;
  const body = buildEmail(event);
  if (!body) return;
  const from = process.env.SMTP_FROM ?? 'Vizor360 <info@vizor360.ru>';
  await t.sendMail({
    from,
    to,
    subject: `Vizor360: ${body.subject}`,
    html: wrapEmail(body.html),
  });
}

export async function sendSupplierOrderEmail(params: {
  to: string;
  contactName: string;
  restaurantName: string;
  items: Array<{ product_name: string; quantity: number | string; unit: string | null }>;
  orderLink: string;
  expiresAt: Date | string;
}): Promise<void> {
  const t = getTransport();
  if (!t) return;

  const rows = params.items
    .map((i) => {
      const qty = typeof i.quantity === 'string' ? i.quantity : String(i.quantity);
      const unit = i.unit ? ` ${i.unit}` : '';
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${i.product_name}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-family:monospace;text-align:right">${qty}${unit}</td>
      </tr>`;
    })
    .join('');

  const exp = typeof params.expiresAt === 'string' ? new Date(params.expiresAt) : params.expiresAt;
  const expRu = Number.isFinite(exp.getTime()) ? exp.toLocaleDateString('ru-RU') : '';
  const content = `
    <p>Здравствуйте, <b>${params.contactName}</b>!</p>
    <p><b>${params.restaurantName}</b> разместил заказ:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr style="background:#f4f4f5">
        <th style="padding:8px;text-align:left">Товар</th>
        <th style="padding:8px;text-align:right">Количество</th>
      </tr>
      ${rows}
    </table>
    ${
      expRu
        ? `<p style="color:#6b7280;font-size:13px">Ссылка действует до ${expRu}</p>`
        : ''
    }
    <a href="${params.orderLink}"
      style="display:inline-block;background:#4F46E5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:500;margin-top:8px">
      Открыть заказ
    </a>
  `;

  const from = process.env.SMTP_FROM ?? 'Vizor360 <info@vizor360.ru>';
  await t.sendMail({
    from,
    to: params.to,
    subject: `Новый заказ от ${params.restaurantName}`,
    html: wrapEmail(content),
  });
}
