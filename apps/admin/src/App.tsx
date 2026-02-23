import { Toaster } from "@kahade/ui"
import { TooltipProvider } from "@kahade/ui"
import { Route, Switch } from "wouter"
import { ErrorBoundary } from "@kahade/ui"
import { ThemeProvider } from "./contexts/ThemeContext"
import { AuthProvider } from "./contexts/AuthContext"
import { ProtectedRoute } from "./components/auth/ProtectedRoute"
import { lazy, Suspense } from "react"
import { Spinner } from "@phosphor-icons/react"

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Spinner className="w-8 h-8 animate-spin text-primary mx-auto" weight="bold" aria-hidden="true" />
    </div>
  )
}

// Auth
const Login = lazy(() => import("./pages/auth/Login"))
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"))
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"))

// Admin Pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"))
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"))
const AdminTransactions = lazy(() => import("./pages/admin/AdminTransactions"))
const AdminDisputes = lazy(() => import("./pages/admin/AdminDisputes"))
const AdminKYC = lazy(() => import("./pages/admin/AdminKYC"))
const AdminWithdrawals = lazy(() => import("./pages/admin/AdminWithdrawals"))
const AdminDeposits = lazy(() => import("./pages/admin/AdminDeposits"))
const AdminPromos = lazy(() => import("./pages/admin/AdminPromos"))
const AdminReports = lazy(() => import("./pages/admin/AdminReports"))
const AdminAuditLogs = lazy(() => import("./pages/admin/AdminAuditLogs"))
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"))
const NotFound = lazy(() => import("./pages/NotFound"))
const Unauthorized = lazy(() => import("./pages/Unauthorized"))

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <TooltipProvider>
            <Toaster position="top-right" toastOptions={{ className: "glass-card" }} />
            <Suspense fallback={<PageLoader />}>
              <Switch>
                <Route path="/login" component={Login} />
                <Route path="/forgot-password" component={ForgotPassword} />
                <Route path="/reset-password" component={ResetPassword} />
                <Route path="/"><ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute></Route>
                <Route path="/users"><ProtectedRoute requireAdmin><AdminUsers /></ProtectedRoute></Route>
                <Route path="/transactions"><ProtectedRoute requireAdmin><AdminTransactions /></ProtectedRoute></Route>
                <Route path="/disputes"><ProtectedRoute requireAdmin><AdminDisputes /></ProtectedRoute></Route>
                <Route path="/kyc"><ProtectedRoute requireAdmin><AdminKYC /></ProtectedRoute></Route>
                <Route path="/withdrawals"><ProtectedRoute requireAdmin><AdminWithdrawals /></ProtectedRoute></Route>
                <Route path="/deposits"><ProtectedRoute requireAdmin><AdminDeposits /></ProtectedRoute></Route>
                <Route path="/promos"><ProtectedRoute requireAdmin><AdminPromos /></ProtectedRoute></Route>
                <Route path="/reports"><ProtectedRoute requireAdmin><AdminReports /></ProtectedRoute></Route>
                <Route path="/audit-logs"><ProtectedRoute requireAdmin><AdminAuditLogs /></ProtectedRoute></Route>
                <Route path="/settings"><ProtectedRoute requireAdmin><AdminSettings /></ProtectedRoute></Route>
                <Route path="/unauthorized" component={Unauthorized} />
                <Route component={NotFound} />
              </Switch>
            </Suspense>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
