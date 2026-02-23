import { Toaster } from "@kahade/ui"
import { TooltipProvider } from "@kahade/ui"
import { Route, Switch } from "wouter"
import ErrorBoundary from "@kahade/ui/ErrorBoundary"
import { ThemeProvider } from "./contexts/ThemeContext"
import { AuthProvider } from "./contexts/AuthContext"
import { ProtectedRoute } from "./components/auth/ProtectedRoute"
import { lazy, Suspense } from "react"
import { Spinner } from "@phosphor-icons/react"

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Spinner className="w-8 h-8 animate-spin text-primary mx-auto" weight="bold" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Memuat halaman...</p>
      </div>
    </div>
  )
}

// Auth Pages
const Login = lazy(() => import("./pages/auth/Login"))
const Register = lazy(() => import("./pages/auth/Register"))
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"))
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"))
const OAuthCallback = lazy(() => import("./pages/auth/OAuthCallback"))

// Dashboard Pages
const Dashboard = lazy(() => import("./pages/dashboard/Dashboard"))
const Transactions = lazy(() => import("./pages/dashboard/Transactions"))
const TransactionDetail = lazy(() => import("./pages/dashboard/TransactionDetail"))
const CreateTransaction = lazy(() => import("./pages/dashboard/CreateTransaction"))
const AcceptTransactionInvite = lazy(() => import("./pages/dashboard/AcceptTransactionInvite"))
const Wallet = lazy(() => import("./pages/dashboard/Wallet"))
const Deposit = lazy(() => import("./pages/dashboard/Deposit"))
const BankAccounts = lazy(() => import("./pages/dashboard/BankAccounts"))
const KYCVerification = lazy(() => import("./pages/dashboard/KYCVerification"))
const Disputes = lazy(() => import("./pages/dashboard/Disputes"))
const DisputeDetail = lazy(() => import("./pages/dashboard/DisputeDetail"))
const ActivityLog = lazy(() => import("./pages/dashboard/ActivityLog"))
const Notifications = lazy(() => import("./pages/dashboard/Notifications"))
const Profile = lazy(() => import("./pages/dashboard/Profile"))
const EditProfile = lazy(() => import("./pages/dashboard/EditProfile"))
const Settings = lazy(() => import("./pages/dashboard/Settings"))
const MFASettings = lazy(() => import("./pages/dashboard/MFASettings"))
const Referrals = lazy(() => import("./pages/dashboard/Referrals"))
const RewardPoints = lazy(() => import("./pages/dashboard/RewardPoints"))
const RewardRank = lazy(() => import("./pages/dashboard/RewardRank"))
const RewardMissions = lazy(() => import("./pages/dashboard/RewardMissions"))
const Messages = lazy(() => import("./pages/dashboard/messaging/Messages"))
const SupportTickets = lazy(() => import("./pages/dashboard/support/SupportTickets"))
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
                {/* Auth */}
                <Route path="/login" component={Login} />
                <Route path="/register" component={Register} />
                <Route path="/forgot-password" component={ForgotPassword} />
                <Route path="/reset-password" component={ResetPassword} />
                <Route path="/oauth/callback" component={OAuthCallback} />
                {/* Protected */}
                <Route path="/"><ProtectedRoute><Dashboard /></ProtectedRoute></Route>
                <Route path="/transactions"><ProtectedRoute><Transactions /></ProtectedRoute></Route>
                <Route path="/transactions/create"><ProtectedRoute><CreateTransaction /></ProtectedRoute></Route>
                <Route path="/transactions/:id"><ProtectedRoute><TransactionDetail /></ProtectedRoute></Route>
                <Route path="/transactions/invite/:token"><ProtectedRoute><AcceptTransactionInvite /></ProtectedRoute></Route>
                <Route path="/wallet"><ProtectedRoute><Wallet /></ProtectedRoute></Route>
                <Route path="/wallet/deposit"><ProtectedRoute><Deposit /></ProtectedRoute></Route>
                <Route path="/bank-accounts"><ProtectedRoute><BankAccounts /></ProtectedRoute></Route>
                <Route path="/kyc"><ProtectedRoute><KYCVerification /></ProtectedRoute></Route>
                <Route path="/referrals"><ProtectedRoute><Referrals /></ProtectedRoute></Route>
                <Route path="/disputes"><ProtectedRoute><Disputes /></ProtectedRoute></Route>
                <Route path="/disputes/:id"><ProtectedRoute><DisputeDetail /></ProtectedRoute></Route>
                <Route path="/activity"><ProtectedRoute><ActivityLog /></ProtectedRoute></Route>
                <Route path="/notifications"><ProtectedRoute><Notifications /></ProtectedRoute></Route>
                <Route path="/profile"><ProtectedRoute><Profile /></ProtectedRoute></Route>
                <Route path="/profile/edit"><ProtectedRoute><EditProfile /></ProtectedRoute></Route>
                <Route path="/rewards/points"><ProtectedRoute><RewardPoints /></ProtectedRoute></Route>
                <Route path="/rewards/rank"><ProtectedRoute><RewardRank /></ProtectedRoute></Route>
                <Route path="/rewards/missions"><ProtectedRoute><RewardMissions /></ProtectedRoute></Route>
                <Route path="/settings"><ProtectedRoute><Settings /></ProtectedRoute></Route>
                <Route path="/security"><ProtectedRoute><MFASettings /></ProtectedRoute></Route>
                <Route path="/messages"><ProtectedRoute><Messages /></ProtectedRoute></Route>
                <Route path="/support"><ProtectedRoute><SupportTickets /></ProtectedRoute></Route>
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
