import type { EmailService, EmailOptions } from '../../application/ports/services.js';
import { logger } from '../../shared/logger.js';

export class EmailSender implements EmailService {
  async send(options: EmailOptions): Promise<void> {
    logger.info('Dispatched transactional email', {
      to: options.to,
      template: options.template,
    });
  }
}
