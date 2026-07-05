import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SettingModule } from '../setting/setting.module';
import { PermissionModule } from '../permission/permission.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';

@Module({
  imports: [
    SettingModule,
    // forwardRef vì PermissionModule cũng import ngược lại AuthModule để gọi
    // AuthService.setTemporaryPassword() khi tạo/reset User (xem permission.md
    // mục "Phụ thuộc Module Authentication" — phụ thuộc 2 chiều có chủ đích).
    forwardRef(() => PermissionModule),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  exports: [AuthService, AuthGuard, JwtModule],
})
export class AuthModule {}
