import { BaseService } from '../../lib/base-service.js';
import { NotFoundError, ConflictError } from '../../lib/errors.js';
import { ListHotelWorkersQuery } from './types.js';

export class HotelWorkerService extends BaseService {
  async listHotelWorkers(hotelId: string, query: ListHotelWorkersQuery) {
    const { page, limit, role, search, is_active } = query;
    const skip = (page - 1) * limit;

    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundError('Hotel not found');

    const where: Record<string, unknown> = {
      hotel_ids: { has: hotelId },
      deleted_at: null,
    };
    if (role) where['role'] = role.toUpperCase();
    if (is_active !== undefined) where['is_active'] = is_active === 'true';
    if (search) {
      where['OR'] = [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [workers, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          phone: true,
          role: true,
          is_active: true,
          created_at: true,
        },
        orderBy: [{ role: 'asc' }, { first_name: 'asc' }],
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      workers: workers.map((w: { id: string; email: string; first_name: string; last_name: string; phone: string | null; role: string; is_active: boolean; created_at: Date }) => ({ ...w, role: w.role.toLowerCase() })),
      pagination: {
        page, per_page: limit, total,
        total_pages: Math.ceil(total / limit),
        has_next: page * limit < total,
        has_prev: page > 1,
      },
    };
  }

  async assignWorker(hotelId: string, workerId: string, actorId: string, actorRole: string, ip?: string) {
    const [hotel, worker] = await Promise.all([
      this.prisma.hotel.findUnique({ where: { id: hotelId } }),
      this.prisma.user.findUnique({ where: { id: workerId } }),
    ]);

    if (!hotel) throw new NotFoundError('Hotel not found');
    if (!worker || worker.deleted_at) throw new NotFoundError('Worker not found');

    if (worker.hotel_ids.includes(hotelId)) {
      throw new ConflictError('Worker is already assigned to this hotel');
    }

    const updated = await this.prisma.user.update({
      where: { id: workerId },
      data: { hotel_ids: { push: hotelId } },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        hotel_ids: true,
        is_active: true,
      },
    });

    await this.logAudit(actorId, actorRole, 'MODIFY', 'HOTEL_WORKER', workerId, { hotel_id: hotelId, action: 'assign' }, ip);
    return { ...updated, role: updated.role.toLowerCase() };
  }

  async removeWorker(hotelId: string, workerId: string, actorId: string, actorRole: string, ip?: string) {
    const [hotel, worker] = await Promise.all([
      this.prisma.hotel.findUnique({ where: { id: hotelId } }),
      this.prisma.user.findUnique({ where: { id: workerId } }),
    ]);

    if (!hotel) throw new NotFoundError('Hotel not found');
    if (!worker || worker.deleted_at) throw new NotFoundError('Worker not found');

    if (!worker.hotel_ids.includes(hotelId)) {
      throw new NotFoundError('Worker is not assigned to this hotel');
    }

    const updatedIds = worker.hotel_ids.filter((id: string) => id !== hotelId);

    const updated = await this.prisma.user.update({
      where: { id: workerId },
      data: { hotel_ids: updatedIds },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        hotel_ids: true,
        is_active: true,
      },
    });

    await this.logAudit(actorId, actorRole, 'MODIFY', 'HOTEL_WORKER', workerId, { hotel_id: hotelId, action: 'remove' }, ip);
    return { ...updated, role: updated.role.toLowerCase() };
  }
}

export const hotelWorkerService = new HotelWorkerService();
