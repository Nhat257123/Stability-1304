const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

// Khởi tạo các client từ biến môi trường (sẽ được cấu hình trong GitHub Secrets)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

const RECIPIENT_EMAIL = "quangnhat2572000@gmail.com";

async function run() {
  console.log("🚀 Bắt đầu kiểm tra báo cáo hàng ngày...");
  
  const todayStr = new Date().toISOString().split('T')[0];
  console.log(`📅 Ngày kiểm tra: ${todayStr}`);

  // 1. Lọc các checkpoint M1 cần kiểm tra hôm nay
  const { data: checkpoints, error: cpError } = await supabase
    .from('checkpoints')
    .select('*')
    .eq('method_key', 'm1')
    .eq('status', 'pending')
    .eq('scheduled_date', todayStr);

  if (cpError) throw cpError;

  if (!checkpoints || checkpoints.length === 0) {
    console.log("✅ Hôm nay không có mẫu M1 nào cần kiểm tra. Kết thúc.");
    return;
  }

  // 2. Lấy thông tin Tên mẫu cho các checkpoint tìm được
  const sampleIds = [...new Set(checkpoints.map(cp => cp.sample_id))];
  const { data: samples, error: sError } = await supabase
    .from('samples')
    .select('id, name, code, start_date')
    .in('id', sampleIds);

  if (sError) throw sError;

  const sampleMap = {};
  samples.forEach(s => sampleMap[s.id] = s);

  // 3. Soạn nội dung Email
  console.log(`🔍 Tìm thấy ${checkpoints.length} mẫu cần kiểm tra. Đang soạn email...`);

  // Tiền ích ngày tháng
  const formatDate = (d) => new Date(d).toLocaleDateString("vi-VN");

  const rowsHtml = checkpoints.map(cp => {
    const s = sampleMap[cp.sample_id];
    // Tính toán khay (logic giống web)
    const getTrayInfo = (startDate) => {
        const d = new Date(startDate);
        const month = d.getMonth() + 1, year = d.getFullYear();
        const half = d.getDate() <= 15 ? 1 : 2;
        const period = (year - 2024) * 24 + (month - 1) * 2 + (half - 1);
        const trayNum = (period % 12) + 1;
        return `Khay ${trayNum} (${half === 1 ? "Nửa đầu" : "Nửa cuối"} tháng ${month}/${year})`;
    };
    const tray = getTrayInfo(s.start_date);

    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
          <div style="font-weight: 700; color: #0f172a;">${s.name}</div>
          <div style="font-size: 11px; color: #0d9488;">${s.code}</div>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">${cp.label}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #4f46e5;">${tray}</td>
      </tr>
    `;
  }).join('');

  const emailHtml = `
    <div style="font-family: 'Plus Jakarta Sans', sans-serif; background: #f8fafc; padding: 40px 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
        <div style="background: #0d9488; padding: 24px; text-align: center; color: #ffffff;">
          <div style="font-size: 24px; font-weight: 800; margin-bottom: 4px;">StabilityLab</div>
          <div style="font-size: 14px; opacity: 0.9;">Báo cáo kiểm tra mẫu hàng ngày</div>
        </div>
        <div style="padding: 32px;">
          <h2 style="font-size: 18px; color: #0f172a; margin-bottom: 16px;">Chào bạn Nhật,</h2>
          <p style="color: #475569; line-height: 1.6; margin-bottom: 24px;">Hôm nay ngày <strong>${formatDate(todayStr)}</strong>, có <strong>${checkpoints.length} mẫu</strong> thuộc phương pháp Lão hóa cấp tốc (M1) cần bạn kiểm tra:</p>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <thead>
              <tr style="text-align: left; background: #f1f5f9;">
                <th style="padding: 12px; font-size: 12px; color: #64748b; text-transform: uppercase;">Mẫu sản phẩm</th>
                <th style="padding: 12px; font-size: 12px; color: #64748b; text-transform: uppercase;">Mốc KT</th>
                <th style="padding: 12px; font-size: 12px; color: #64748b; text-transform: uppercase;">Vị trí Khay</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div style="text-align: center; margin-top: 32px;">
            <a href="https://aaaqwtbistexvdhoeplh.supabase.co/" style="background: #0d9488; color: #ffffff; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px;">Truy cập StabilityLab →</a>
          </div>
        </div>
        <div style="background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          Hệ thống theo dõi độ ổn định tự động · StabilityLab R&D
        </div>
      </div>
    </div>
  `;

  // 4. Gửi email
  const { data: emailData, error: emailError } = await resend.emails.send({
    from: 'StabilityLab <onboarding@resend.dev>',
    to: RECIPIENT_EMAIL,
    subject: `[StabilityLab] Cần kiểm tra ${checkpoints.length} mẫu hôm nay - ${formatDate(todayStr)}`,
    html: emailHtml,
  });

  if (emailError) throw emailError;

  console.log("✅ Email đã được gửi thành công!");
}

run().catch(err => {
  console.error("❌ Lỗi thực thi script:", err);
  process.exit(1);
});
