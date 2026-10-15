import { createTestApp } from './helpers/app';

describe('createTestApp', () => {
  it.each(['MONGODB_URI', 'TEST_MONGODB_URI'])('refuses to let callers override %s', async (key) => {
    await expect(createTestApp({ [key]: 'mongodb://127.0.0.1:27017/easygenerator' })).rejects.toThrow(new RegExp(key));
  });

  it('cleans up and rethrows when initialisation fails, leaving later apps unaffected', async () => {
    await expect(createTestApp({ SESSION_SECRET: 'short' })).rejects.toThrow(/SESSION_SECRET/);
    const t = await createTestApp();
    await t.close();
  });
});
