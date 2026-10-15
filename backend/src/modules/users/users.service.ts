import { Injectable } from '@nestjs/common';
import { UserRecord, UsersRepository } from './users.repository';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

  create(input: { email: string; name: string; passwordHash: string }): Promise<UserRecord> {
    return this.repo.create(input);
  }
  findByEmailWithHash(email: string): Promise<UserRecord | null> {
    return this.repo.findByEmailWithHash(email);
  }
  findById(id: string): Promise<UserRecord | null> {
    return this.repo.findById(id);
  }
  toPublic(user: UserRecord): PublicUser {
    return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt.toISOString() };
  }
}
