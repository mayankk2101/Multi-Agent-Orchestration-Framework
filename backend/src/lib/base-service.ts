import { getPrisma } from './db.js';

export class BaseService {
  protected prisma = getPrisma();

  async logAudit(
    actor_id: string | null,
    actor_role: string | null,
    action: string,
    resource_type: string,
    resource_id: string,
    details?: Record<string, unknown>,
    ip_address?: string
  ) {
    await this.prisma.auditLog.create({
      data: {
        actor_id,
        actor_role,
        action,
        resource_type,
        resource_id,
        details: details || null,
        ip_address: ip_address || null,
        timestamp: new Date(),
      },
    });
  }
}
