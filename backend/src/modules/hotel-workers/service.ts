import { HotelWorkerStatus } from '@prisma/client';
import { BaseService } from '../../lib/base-service.js';
import { NotFoundError, ConflictError } from '../../lib/errors.js';
import { EnrollWorkerInput, ListWorkersQuery, HotelWorkerDto } from './types.js';

export class HotelWorkerService extends BaseService {
  // Projects a HotelWorker row to the PATCH-05e response contract.
  private toDto(hw: {
    id: string;
    hotel_id: string;
    worker_id: string;
    position: string;
    status: HotelWorkerStatus;
    invited_at: Date;
    joined_at: Date | null;
    left_at: Date | null;
    created_at: Date;
  }): HotelWorkerDto {
    return {
      id: hw.id,
      hotel_id: hw.hotel_id,
      worker_id: hw.worker_id,
      role: hw.position,
      start_date: (hw.joined_at ?? hw.invited_at).toISOString(),
      end_date: hw.left_at ? hw.left_at.toISOString() : null,
      is_active: hw.status === HotelWorkerStatus.ACTIVE,
      created_at: hw.created_at.toISOString(),
    };
  }

  async enroll(
    hotelId: string,
    input: EnrollWorkerInput,
    actorId: string,
    actorRole: string
  ): Promise<HotelWorkerDto> {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundError('Hotel not found');

    const worker = await this.prisma.user.findUnique({ where: { id: input.worker_id } });
    if (!worker) throw new NotFoundError('Worker not found');

    const existing = await this.prisma.hotelWorker.findUnique({
      where: { hotel_id_worker_id: { hotel_id: hotelId, worker_id: input.worker_id } },
    });

    if (existing && existing.status !== HotelWorkerStatus.REMOVED) {
      throw new ConflictError('Worker is already enrolled in this hotel');
    }

    const hw = await this.prisma.hotelWorker.upsert({
      where: { hotel_id_worker_id: { hotel_id: hotelId, worker_id: input.worker_id } },
      create: {
        hotel_id: hotelId,
        worker_id: input.worker_id,
        position: input.position,
        status: HotelWorkerStatus.INVITED,
        hourly_rate: input.hourly_rate,
        currency: input.currency ?? 'EUR',
        notes: input.notes,
      },
      update: {
        position: input.position,
        status: HotelWorkerStatus.INVITED,
        hourly_rate: input.hourly_rate,
        currency: input.currency ?? 'EUR',
        notes: input.notes,
        left_at: null,
        joined_at: null,
        invited_at: new Date(),
      },
    });

    await this.logAudit(actorId, actorRole, 'ENROLL_WORKER', 'HotelWorker', hw.id, {
      hotel_id: hotelId,
      worker_id: input.worker_id,
      position: input.position,
    });

    return this.toDto(hw);
  }

  async listByHotel(
    hotelId: string,
    query: ListWorkersQuery
  ): Promise<{ data: HotelWorkerDto[]; total: number }> {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundError('Hotel not found');

    const where = {
      hotel_id: hotelId,
      ...(query.status ? { status: query.status as HotelWorkerStatus } : {}),
      ...(query.position ? { position: query.position } : {}),
    };

    const [records, total] = await Promise.all([
      this.prisma.hotelWorker.findMany({
        where,
        skip: (query.page - 1) * query.per_page,
        take: query.per_page,
        orderBy: { invited_at: 'desc' },
      }),
      this.prisma.hotelWorker.count({ where }),
    ]);

    return { data: records.map((r) => this.toDto(r)), total };
  }

  async updateStatus(
    hotelId: string,
    workerId: string,
    newStatus: HotelWorkerStatus,
    actorId: string,
    actorRole: string
  ): Promise<HotelWorkerDto> {
    const hw = await this.prisma.hotelWorker.findUnique({
      where: { hotel_id_worker_id: { hotel_id: hotelId, worker_id: workerId } },
    });
    if (!hw) throw new NotFoundError('Hotel worker enrollment not found');

    const allowed: Partial<Record<HotelWorkerStatus, HotelWorkerStatus[]>> = {
      [HotelWorkerStatus.INVITED]: [HotelWorkerStatus.ACTIVE, HotelWorkerStatus.REMOVED],
      [HotelWorkerStatus.ACTIVE]: [HotelWorkerStatus.SUSPENDED, HotelWorkerStatus.REMOVED],
      [HotelWorkerStatus.SUSPENDED]: [HotelWorkerStatus.ACTIVE, HotelWorkerStatus.REMOVED],
    };

    if (!allowed[hw.status]?.includes(newStatus)) {
      throw new ConflictError(
        `Cannot transition from ${hw.status} to ${newStatus}`
      );
    }

    const updated = await this.prisma.hotelWorker.update({
      where: { hotel_id_worker_id: { hotel_id: hotelId, worker_id: workerId } },
      data: {
        status: newStatus,
        joined_at: newStatus === HotelWorkerStatus.ACTIVE ? new Date() : hw.joined_at,
        left_at: newStatus === HotelWorkerStatus.REMOVED ? new Date() : hw.left_at,
      },
    });

    await this.logAudit(actorId, actorRole, 'UPDATE_WORKER_STATUS', 'HotelWorker', hw.id, {
      hotel_id: hotelId,
      worker_id: workerId,
      from: hw.status,
      to: newStatus,
    });

    return this.toDto(updated);
  }

  async remove(
    hotelId: string,
    workerId: string,
    actorId: string,
    actorRole: string
  ): Promise<void> {
    const hw = await this.prisma.hotelWorker.findUnique({
      where: { hotel_id_worker_id: { hotel_id: hotelId, worker_id: workerId } },
    });
    if (!hw) throw new NotFoundError('Hotel worker enrollment not found');

    await this.prisma.hotelWorker.update({
      where: { hotel_id_worker_id: { hotel_id: hotelId, worker_id: workerId } },
      data: {
        status: HotelWorkerStatus.REMOVED,
        left_at: new Date(),
      },
    });

    await this.logAudit(actorId, actorRole, 'REMOVE_WORKER', 'HotelWorker', hw.id, {
      hotel_id: hotelId,
      worker_id: workerId,
    });
  }

  async checkMembership(
    hotelId: string,
    workerId: string
  ): Promise<boolean> {
    const hw = await this.prisma.hotelWorker.findUnique({
      where: { hotel_id_worker_id: { hotel_id: hotelId, worker_id: workerId } },
    });
    return hw?.status === HotelWorkerStatus.ACTIVE;
  }
}
