import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import type { Env } from '../../config/env.schema';

@Injectable()
export class PasswordHasher {
  private readonly options: argon2.HashOptions;
  private dummyHash?: Promise<string>;

  constructor(config: ConfigService<Env, true>) {
    this.options = {
      type: argon2.argon2id,
      memoryCost: config.get('ARGON2_MEMORY_KIB', { infer: true }),
      timeCost: config.get('ARGON2_TIME_COST', { infer: true }),
      parallelism: config.get('ARGON2_PARALLELISM', { infer: true }),
    };
  }

  hash(password: string): Promise<string> {
    return argon2.hash(password, this.options);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  /** Burns a verification so unknown-email signins cost about the same as wrong-password ones (narrows, does not equalise, timing). */
  async verifyDummy(password: string): Promise<void> {
    this.dummyHash ??= argon2.hash('dummy-password-for-timing', this.options);
    await this.verify(await this.dummyHash, password);
  }
}
