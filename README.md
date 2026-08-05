# BrewLedger

Dashboard theo dõi thời gian pha của máy Casadio Undici, chạy trên Cloudflare Workers với D1 và Durable Objects.

## Chức năng

- Nhận dữ liệu qua HTTP hoặc WebSocket với `API_KEY`.
- Realtime dashboard qua Durable Object WebSocket Hibernation.
- Xem toàn bộ lịch sử D1 theo từng ngày, không giới hạn 30 ngày.
- Điều hướng ngày bằng bộ chọn ngày và nút trước/sau; bộ lọc shot nằm theo ngày, không phân trang.
- Analysis theo khoảng ngày tùy chọn với 5 nhóm: `<20s`, `20–25s`, `25–28s`, `28–30s`, `>30s`.
- Hiển thị phần trăm consistency cho ngày đang chọn và toàn bộ 30 ngày gần nhất.
- Analysis có thể chuyển giữa biểu đồ trung bình theo ngày và scatter theo từng shot (0–40s, khung giờ 00:00–23:30).

## Chạy local

```bash
npm ci
npm run db:migrate:local
npx wrangler secret put API_KEY
npm run dev
```

## Kiểm tra

```bash
npm run ci
```

## Deploy

```bash
npm run db:migrate:remote
npx wrangler deploy
```

`x-api-key` là cách được khuyến nghị cho `/api/ingest`. Query parameter `key` vẫn được giữ để tương thích với firmware hiện tại và nên được loại bỏ sau khi firmware chuyển sang header.
