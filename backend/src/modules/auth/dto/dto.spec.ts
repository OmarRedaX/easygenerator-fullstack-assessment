import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SignInDto } from './sign-in.dto';
import { SignUpDto } from './sign-up.dto';

const fields = async <T extends object>(cls: new () => T, input: object) =>
  (await validate(plainToInstance(cls, input))).map((e) => e.property).sort();

const good = { email: 'a@x.com', name: 'Alice', password: 'abcdef1!' };

describe('SignUpDto', () => {
  it('accepts valid input', async () => expect(await fields(SignUpDto, good)).toEqual([]));

  it('normalises email (trim + lowercase) and trims name', () => {
    const dto = plainToInstance(SignUpDto, { ...good, email: '  A@X.Com ', name: '  Alice  ' });
    expect(dto.email).toBe('a@x.com');
    expect(dto.name).toBe('Alice');
  });

  it.each([['not-an-email'], [''], ['a@'], [`${'a'.repeat(250)}@x.com`]])('rejects email %j', async (email) => {
    expect(await fields(SignUpDto, { ...good, email })).toEqual(['email']);
  });

  it.each([['ab'], ['  ab  '], ['   '], [''], ['x'.repeat(81)]])('rejects name %j', async (name) => {
    expect(await fields(SignUpDto, { ...good, name })).toEqual(['name']);
  });

  it('accepts the minimum 3-character name', async () => {
    expect(await fields(SignUpDto, { ...good, name: 'Bob' })).toEqual([]);
  });

  it.each([
    ['too short', 'abc12!'],
    ['no letter', '12345678!'],
    ['no digit', 'abcdefgh!'],
    ['no special', 'abcdefg12'],
    ['space only as special', 'abc def 12'],
    ['129 chars', 'a1!' + 'x'.repeat(126)],
  ])('rejects password: %s', async (_l, password) => {
    expect(await fields(SignUpDto, { ...good, password })).toEqual(['password']);
  });

  it('rejects non-string fields', async () => {
    expect(await fields(SignUpDto, { email: 1, name: 2, password: 3 })).toEqual(['email', 'name', 'password']);
  });
});

describe('SignInDto', () => {
  it('only checks presence and type of the password (policy not re-applied)', async () => {
    expect(await fields(SignInDto, { email: 'a@x.com', password: 'weak' })).toEqual([]);
    expect(await fields(SignInDto, { email: 'a@x.com', password: '' })).toEqual(['password']);
    expect(await fields(SignInDto, { email: 'bad', password: 'x' })).toEqual(['email']);
  });
});
