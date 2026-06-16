import {
  WorkerAssignmentStatus,
  WorkRequestStatus,
  AttendanceStatus,
  QualityVerificationStatus,
} from '@prisma/client';
import { BaseService } from '../../lib/base-service.js';
import { DashboardStats, HotelSummary, LeaderboardEntry } from './types.js';

export class AnalyticsService extends BaseService {
  async getLeaderboard(hotelId?: string): Promise<LeaderboardEntry[]> {
    const scope = hotelId ? { hotel_id: hotelId } : {};

    const [assignmentGroups, completedGroups, ratingGroups] = await Promise.all([
      this.prisma.workerAssignment.groupBy({
        by: ['worker_id'],
        where: scope,
        _count: { id: true },
      }),
      this.prisma.workerAssignment.groupBy({
        by: ['worker_id'],
        where: { ...scope, status: WorkerAssignmentStatus.COMPLETED },
        _count: { id: true },
      }),
      this.prisma.rating.groupBy({
        by: ['worker_id'],
        where: scope,
        _avg: { score: true },
      }),
    ]);

    const workerIds = assignmentGroups.map((g: { worker_id: string }) => g.worker_id);
    const workers = await this.prisma.user.findMany({
      where: { id: { in: workerIds } },
      select: { id: true, first_name: true, last_name: true },
    });

    const workerMap = new Map(
      workers.map((w: { id: string; first_name: string; last_name: string }) => [
        w.id,
        `${w.first_name} ${w.last_name}`,
      ])
    );
    const completedMap = new Map(
      completedGroups.map((g: { worker_id: string; _count: { id: number } }) => [
        g.worker_id,
        g._count.id,
      ])
    );
    const ratingMap = new Map(
      ratingGroups.map((g: { worker_id: string; _avg: { score: number | null } }) => [
        g.worker_id,
        g._avg.score ?? 0,
      ])
    );

    const entries = assignmentGroups
      .map((g: { worker_id: string; _count: { id: number } }) => {
        const total = g._count.id;
        const completed = completedMap.get(g.worker_id) ?? 0;
        const avgRating = ratingMap.get(g.worker_id) ?? 0;
        return {
          worker_id: g.worker_id,
          name: workerMap.get(g.worker_id) ?? 'Unknown',
          total_tasks: total,
          completed_tasks: completed,
          average_rating: Math.round((avgRating as number) * 100) / 100,
          score: total > 0 ? ((completed as number) / (total as number)) * (avgRating as number) : 0,
        };
      })
      .sort(
        (a: { score: number }, b: { score: number }) => b.score - a.score
      )
      .map(
        (
          { score: _score, ...entry }: { score: number; worker_id: string; name: string; total_tasks: number; completed_tasks: number; average_rating: number },
          idx: number
        ): LeaderboardEntry => ({ ...entry, position: idx + 1 })
      );

    return entries;
  }

  async getDashboardStats(hotelId?: string): Promise<DashboardStats> {
    const scope = hotelId ? { hotel_id: hotelId } : {};

    const [
      totalRequests,
      requestsByStatus,
      totalAssignments,
      assignmentsByStatus,
      totalAttendance,
      attendanceByStatus,
      qualityAgg,
      qualityPassed,
      totalQuality,
      ratingAgg,
      totalRatings,
    ] = await Promise.all([
      this.prisma.workRequest.count({ where: scope }),
      this.prisma.workRequest.groupBy({
        by: ['status'],
        where: scope,
        _count: { id: true },
      }),
      this.prisma.workerAssignment.count({ where: scope }),
      this.prisma.workerAssignment.groupBy({
        by: ['status'],
        where: scope,
        _count: { id: true },
      }),
      this.prisma.attendance.count({ where: scope }),
      this.prisma.attendance.groupBy({
        by: ['status'],
        where: scope,
        _count: { id: true },
      }),
      this.prisma.qualityVerification.aggregate({
        where: scope,
        _avg: { score: true },
      }),
      this.prisma.qualityVerification.count({
        where: { ...scope, status: QualityVerificationStatus.PASSED },
      }),
      this.prisma.qualityVerification.count({ where: scope }),
      this.prisma.rating.aggregate({
        where: scope,
        _avg: { score: true },
      }),
      this.prisma.rating.count({ where: scope }),
    ]);

    const reqMap = new Map(
      (requestsByStatus as Array<{ status: WorkRequestStatus; _count: { id: number } }>).map(
        (r) => [r.status, r._count.id]
      )
    );
    const asnMap = new Map(
      (
        assignmentsByStatus as Array<{
          status: WorkerAssignmentStatus;
          _count: { id: number };
        }>
      ).map((a) => [a.status, a._count.id])
    );
    const attMap = new Map(
      (
        attendanceByStatus as Array<{ status: AttendanceStatus; _count: { id: number } }>
      ).map((a) => [a.status, a._count.id])
    );

    const onTimeCount = attMap.get(AttendanceStatus.PRESENT) ?? 0;
    const qualityAvg = (qualityAgg as { _avg: { score: number | null } })._avg.score;
    const ratingAvg = (ratingAgg as { _avg: { score: number | null } })._avg.score;

    return {
      work_requests: {
        total: totalRequests as number,
        open: reqMap.get(WorkRequestStatus.OPEN) ?? 0,
        partially_filled: reqMap.get(WorkRequestStatus.PARTIALLY_FILLED) ?? 0,
        filled: reqMap.get(WorkRequestStatus.FILLED) ?? 0,
        cancelled: reqMap.get(WorkRequestStatus.CANCELLED) ?? 0,
        expired: reqMap.get(WorkRequestStatus.EXPIRED) ?? 0,
      },
      assignments: {
        total: totalAssignments as number,
        completed: asnMap.get(WorkerAssignmentStatus.COMPLETED) ?? 0,
        in_progress: asnMap.get(WorkerAssignmentStatus.IN_PROGRESS) ?? 0,
        no_show: asnMap.get(WorkerAssignmentStatus.NO_SHOW) ?? 0,
        cancelled: asnMap.get(WorkerAssignmentStatus.CANCELLED) ?? 0,
      },
      attendance: {
        total: totalAttendance as number,
        present:
          (attMap.get(AttendanceStatus.PRESENT) ?? 0) +
          (attMap.get(AttendanceStatus.LATE) ?? 0),
        late: attMap.get(AttendanceStatus.LATE) ?? 0,
        absent: attMap.get(AttendanceStatus.ABSENT) ?? 0,
        on_time_rate:
          (totalAttendance as number) > 0
            ? Math.round((onTimeCount / (totalAttendance as number)) * 10000) / 100
            : 0,
      },
      quality: {
        total_verifications: totalQuality as number,
        average_score: qualityAvg !== null ? Math.round((qualityAvg ?? 0) * 100) / 100 : null,
        pass_rate:
          (totalQuality as number) > 0
            ? Math.round(((qualityPassed as number) / (totalQuality as number)) * 10000) / 100
            : 0,
      },
      ratings: {
        total: totalRatings as number,
        average_score: ratingAvg !== null ? Math.round((ratingAvg ?? 0) * 100) / 100 : null,
      },
    };
  }

  async getHotelSummary(hotelId: string): Promise<HotelSummary> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      openRequestsAgg,
      activeAssignments,
      todayAttendanceGroups,
      qualityAgg,
      qualityPassed,
      totalQuality,
      topWorkers,
    ] = await Promise.all([
      this.prisma.workRequest.aggregate({
        where: {
          hotel_id: hotelId,
          status: { in: [WorkRequestStatus.OPEN, WorkRequestStatus.PARTIALLY_FILLED] },
        },
        _count: { id: true },
        _sum: { workers_needed: true, workers_confirmed: true },
      }),
      this.prisma.workerAssignment.count({
        where: { hotel_id: hotelId, status: WorkerAssignmentStatus.IN_PROGRESS },
      }),
      this.prisma.attendance.groupBy({
        by: ['status'],
        where: {
          hotel_id: hotelId,
          created_at: { gte: today, lt: tomorrow },
        },
        _count: { id: true },
      }),
      this.prisma.qualityVerification.aggregate({
        where: { hotel_id: hotelId },
        _avg: { score: true },
      }),
      this.prisma.qualityVerification.count({
        where: { hotel_id: hotelId, status: QualityVerificationStatus.PASSED },
      }),
      this.prisma.qualityVerification.count({ where: { hotel_id: hotelId } }),
      this.getLeaderboard(hotelId),
    ]);

    const attMap = new Map(
      (
        todayAttendanceGroups as Array<{ status: AttendanceStatus; _count: { id: number } }>
      ).map((a) => [a.status, a._count.id])
    );

    const aggResult = openRequestsAgg as {
      _count: { id: number };
      _sum: { workers_needed: number | null; workers_confirmed: number | null };
    };
    const qualAvg = (qualityAgg as { _avg: { score: number | null } })._avg.score;

    return {
      hotel_id: hotelId,
      open_requests: {
        count: aggResult._count.id,
        workers_needed: aggResult._sum.workers_needed ?? 0,
        workers_confirmed: aggResult._sum.workers_confirmed ?? 0,
      },
      active_assignments: activeAssignments as number,
      today_attendance: {
        expected: attMap.get(AttendanceStatus.EXPECTED) ?? 0,
        present:
          (attMap.get(AttendanceStatus.PRESENT) ?? 0) +
          (attMap.get(AttendanceStatus.LATE) ?? 0),
        late: attMap.get(AttendanceStatus.LATE) ?? 0,
        absent: attMap.get(AttendanceStatus.ABSENT) ?? 0,
      },
      quality: {
        average_score: qualAvg !== null ? Math.round((qualAvg ?? 0) * 100) / 100 : null,
        recent_pass_rate:
          (totalQuality as number) > 0
            ? Math.round(((qualityPassed as number) / (totalQuality as number)) * 10000) / 100
            : 0,
      },
      top_workers: topWorkers.slice(0, 5),
    };
  }
}

export const analyticsService = new AnalyticsService();
