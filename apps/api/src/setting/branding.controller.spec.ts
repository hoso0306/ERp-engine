import { Reflector } from '@nestjs/core';
import { BrandingController } from './branding.controller';
import { IS_PUBLIC_KEY } from '../auth/public.decorator';
import { SettingService } from './setting.service';

describe('BrandingController', () => {
  let controller: BrandingController;
  let settingService: { getBranding: jest.Mock };

  beforeEach(() => {
    settingService = {
      getBranding: jest.fn().mockResolvedValue({
        companyName: 'Xưởng Rèm Thăng Long',
        logo: 'https://example.com/logo.png',
      }),
    };
    controller = new BrandingController(
      settingService as unknown as SettingService,
    );
  });

  it('đánh dấu @Public() trên route GET / — AuthGuard sẽ bỏ qua xác thực', () => {
    const reflector = new Reflector();
    // Chỉ đọc metadata gắn trên method (Reflect), không gọi/bind method —
    // không liên quan tới cảnh báo "this" của unbound-method.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const getBranding = BrandingController.prototype.getBranding;
    const isPublic = reflector.get<boolean>(IS_PUBLIC_KEY, getBranding);
    expect(isPublic).toBe(true);
  });

  it('chỉ trả về companyName + logo — không lộ field nhạy cảm', async () => {
    const result = await controller.getBranding();

    expect(Object.keys(result).sort()).toEqual(['companyName', 'logo']);
  });
});
