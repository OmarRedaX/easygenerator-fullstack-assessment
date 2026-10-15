import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

/**
 * Infrastructure exception: the only non-repository code allowed to use Mongoose, and only through the
 * Connection for a liveness ping (no models, no data access). Anything more than a ping belongs in a repository.
 */
@Injectable()
export class HealthService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async isDatabaseUp(): Promise<boolean> {
    try {
      const db = this.connection.db;
      if (!db) return false;
      await db.command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  }
}
