import { BaseService } from '../../lib/base-service.js';

export class NotificationService extends BaseService {
  async sendNotification(userId: string, payload: Record<string, unknown>) {
    throw new Error('Not implemented');
  }

  async getNotifications(userId: string) {
    throw new Error('Not implemented');
  }

  async markAsRead(notificationId: string) {
    throw new Error('Not implemented');
  }

  async sendEmail(email: string, subject: string, body: string) {
    throw new Error('Not implemented');
  }

  async sendPushNotification(userId: string, title: string, body: string) {
    throw new Error('Not implemented');
  }
}

export const notificationService = new NotificationService();
