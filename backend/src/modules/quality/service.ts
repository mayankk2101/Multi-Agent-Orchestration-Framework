import { AssignmentStatus, AttendanceStatus, HotelWorkerStatus, Prisma } from '@prisma/client';
import { BaseService } from '../../lib/base-service.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../lib/errors.js';
import type { CreateRatingRequest } from './types.js';

interface Actor {
  userId: string;
  role: string;
}

export class QualityService extends BaseService {
  async createVerification(
    data: Record<string, unknown>,
    actor: Actor
  ) {
    const { assignment_id, score, notes, status } = data as {
      assignment_id: string;
      score: number;
      notes?: string;
      status?: string;
    };

    if (!assignment_id) throw new ValidationError('assignment_id is required');
    if (!Number.isInteger(Number(score)) || Number(score) < 0 || Number(score) > 100) {
      throw new ValidationError('score must be an integer between 0 and 100');
    }

    const assignment = await this.prisma.workerAssignment.findUnique({
      where: { id: assignment_id },
    });
    if (!assignment) throw new NotFoundError('Assignment not found');

    const existing = await this.prisma.qualityVerification.findUnique({
      where: { assignment_id },
    });
    if (existing) throw new ConflictError('Verification already exists for this assignment');

    const numScore = Number(score);
    const derivedStatus =
      status ?? (numScore >= 70 ? 'PASSED' : numScore >= 40 ? 'NEEDS_REWORK' : 'FAILED');

    const verification = await this.prisma.qualityVerification.create({
      data: {
        assignment_id,
        hotel_id: assignment.hotel_id,
        verified_by_id: actor.userId,
        score: numScore,
        status: derivedStatus as any,
        notes: notes ?? null,
      },
    });

    await this.logAudit(
      actor.userId,
      actor.role,
      'CREATE_VERIFICATION',
      'QUALITY_VERIFICATION',
      verification.id,
      { assignment_id }
    );

    return verification;
  }

  async createRating(data: CreateRatingRequest, actor: Actor) {
    const { assignment_id, worker_id, score, comment, criteria_scores } = data;

    if (!assignment_id || !worker_id) {
      throw new ValidationError('assignment_id and worker_id are required');
    }
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      throw new ValidationError('score must be an integer between 1 and 5');
    }

    const rating = await this.prisma.$transaction(async (tx) => {
      const assignment = await tx.workerAssignment.findUnique({
        where: { id: assignment_id },
        select: { id: true, hotel_id: true, worker_id: true },
      });
      if (!assignment) {
        throw new NotFoundError('Assignment not found');
      }
      if (assignment.worker_id !== worker_id) {
        throw new ForbiddenError('worker_id does not match the assignment worker');
      }

      const created = await tx.rating.create({
        data: {
          assignment_id,
          hotel_id: assignment.hotel_id,
          worker_id,
          rated_by_id: actor.userId,
          score,
          comment: comment ?? null,
          criteria_scores: criteria_scores
            ? (criteria_scores as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      });

      const [agg, totalAssignments, completedAssignments, onTimeAttendance, lastWorked] =
        await Promise.all([
          tx.rating.aggregate({
            where: { worker_id },
            _avg: { score: true },
            _count: true,
          }),
          tx.workerAssignment.count({ where: { worker_id } }),
          tx.workerAssignment.count({
            where: { worker_id, status: AssignmentStatus.COMPLETED },
          }),
          tx.attendance.count({
            where: { worker_id, status: AttendanceStatus.PRESENT },
          }),
          tx.workerAssignment.findFirst({
            where: {
              worker_id,
              status: AssignmentStatus.COMPLETED,
              completed_at: { not: null },
            },
            orderBy: { completed_at: 'desc' },
            select: { completed_at: true },
          }),
        ]);

      const averageScore = agg._avg.score ?? 0;
      const completionRate = totalAssignments > 0 ? completedAssignments / totalAssignments : 0;
      const onTimeRate = totalAssignments > 0 ? onTimeAttendance / totalAssignments : 0;

      const aggregateData = {
        average_score: averageScore,
        total_ratings: agg._count,
        total_assignments: totalAssignments,
        completion_rate: completionRate,
        on_time_rate: onTimeRate,
        last_worked_at: lastWorked?.completed_at ?? null,
      };

      await tx.workerOverallRating.upsert({
        where: { worker_id },
        create: { worker_id, ...aggregateData },
        update: aggregateData,
      });

      return created;
    });

    await this.logAudit(actor.userId, actor.role, 'CREATE_RATING', 'Rating', rating.id, {
      assignment_id,
      worker_id,
      score,
    });

    return rating;
  }

  async getLeaderboard(hotelId: string) {
    const where = hotelId
      ? {
          worker: {
            hotel_workers: {
              some: { hotel_id: hotelId, status: HotelWorkerStatus.ACTIVE },
            },
          },
        }
      : {};

    return this.prisma.workerOverallRating.findMany({
      where,
      include: {
        worker: {
          select: { id: true, first_name: true, last_name: true, email: true },
        },
      },
      orderBy: { average_score: 'desc' },
      take: 50,
    });
  }
}

export const qualityService = new QualityService();
