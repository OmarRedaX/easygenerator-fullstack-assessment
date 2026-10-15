import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { DuplicateEmailError } from '../users/errors';
import type { PasswordHasher } from './password-hasher';
import type { UsersService } from '../users/users.service';

const user = { id: 'u1', email: 'a@x.com', name: 'Alice', createdAt: new Date(0), passwordHash: 'stored-hash' };

function setup() {
  const users = { create: jest.fn(), findByEmailWithHash: jest.fn() };
  const hasher = { hash: jest.fn(), verify: jest.fn(), verifyDummy: jest.fn() };
  const service = new AuthService(users as unknown as UsersService, hasher as unknown as PasswordHasher);
  return { users, hasher, service };
}

describe('AuthService', () => {
  describe('signUp', () => {
    it('stores only the hash, never the plaintext password', async () => {
      const { users, hasher, service } = setup();
      hasher.hash.mockResolvedValue('HASHED');
      users.create.mockResolvedValue({ ...user, passwordHash: undefined });
      await service.signUp({ email: 'a@x.com', name: 'Alice', password: 'abcdef1!' });
      expect(users.create).toHaveBeenCalledWith({ email: 'a@x.com', name: 'Alice', passwordHash: 'HASHED' });
      expect(JSON.stringify(users.create.mock.calls)).not.toContain('abcdef1!');
    });
    it('propagates DuplicateEmailError', async () => {
      const { users, hasher, service } = setup();
      hasher.hash.mockResolvedValue('H');
      users.create.mockRejectedValue(new DuplicateEmailError());
      await expect(service.signUp({ email: 'a@x.com', name: 'Alice', password: 'abcdef1!' })).rejects.toBeInstanceOf(DuplicateEmailError);
    });
  });

  describe('signIn', () => {
    it('returns the user on a correct password', async () => {
      const { users, hasher, service } = setup();
      users.findByEmailWithHash.mockResolvedValue(user);
      hasher.verify.mockResolvedValue(true);
      await expect(service.signIn('a@x.com', 'pw')).resolves.toBe(user);
      expect(hasher.verify).toHaveBeenCalledWith('stored-hash', 'pw');
    });
    it('wrong password: generic 401', async () => {
      const { users, hasher, service } = setup();
      users.findByEmailWithHash.mockResolvedValue(user);
      hasher.verify.mockResolvedValue(false);
      await expect(service.signIn('a@x.com', 'bad')).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });
    it('unknown email: same generic 401 and a dummy verification is burned', async () => {
      const { users, hasher, service } = setup();
      users.findByEmailWithHash.mockResolvedValue(null);
      await expect(service.signIn('nobody@x.com', 'pw')).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
      expect(hasher.verifyDummy).toHaveBeenCalledWith('pw');
      expect(hasher.verify).not.toHaveBeenCalled();
    });
  });
});
