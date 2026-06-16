import { Prisma, Attendance, AttendanceStatus } from '@prisma/client';
import { BaseService } from '../../lib/base-service.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors.js';
import { notificationService } from '../notifications/service.js';
import { AttendanceDto, CheckInInput, ListAttendanceQuery, UpdateAttendanceInput } from './types.js';

export class AttendanceService extends BaseService {
  private toDto(a: Attendance): AttendanceDto {
    return {
      id: a.id,
      assignment_id: a.assignment_id,
      worker_id: a.worker_id,
      hotel_id: a.hotel_id,
      status: a.status,
      check_in_at: a.check_in_at?.toISOString() ?? null,
      check_out_at: a.check_out_at?.toISOString() ?? null,
      expected_start: a.expected_start?.toISOString() ?? null,
      expected_end: a.expected_end?.toISOString() ?? null,
      minutes_late: a.minutes_late,
      minutes_worked: a.minutes_worked,
      notes: a.notes,
      is_verified: a.is_verified,
      verified_by_id: a.verified_by_id,
      verified_at: a.verified_at?.toISOString() ?? null,
      created_at: a.created_at.toISOString(),
      updated_at: a.updated_at.toISOString(),
    };
  }

  async checkIn(
    input: CheckInInput,
    actorId: string,
    actorRole: string
  ): Promise<AttendanceDto> {
    const assignment = await this.prisma.workerAssignment.findUnique({
      where: { id: input.assignment_id },
    });
    if (!assignment) throw new NotFoundError('Assignment not found');
    if (assignment.worker_id !== actorId) {
      throw new ForbiddenError('Can only check in to your own assignment');
    }

    // Find the pre-created EXPECTED attendance record
    const existing = await this.prisma.attendance.findUnique({
      where: { assignment_id: input.assignment_id },
    });
    if (!existing) throw new NotFoundError('Attendance record not found');
    if (existing.status !== AttendanceStatus.EXPECTED) {
      throw new ConflictError('Already checked in');
    }

    const now = new Date();
    const minutesLate = existing.expected_start
      ? Math.max(0, Math.floor((now.getTime() - existing.expected_start.getTime()) / 60000))
      : null;

    const updated = await this.prisma.attendance.update({
      where: { id: existing.id },
      data: {
        check_in_at: now,
        status: minutesLate && minutesLate > 0 ? AttendanceStatus.LATE : AttendanceStatus.PRESENT,
        minutes_late: minutesLate,
        notes: input.notes ?? existing.notes,
      },
    });

    await this.logAudit(actorId, actorRole, 'CHECK_IN', 'ATTENDANCE', updated.id, {
      assignment_id: input.assignment_id,
    });

    return this.toDto(updated);
  }

  async list(
    query: ListAttendanceQuery,
    actor: { userId: string; role: string }
  ): Promise<{ data: AttendanceDto[]; total: number }> {
    const where: Prisma.AttendanceWhereInput = {
      ...(query.hotel_id ? { hotel_id: query.hotel_id } : {}),
      ...(query.assignment_id ? { assignment_id: query.assignment_id } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.is_verified !== undefined ? { is_verified: query.is_verified } : {}),
    };

    if (actor.role !== 'admin' && actor.role !== 'manager' && actor.role !== 'checker') {
      where.worker_id = actor.userId;
    } else if (query.worker_id) {
      where.worker_id = query.worker_id;
    }

    const [records, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        skip: (query.page - 1) * query.per_page,
        take: query.per_page,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.attendance.count({ where }),
    ]);

    return { data: records.map((r) => this.toDto(r)), total };
  }

  async getById(
    id: string,
    actor: { userId: string; role: string }
  ): Promise<AttendanceDto> {
    const record = await this.prisma.attendance.findUnique({ where: { id } });
    if (!record) throw new NotFoundError('Attendance record not found');

    if (actor.role !== 'admin' && actor.role !== 'manager') {
      if (record.worker_id !== actor.userId) {
        throw new ForbiddenError('Cannot access this attendance record');
      }
    }

    return this.toDto(record);
  }

  async update(
    id: string,
    input: UpdateAttendanceInput,
    actorId: string,
    actorRole: string
  ): Promise<AttendanceDto> {
    const record = await this.prisma.attendance.findUnique({ where: { id } });
    if (!record) throw new NotFoundError('Attendance record not found');

    const isWorker = actorRole !== 'admin' && actorRole !== 'manager' && actorRole !== 'checker';

    if (isWorker) {
      if (record.worker_id !== actorId) {
        throw new ForbiddenError('Cannot modify another worker\'s attendance');
      }
      // Workers may only set check_out_at and notes
      if (
        input.status !== undefined ||
        input.minutes_late !== undefined ||
        input.minutes_worked !== undefined ||
        input.is_verified !== undefined
      ) {
        throw new ForbiddenError('Workers may only set check_out_at and notes');
      }
      if (record.check_in_at === null) {
        throw new ConflictError('Must check in before checking out');
      }
      if (record.check_out_at !== null) {
        throw new ConflictError('Already checked out');
      }
    }

    const data: Prisma.AttendanceUpdateInput = {};

    if (input.check_out_at !== undefined) {
      const checkOutTime = new Date(input.check_out_at);
      data.check_out_at = checkOutTime;
      if (record.check_in_at) {
        data.minutes_worked = Math.max(
          0,
          Math.floor((checkOutTime.getTime() - record.check_in_at.getTime()) / 60000)
        );
      }
    }

    if (input.notes !== undefined) data.notes = input.notes;

    // Manager-only fields
    if (!isWorker) {
      if (input.status !== undefined) data.status = input.status as AttendanceStatus;
      if (input.minutes_late !== undefined) data.minutes_late = input.minutes_late;
      if (input.minutes_worked !== undefined) data.minutes_worked = input.minutes_worked;
      if (input.is_verified === true) {
        data.is_verified = true;
        data.verified_by = { connect: { id: actorId } };
        data.verified_at = new Date();
      }
    }

    const updated = await this.prisma.attendance.update({ where: { id }, data });

    await this.logAudit(actorId, actorRole, 'UPDATE_ATTENDANCE', 'ATTENDANCE', id, {
      worker_id: record.worker_id,
    });

    if (!isWorker) {
      if (input.is_verified === true) {
        void notificationService.sendNotification(record.worker_id, {
          type: 'ATTENDANCE_VERIFIED',
          title: 'Attendance Verified',
          message: 'Your attendance has been verified by a manager.',
          data: { attendance_id: id, assignment_id: record.assignment_id },
        }).catch(() => {});
      } else if (input.status === 'ABSENT') {
        void notificationService.sendNotification(record.worker_id, {
          type: 'WORKER_NO_SHOW',
          title: 'Attendance Rejected',
          message: 'Your attendance record has been marked as absent.',
          data: { attendance_id: id, assignment_id: record.assignment_id },
        }).catch(() => {});
      }
    }

    return this.toDto(updated);
  }
}

export const attendanceService = new AttendanceService();
