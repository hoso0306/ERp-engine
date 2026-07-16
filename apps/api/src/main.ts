import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // exposedHeaders: Content-Disposition mặc định KHÔNG lộ ra cho JS ở origin
  // khác (CORS) — cần thiết để FE đọc tên file thật khi tải template/export
  // qua fetch (không dùng window.open vì cần đính kèm Authorization header).
  // X-Refreshed-Token: FE đọc để làm mới phiên đăng nhập theo hoạt động
  // (sliding session, xem auth.guard.ts).
  app.enableCors({ exposedHeaders: ['Content-Disposition', 'X-Refreshed-Token'] });
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
