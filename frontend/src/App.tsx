import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { GuestOnly } from './features/auth/GuestOnly';
import { RequireAuth } from './features/auth/RequireAuth';
import { SESSION_KEY, useRevalidateOnRestore } from './features/auth/session';
import { SignInPage } from './features/auth/SignInPage';
import { SignUpPage } from './features/auth/SignUpPage';
import { WelcomePage } from './features/home/WelcomePage';
import { setUnauthorizedHandler } from './lib/api/client';

/** A 401 from any protected request means the session is gone: the guards then redirect to /signin. */
export function createAppQueryClient(): QueryClient {
  const client = new QueryClient();
  setUnauthorizedHandler(() => {
    client.setQueryData(SESSION_KEY, null);
  });
  return client;
}

export function AppRoutes() {
  useRevalidateOnRestore();
  return (
    <Routes>
      <Route element={<RequireAuth />}>
        <Route path="/" element={<WelcomePage />} />
      </Route>
      <Route element={<GuestOnly />}>
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  const [client] = useState(createAppQueryClient);
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
