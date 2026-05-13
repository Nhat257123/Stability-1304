const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

const RECIPIENT_EMAILS = (process.env.RECIPIENT_EMAILS || process.env.GMAIL_USER)
  .split(',').map(e => e.trim()).filter(Boolean);

const LOOKAHEAD_DAYS = 3;

const METHODS = {
  m1: "Lão hoá cấp tốc",
  m2: "Phơi sáng",
  m3: "Chu kỳ nhiệt",
  m4: "Freeze-Thaw",
  m5: "Điều kiện phòng",
};

async function run() {
  console.log("🚀 Bắt đầu kiểm tra báo cáo hàng ngày...");

  const todayStr = new Date().toISOString().split('T')[0];
  const lookaheadStr = new Date(Date.now() + LOOKAHEAD_DAYS * 86400000).toISOString().split('T')[0];
  console.log(`📅 Ngày kiểm tra: ${todayStr} | Nhìn trước: ${lookaheadStr}`);

  const { data: checkpoints, error: cpError } = await supabase
    .from('checkpoints')
    .select('*')
    .eq('status', 'pending')
    .eq('method_key', 'm1')
    .lte('scheduled_date', lookaheadStr);

  if (cpError) throw cpError;

  if (!checkpoints || checkpoints.length === 0) {
    console.log("✅ Không có checkpoint nào cần báo cáo. Kết thúc.");
    return;
  }

  const sampleIds = [...new Set(checkpoints.map(cp => cp.sample_id))];
  const { data: samples, error: sError } = await supabase
    .from('samples')
    .select('id, name, code, start_date')
    .in('id', sampleIds);

  if (sError) throw sError;

  const sampleMap = {};
  samples.forEach(s => sampleMap[s.id] = s);

  const formatDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString("vi-VN");

  const overdue = checkpoints.filter(cp => cp.scheduled_date < todayStr);
  const upcoming = checkpoints.filter(cp => cp.scheduled_date >= todayStr);

  console.log(`📋 Quá hạn: ${overdue.length} | Sắp đến hạn: ${upcoming.length}`);

  const buildRows = (cps, color) => cps.map(cp => {
    const s = sampleMap[cp.sample_id];
    if (!s) return '';
    const methodLabel = METHODS[cp.method_key] || cp.method_key.toUpperCase();
    const cpLabel = cp.label || (cp.cycle_num != null ? `Chu kỳ ${cp.cycle_num}` : '—');
    const diff = Math.round((new Date(todayStr) - new Date(cp.scheduled_date)) / 86400000);
    const diffTxt = diff > 0 ? `Quá hạn ${diff} ngày` : diff === 0 ? 'Hôm nay!' : `Còn ${Math.abs(diff)} ngày`;
    return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0">
          <div style="font-weight:700;color:#0f172a">${s.name}</div>
          <div style="font-size:11px;color:#0d9488">${s.code}</div>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#475569">${methodLabel} — ${cpLabel}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px">
          <div style="font-weight:700;color:#0f172a">${formatDate(cp.scheduled_date)}</div>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0">
          <span style="background:${color};color:#fff;padding:3px 9px;border-radius:20px;font-size:12px;font-weight:700">${diffTxt}</span>
        </td>
      </tr>`;
  }).filter(Boolean).join('');

  const overdueRows = buildRows(overdue, '#e11d48');
  const upcomingRows = buildRows(upcoming, '#0d9488');

  const buildSection = (title, rows, count) => !count ? '' : `
    <div style="margin-bottom:24px">
      <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #e2e8f0">${title} <span style="background:#f1f5f9;color:#64748b;padding:2px 8px;border-radius:12px;font-size:12px">${count}</span></div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#f8fafc;text-align:left">
          <th style="padding:8px 12px;font-size:11px;color:#64748b;text-transform:uppercase">Mẫu</th>
          <th style="padding:8px 12px;font-size:11px;color:#64748b;text-transform:uppercase">Mốc KT</th>
          <th style="padding:8px 12px;font-size:11px;color:#64748b;text-transform:uppercase">Ngày KT</th>
          <th style="padding:8px 12px;font-size:11px;color:#64748b;text-transform:uppercase">Trạng thái</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  const emailHtml = `
    <div style="font-family:'Plus Jakarta Sans',sans-serif;background:#f8fafc;padding:40px 20px">
      <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1)">
        <div style="background:#0d9488;padding:24px;text-align:center;color:#fff">
          <div style="font-size:24px;font-weight:800;margin-bottom:4px">StabilityLab</div>
          <div style="font-size:14px;opacity:.9">Báo cáo kiểm tra mẫu hàng ngày</div>
        </div>
        <div style="padding:28px 32px">
          <h2 style="font-size:16px;color:#0f172a;margin-bottom:6px">Xin chào,</h2>
          <p style="color:#475569;font-size:14px;line-height:1.6;margin-bottom:24px">
            Ngày <strong>${formatDate(todayStr)}</strong> — tổng cộng <strong>${checkpoints.length} checkpoint</strong> cần xử lý:
            ${overdue.length ? `<span style="color:#e11d48;font-weight:700">${overdue.length} quá hạn</span>` : ''}
            ${overdue.length && upcoming.length ? ' · ' : ''}
            ${upcoming.length ? `<span style="color:#0d9488;font-weight:700">${upcoming.length} sắp đến hạn</span>` : ''}
          </p>
          ${buildSection('⚠️ Quá hạn — cần xử lý ngay', overdueRows, overdue.length)}
          ${buildSection('⏰ Sắp đến hạn (trong 3 ngày)', upcomingRows, upcoming.length)}
          <div style="text-align:center;margin-top:28px">
            <a href="https://stability-1304.vercel.app/" style="background:#0d9488;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">Truy cập StabilityLab →</a>
          </div>
        </div>
        <div style="background:#f8fafc;padding:18px;text-align:center;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0">
          Hệ thống theo dõi độ ổn định tự động · StabilityLab R&D
        </div>
      </div>
    </div>`;

  const subject = `[StabilityLab] ${overdue.length ? `⚠️ ${overdue.length} quá hạn · ` : ''}${upcoming.length} sắp KT — ${formatDate(todayStr)}`;

  for (const email of RECIPIENT_EMAILS) {
    await transporter.sendMail({
      from: `"StabilityLab" <${process.env.GMAIL_USER}>`,
      to: email,
      subject,
      html: emailHtml,
    });
    console.log(`✅ Email đã gửi tới ${email}`);
  }
}

run().catch(err => {
  console.error("❌ Lỗi thực thi script:", err);
  process.exit(1);
});
