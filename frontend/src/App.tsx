import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { GuestOnly } from './features/auth/GuestOnly';
import { RequireAuth } from './features/auth/RequireAuth';
import { useClearSessionOnUnauthorized, useRevalidateOnRestore } from './features/auth/session';
import { SignInPage } from './features/auth/SignInPage';
import { SignUpPage } from './features/auth/SignUpPage';
import { WelcomePage } from './features/home/WelcomePage';

export function createAppQueryClient(): QueryClient {
  return new QueryClient();
}

export function AppRoutes() {
  useRevalidateOnRestore();
  useClearSessionOnUnauthorized();
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
