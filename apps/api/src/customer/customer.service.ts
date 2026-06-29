import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: CustomerQueryDto) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '10', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
    };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.customerGroupId) {
      where.customerGroupId = query.customerGroupId;
    }

    if (query.deliveryRouteId) {
      where.deliveryRouteId = query.deliveryRouteId;
    }

    if (query.status === 'ACTIVE' || query.status === 'INACTIVE') {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customerGroup: { select: { id: true, name: true } },
          deliveryRoute: { select: { id: true, name: true } },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findAllGroups() {
    return this.prisma.customerGroup.findMany({ orderBy: { name: 'asc' } });
  }

  async findAllRoutes() {
    return this.prisma.deliveryRoute.findMany({ orderBy: { name: 'asc' } });
  }
}
