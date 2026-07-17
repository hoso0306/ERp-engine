import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Body parser mặc định giới hạn 100kb — không đủ cho Company Settings gửi
  // logo + con dấu dạng base64 (mỗi ảnh tối đa 2MB gốc ở FE, ~2.7MB base64,
  // cả 2 cùng lúc ~5.4MB). Nâng lên 10mb cho JSON body.
  app.useBodyParser('json', { limit: '10mb' });
  // exposedHeaders: Content-Disposition mặc định KHÔNG lộ ra cho JS ở origin
  // khác (CORS) — cần thiết để FE đọc tên file thật khi tải template/export
  // qua fetch (không dùng window.open vì cần đính kèm Authorization header).
  // X-Refreshed-Token: FE đọc để làm mới phiên đăng nhập theo hoạt động
  // (sliding session, xem auth.guard.ts).
  app.enableCors({
    exposedHeaders: ['Content-Disposition', 'X-Refreshed-Token'],
  });
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
