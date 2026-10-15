import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { parse } from 'yaml';
import { createTestApp, TestApp } from './helpers/app';

const HTTP = ['get', 'post', 'put', 'patch', 'delete'];

function contractOperations(): string[] {
  const doc = parse(readFileSync(join(__dirname, '..', '..', 'contracts', 'openapi.yaml'), 'utf8')) as {
    paths: Record<string, Record<string, unknown>>;
  };
  return Object.entries(doc.paths)
    .flatMap(([path, item]) => Object.keys(item).filter((m) => HTTP.includes(m)).map((m) => `${m.toUpperCase()} /api${path}`))
    .sort();
}

function registeredRoutes(app: NestExpressApplication): string[] {
  const routes = new Set<string>();
  for (const mod of app.get(ModulesContainer).values()) {
    for (const wrapper of mod.controllers.values()) {
      const ctrl = wrapper.metatype as (new () => object) | null;
      if (!ctrl) continue;
      const base = Reflect.getMetadata(PATH_METADATA, ctrl) as string;
      for (const name of Object.getOwnPropertyNames(ctrl.prototype)) {
        const handler = (ctrl.prototype as Record<string, unknown>)[name] as object;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
        if (method === undefined) continue;
        const sub = Reflect.getMetadata(PATH_METADATA, handler) as string;
        const path = [base, sub].filter((p) => p && p !== '/').join('/');
        routes.add(`${RequestMethod[method]} /api/${path}`);
      }
    }
  }
  return [...routes].sort();
}

describe('API contract', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it('every contract operation is a registered route and vice versa (no drift)', () => {
    expect(registeredRoutes(t.app)).toEqual(contractOperations());
  });

  it('serves the contract through Swagger UI', async () => {
    const ui = await t.agent().get('/api/docs').expect(200);
    expect(ui.headers['content-type']).toMatch(/html/);
    const json = await t.agent().get('/api/docs-json').expect(200);
    expect(json.body.openapi).toBe('3.1.0');
    expect(Object.keys(json.body.paths)).toContain('/auth/signup');
  });
});
