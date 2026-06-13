import { BaseService } from '../../lib/base-service.js';
import { NotFoundError, ConflictError } from '../../lib/errors.js';
import {
  CreateHotelRequest, UpdateHotelRequest,
  CreateRoomRequest, UpdateRoomRequest,
  ListHotelsQuery, ListRoomsQuery,
} from './types.js';

export class CrmService extends BaseService {
  // ── Hotels ─────────────────────────────────────────────────────────────────

  async listHotels(query: ListHotelsQuery, actorRole: string) {
    const { page, limit, search, is_active, country } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (is_active !== undefined) where['is_active'] = is_active === 'true';
    if (country) where['country'] = { equals: country, mode: 'insensitive' };
    if (search) {
      where['OR'] = [
        { name: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Non-admins/managers see only active hotels
    if (!['admin', 'manager'].includes(actorRole)) {
      where['is_active'] = true;
    }

    const [hotels, total] = await Promise.all([
      this.prisma.hotel.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        select: {
          id: true, name: true, city: true, country: true,
          address: true, timezone: true, is_active: true,
          created_at: true, updated_at: true,
          _count: { select: { rooms: true } },
        },
      }),
      this.prisma.hotel.count({ where }),
    ]);

    return {
      hotels,
      pagination: {
        page, per_page: limit, total,
        total_pages: Math.ceil(total / limit),
        has_next: page * limit < total,
        has_prev: page > 1,
      },
    };
  }

  async getHotel(hotelId: string, actorId: string, actorRole: string, ip?: string) {
    const hotel = await this.prisma.hotel.findUnique({
      where: { id: hotelId },
      include: { _count: { select: { rooms: true } } },
    });
    if (!hotel) throw new NotFoundError('Hotel not found');

    await this.logAudit(actorId, actorRole, 'VIEW', 'HOTEL', hotelId, {}, ip);
    return hotel;
  }

  async createHotel(data: CreateHotelRequest, actorId: string, actorRole: string, ip?: string) {
    const hotel = await this.prisma.hotel.create({
      data: {
        name: data.name,
        city: data.city,
        country: data.country,
        address: data.address,
        timezone: data.timezone,
      },
    });

    await this.logAudit(actorId, actorRole, 'MODIFY', 'HOTEL', hotel.id, { action: 'create', name: hotel.name }, ip);
    return hotel;
  }

  async updateHotel(hotelId: string, data: UpdateHotelRequest, actorId: string, actorRole: string, ip?: string) {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundError('Hotel not found');

    const updated = await this.prisma.hotel.update({
      where: { id: hotelId },
      data: {
        name: data.name ?? hotel.name,
        city: data.city ?? hotel.city,
        country: data.country ?? hotel.country,
        address: data.address ?? hotel.address,
        timezone: data.timezone ?? hotel.timezone,
        is_active: data.is_active ?? hotel.is_active,
      },
    });

    await this.logAudit(actorId, actorRole, 'MODIFY', 'HOTEL', hotelId, { fields: Object.keys(data) }, ip);
    return updated;
  }

  async deleteHotel(hotelId: string, actorId: string, actorRole: string, ip?: string) {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundError('Hotel not found');

    // Soft-delete: deactivate and record deletion timestamp
    await this.prisma.hotel.update({ where: { id: hotelId }, data: { is_active: false, deleted_at: new Date() } });
    await this.logAudit(actorId, actorRole, 'DELETE', 'HOTEL', hotelId, { name: hotel.name }, ip);
  }

  // ── Rooms ──────────────────────────────────────────────────────────────────

  async listRooms(hotelId: string, query: ListRoomsQuery) {
    const { page, limit, status, type } = query;
    const skip = (page - 1) * limit;

    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundError('Hotel not found');

    const where: Record<string, unknown> = { hotel_id: hotelId };
    if (status) where['status'] = status;
    if (type) where['type'] = type;

    const [rooms, total] = await Promise.all([
      this.prisma.room.findMany({ where, skip, take: limit, orderBy: { number: 'asc' } }),
      this.prisma.room.count({ where }),
    ]);

    return {
      rooms,
      pagination: {
        page, per_page: limit, total,
        total_pages: Math.ceil(total / limit),
        has_next: page * limit < total,
        has_prev: page > 1,
      },
    };
  }

  async getRoom(hotelId: string, roomId: string) {
    const room = await this.prisma.room.findFirst({ where: { id: roomId, hotel_id: hotelId } });
    if (!room) throw new NotFoundError('Room not found');
    return room;
  }

  async createRoom(hotelId: string, data: CreateRoomRequest, actorId: string, actorRole: string, ip?: string) {
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundError('Hotel not found');

    const existing = await this.prisma.room.findUnique({ where: { hotel_id_number: { hotel_id: hotelId, number: data.number } } });
    if (existing) throw new ConflictError(`Room ${data.number} already exists in this hotel`);

    const room = await this.prisma.room.create({
      data: { hotel_id: hotelId, number: data.number, type: data.type, notes: data.notes },
    });

    await this.logAudit(actorId, actorRole, 'MODIFY', 'ROOM', room.id, { action: 'create', hotel_id: hotelId, number: data.number }, ip);
    return room;
  }

  async updateRoom(hotelId: string, roomId: string, data: UpdateRoomRequest, actorId: string, actorRole: string, ip?: string) {
    const room = await this.prisma.room.findFirst({ where: { id: roomId, hotel_id: hotelId } });
    if (!room) throw new NotFoundError('Room not found');

    if (data.number && data.number !== room.number) {
      const conflict = await this.prisma.room.findUnique({ where: { hotel_id_number: { hotel_id: hotelId, number: data.number } } });
      if (conflict) throw new ConflictError(`Room ${data.number} already exists in this hotel`);
    }

    const updated = await this.prisma.room.update({
      where: { id: roomId },
      data: {
        number: data.number ?? room.number,
        type: data.type ?? room.type,
        status: data.status ?? room.status,
        notes: data.notes ?? room.notes,
      },
    });

    await this.logAudit(actorId, actorRole, 'MODIFY', 'ROOM', roomId, { fields: Object.keys(data) }, ip);
    return updated;
  }
}

export const crmService = new CrmService();
