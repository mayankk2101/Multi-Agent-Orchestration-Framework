import { AssignmentStatus, AttendanceStatus, Prisma } from '@prisma/client';
import { BaseService } from '../../lib/base-service.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../lib/errors.js';
import type { CreateRatingRequest } from './types.js';

interface Actor {
  userId: string;
  role: string;
}

export class QualityService extends BaseService {
  async createVerification(_data: Record<string, unknown>) {
    throw new Error('Not implemented');
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
      // REM-03: the rated worker must be the worker on the assignment.
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

      // REM-05: recompute the materialised aggregate from live DB counts.
      // REM-06: use typed Prisma enums (AssignmentStatus / AttendanceStatus) — no `as any`.
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
      const lastWorkedAt = lastWorked?.completed_at ?? null;

      const aggregateData = {
        average_score: averageScore,
        total_ratings: agg._count,
        total_assignments: totalAssignments,
        completion_rate: completionRate,
        on_time_rate: onTimeRate,
        last_worked_at: lastWorkedAt,
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

  async getLeaderboard(_hotelId: string) {
    throw new Error('Not implemented');
  }
}

export const qualityService = new QualityService();
