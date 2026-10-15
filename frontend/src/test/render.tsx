import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
}

interface Options {
  /** Initial history entries; a string is one path, an object lets a test seed `state`. */
  route?: string | { pathname: string; state?: unknown };
  client?: QueryClient;
}

export function renderWithProviders(
  ui: ReactElement,
  { route = '/', client = createTestQueryClient() }: Options = {},
): RenderResult & { client: QueryClient } {
  const result = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...result, client };
}
