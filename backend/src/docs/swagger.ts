import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { parse } from 'yaml';

// Layout is identical in dev (backend/src/docs), build (backend/dist/docs) and Docker (/app/backend/dist/docs):
// three levels up is the repo root that holds contracts/.
const CONTRACT_PATH = join(__dirname, '..', '..', '..', 'contracts', 'openapi.yaml');

export function setupSwagger(app: INestApplication): void {
  const document = parse(readFileSync(CONTRACT_PATH, 'utf8')) as OpenAPIObject;
  SwaggerModule.setup('api/docs', app, document, { jsonDocumentUrl: 'api/docs-json' });
}
