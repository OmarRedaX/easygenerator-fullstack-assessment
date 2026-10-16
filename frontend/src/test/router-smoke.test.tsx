import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  BrowserRouter,
  Link,
  MemoryRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router';

// Guards the react-router API surface the app relies on (declarative mode, single `react-router` package).
function Probe() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { from?: string } | null;
  return (
    <div>
      <p data-testid="path">{location.pathname}</p>
      <p data-testid="from">{state?.from ?? 'none'}</p>
      <button type="button" onClick={() => void navigate('/b', { replace: true })}>
        go
      </button>
      <Link to="/c">link</Link>
    </div>
  );
}

describe('react-router API surface', () => {
  it('exports the components and hooks the app uses', () => {
    expect(typeof BrowserRouter).toBe('function');
    expect(typeof Outlet).toBe('function');
  });

  it('supports <Navigate replace state> and reading location.state', () => {
    render(
      <MemoryRouter initialEntries={['/start']}>
        <Routes>
          <Route path="/start" element={<Navigate to="/signin" replace state={{ from: '/x' }} />} />
          <Route path="/signin" element={<Probe />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('path')).toHaveTextContent('/signin');
    expect(screen.getByTestId('from')).toHaveTextContent('/x');
  });
});
