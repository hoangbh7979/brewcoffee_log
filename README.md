# BrewLedger

Dashboard theo dõi thời gian pha của máy Casadio Undici, chạy trên Cloudflare Workers với D1 và Durable Objects.

## Chức năng

- Nhận dữ liệu qua HTTP hoặc WebSocket với `API_KEY`.
- Realtime dashboard qua Durable Object WebSocket Hibernation.
- Xem shot theo từng ngày trong 30 ngày gần nhất, 10 shot mỗi trang.
- Phân trang, lọc theo khoảng thời gian và xem chi tiết từng shot.
- Analysis 30 ngày với 5 nhóm: `<20s`, `20–25s`, `25–28s`, `28–30s`, `>30s`.

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
