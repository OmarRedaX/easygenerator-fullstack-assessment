import { config } from 'dotenv';
import { join } from 'node:path';

// Does not override variables already set (CI provides MONGODB_URI).
config({ path: join(__dirname, '..', '.env.test'), quiet: true });
