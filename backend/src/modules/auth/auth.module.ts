import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordHasher } from './password-hasher';
import { SessionGuard } from './session.guard';
import { SessionStoreService } from './session-store';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordHasher, SessionGuard, SessionStoreService],
  exports: [SessionStoreService],
})
export class AuthModule {}
