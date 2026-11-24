import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import SmoothScrollWrapper from './components/SmoothScrollWrapper';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PreferencesProvider } from './context/PreferencesContext';
import { ThemeProvider } from './context/ThemeContext';
import Accounting from './pages/Accounting';
import Budgets from './pages/Budgets';
import Categories from './pages/Categories';
import Dashboard from './pages/Dashboard';
import Goals from './pages/Goals';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import Settings from './pages/Settings';
import Transactions from './pages/Transactions';
import UserManual from './pages/UserManual';
import Wallets from './pages/Wallets';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#09090B] flex items-center justify-center">
        <div className="text-sm font-medium text-slate-500 dark:text-zinc-400">
          Restoring workspace...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#09090B] flex items-center justify-center">
        <div className="text-sm font-medium text-slate-500 dark:text-zinc-400">
          Loading Multi-Wallet...
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <AuthProvider>
          <PreferencesProvider>
            <SmoothScrollWrapper>
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route
                    path="/login"
                    element={
                      <PublicOnlyRoute>
                        <Login />
                      </PublicOnlyRoute>
                    }
                  />
                  <Route
                    path="/register"
                    element={
                      <PublicOnlyRoute>
                        <Register />
                      </PublicOnlyRoute>
                    }
                  />
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/wallets"
                    element={
                      <ProtectedRoute>
                        <Wallets />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/accounts/chart"
                    element={
                      <ProtectedRoute>
                        <Accounting initialTab="chart" />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/accounts/ledger"
                    element={
                      <ProtectedRoute>
                        <Accounting initialTab="ledger" />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/accounts/balance-sheet"
                    element={
                      <ProtectedRoute>
                        <Accounting initialTab="balance-sheet" />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/accounts/profit-loss"
                    element={
                      <ProtectedRoute>
                        <Accounting initialTab="profit-loss" />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/accounts/trial-balance"
                    element={
                      <ProtectedRoute>
                        <Accounting initialTab="trial-balance" />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/transactions"
                    element={
                      <ProtectedRoute>
                        <Transactions />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/budgets"
                    element={
                      <ProtectedRoute>
                        <Budgets />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/goals"
                    element={
                      <ProtectedRoute>
                        <Goals />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/categories"
                    element={
                      <ProtectedRoute>
                        <Categories />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <ProtectedRoute>
                        <Settings />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/manual"
                    element={
                      <ProtectedRoute>
                        <UserManual />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </BrowserRouter>
            </SmoothScrollWrapper>
          </PreferencesProvider>
        </AuthProvider>
      </ThemeProvider>
    </MotionConfig>
  );
}
