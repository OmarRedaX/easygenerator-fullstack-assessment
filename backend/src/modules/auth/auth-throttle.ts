import { SetMetadata } from '@nestjs/common';

export const AUTH_THROTTLED = 'authThrottled';
/** Marks a handler as subject to the strict `auth` throttler (signin/signup). */
export const AuthThrottled = (): MethodDecorator => SetMetadata(AUTH_THROTTLED, true);
