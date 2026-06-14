import { BaseService } from '../../lib/base-service.js';
import { NotFoundError } from '../../lib/errors.js';

export class NotificationService extends BaseService {
  async sendNotification(_userId: string, _payload: Record<string, unknown>) {
    throw new Error('Not implemented');
  }

  async getNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
  }

  async markAsRead(notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) throw new NotFoundError('Notification not found');

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { is_read: true, read_at: new Date() },
    });
  }

  async sendEmail(_email: string, _subject: string, _body: string) {
    throw new Error('Not implemented');
  }

  async sendPushNotification(_userId: string, _title: string, _body: string) {
    throw new Error('Not implemented');
  }
}

export const notificationService = new NotificationService();
