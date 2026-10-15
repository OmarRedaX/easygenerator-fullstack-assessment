import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRecord } from '../users/users.repository';
import { UsersService } from '../users/users.service';
import { PasswordHasher } from './password-hasher';
import { SignUpDto } from './dto/sign-up.dto';

const INVALID_CREDENTIALS = 'Invalid email or password';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly hasher: PasswordHasher,
  ) {}

  async signUp(dto: SignUpDto): Promise<UserRecord> {
    const passwordHash = await this.hasher.hash(dto.password);
    return this.users.create({ email: dto.email, name: dto.name, passwordHash });
  }

  async signIn(email: string, password: string): Promise<UserRecord> {
    const user = await this.users.findByEmailWithHash(email);
    if (!user?.passwordHash) {
      await this.hasher.verifyDummy(password);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (!(await this.hasher.verify(user.passwordHash, password))) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    return user;
  }
}
