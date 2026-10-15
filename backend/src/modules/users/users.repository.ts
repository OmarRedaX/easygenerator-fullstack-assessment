import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { User } from './user.schema';
import { DuplicateEmailError } from './errors';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  passwordHash?: string;
}

type Row = { _id: unknown; email: string; name: string; createdAt: Date; passwordHash?: string };

const toRecord = (row: Row, withHash = false): UserRecord => ({
  id: String(row._id),
  email: row.email,
  name: row.name,
  createdAt: row.createdAt,
  ...(withHash && row.passwordHash !== undefined ? { passwordHash: row.passwordHash } : {}),
});

@Injectable()
export class UsersRepository implements OnModuleInit {
  constructor(@InjectModel(User.name) private readonly model: Model<User>) {}

  /** Ensures the unique email index exists before serving traffic (the real duplicate guard). */
  async onModuleInit(): Promise<void> {
    await this.model.init();
  }

  async create(input: { email: string; name: string; passwordHash: string }): Promise<UserRecord> {
    try {
      const doc = await this.model.create(input);
      return toRecord(doc.toObject() as unknown as Row);
    } catch (err) {
      if ((err as { code?: number }).code === 11000) throw new DuplicateEmailError();
      throw err;
    }
  }

  async findByEmailWithHash(email: string): Promise<UserRecord | null> {
    const row = await this.model.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash').lean<Row>();
    return row ? toRecord(row, true) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    if (!isValidObjectId(id)) return null;
    const row = await this.model.findById(id).lean<Row>();
    return row ? toRecord(row) : null;
  }
}
