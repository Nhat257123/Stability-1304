# CLAUDE.md

File này cung cấp hướng dẫn cho Claude Code (claude.ai/code) khi làm việc với mã nguồn trong repository này.

## Tổng quan dự án

**StabilityLab** — Ứng dụng SPA theo dõi độ ổn định sản phẩm, dùng để quản lý các thử nghiệm lão hóa cấp tốc và kiểm tra stress (phương pháp M1–M5) cho mẫu phòng lab. Xây dựng bằng vanilla JS + Supabase; triển khai lên Vercel dưới dạng static site.

## Chạy ứng dụng

Không cần build. Mở `index.html` trực tiếp trên trình duyệt, hoặc chạy local:

```bash
npx serve .
# hoặc
python -m http.server 8080
```

## Script tự động hóa

Báo cáo email hàng ngày chạy qua GitHub Actions (cron `0 1 * * *` = 08:00 giờ Việt Nam):

```bash
# Cài dependencies (không có package.json — cài thủ công)
npm install @supabase/supabase-js resend

# Chạy thủ công
node scripts/daily_report.js
```

Biến môi trường cần thiết (lưu trong GitHub Secrets): `SUPABASE_URL`, `SUPABASE_KEY`, `RESEND_API_KEY`.

## Kiến trúc

### Frontend một file duy nhất (`index.html` ~3700 dòng)

Toàn bộ ứng dụng nằm trong một file: cấu trúc HTML, CSS nhúng, và toàn bộ JavaScript. Các phần được đánh dấu bằng comment tiếng Việt (ví dụ: `// SUPABASE CRUD`, `// SELECTION LOGIC`).

**State** được quản lý qua các biến toàn cục (`samples`, `checkpoints`, `currentFilter`, `selectedIds`, `currentPage`, v.v.).

**Các thuật toán chính:**
- `getTrayInfo()` — ánh xạ ngày bắt đầu mẫu sang ô khay (1–12, theo từng nửa tháng)
- `snapToCheckDay()` — làm tròn ngày checkpoint lý thuyết về ngày 15 hoặc ngày cuối tháng
- `getSampleStatus()` — tính trạng thái quá hạn / sắp đến / đang chạy / hoàn thành từ ngày checkpoint
- `generateCheckpoints()` — tạo toàn bộ lịch checkpoint cho một mẫu dựa theo phương pháp

### Cấu trúc Supabase

| Bảng | Cột chính |
|---|---|
| `samples` | id, name, code, start_date, notes, images[], created_at |
| `checkpoints` | id, sample_id, method_key, label, cycle_num, scheduled_date, theoretical_date, status, notes, images[], check_date |

Ảnh được lưu trong Storage bucket `stability-images`.

**Lưu ý bảo mật:** Supabase anon key được nhúng trực tiếp trong mã client. Bắt buộc phải bật RLS trên tất cả các bảng để ngăn truy cập trái phép.

### Tự động hóa (`scripts/daily_report.js`)

Script Node.js độc lập — truy vấn Supabase lấy các checkpoint M1 sắp đến hạn trong 3 ngày hoặc đã quá hạn, sau đó gửi email HTML qua Resend API.

## Thư viện (CDN, không dùng npm cho frontend)

- `@supabase/supabase-js` v2 — database, auth, storage
- `xlsx` v0.18.5 — xuất file Excel
- Google Fonts: Plus Jakarta Sans
# Yêu Cầu: Đánh Giá Mã Nguồn (Code Review) và Cải Tiến Trang Web

Bạn là một Chuyên gia Lập trình Full-Stack (Senior Full-Stack Developer) với nhiều năm kinh nghiệm trong việc thiết kế kiến trúc hệ thống, tối ưu hóa hiệu suất và nâng cao trải nghiệm người dùng (UI/UX). Nhiệm vụ của bạn là đánh giá mã nguồn trang web của tôi và đề xuất các phương án cải tiến.

## 1. Bối cảnh
<context>
- **Mục đích trang web:** Theo dõi độ ổn định các mẫu
- **Công nghệ đang sử dụng:**html, css, javascript, supabase
- **Mục tiêu hiện tại:** Tôi muốn mã nguồn sạch sẽ hơn, chạy nhanh hơn và có thêm các chức năng hữu ích để giúp theo dõi mẫu hiệu quả.
</context>

## 2. Nhiệm vụ
<instructions>
Dựa vào mã nguồn tôi cung cấp bên dưới, hãy thực hiện các công việc sau:

1. **Đánh giá mã nguồn (Code Review):**
   - Chỉ ra các lỗi (bugs), rủi ro bảo mật tiềm ẩn hoặc các đoạn code dư thừa.
   - Đánh giá mức độ tuân thủ các nguyên tắc lập trình tốt (Best Practices) như tính dễ đọc, khả năng bảo trì.
   - Phân tích và đề xuất cách tối ưu hóa hiệu suất (tốc độ tải, render DOM, quản lý state...).

2. **Cải tiến UI/UX & Tính năng mới:**
   - Đề xuất 2-3 tính năng mới (hoặc hiệu ứng) phù hợp với bối cảnh của trang web để nâng cao trải nghiệm người dùng.
   - Chỉ ra những điểm thiết kế hiện tại có thể gây khó khăn cho người dùng và cách khắc phục.

3. **Cung cấp Mã nguồn sửa đổi:**
   - Viết lại các đoạn code cần tối ưu.
   - Cung cấp mã nguồn cho các tính năng mới mà bạn vừa đề xuất.
   - Hãy thêm comment (ghi chú) vào trong code để giải thích lý do bạn thay đổi.
</instructions>

## 3. Định dạng đầu ra mong muốn
<output_format>
Vui lòng trình bày câu trả lời theo cấu trúc sau:
- **Tổng quan:** Tóm tắt ngắn gọn tình trạng mã nguồn hiện tại.
- **Vấn đề & Khắc phục:** Liệt kê các lỗi và cách sửa (kèm code minh họa).
- **Đề xuất nâng cấp:** Các tính năng mới và lợi ích của chúng.
- **Code hoàn chỉnh:** Các đoạn code quan trọng đã được tối ưu hoặc viết mới (bọc trong markdown code block rõ ràng).
</output_format>

## 4. Dữ liệu đầu vào
<source_code>
[DÁN TOÀN BỘ MÃ NGUỒN HTML/CSS/JS HOẶC CÁC COMPONENT CẦN REVIEW VÀO ĐÂY]
</source_code>