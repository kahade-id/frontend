import { Toaster } from "@kahade/ui"
import { TooltipProvider } from "@kahade/ui"
import { Route, Switch } from "wouter"
import { ErrorBoundary } from "@kahade/ui"
import { ThemeProvider } from "./contexts/ThemeContext"
import { AuthProvider } from "./contexts/AuthContext"
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

// Landing Pages
const Home = lazy(() => import("./pages/Home"))
const About = lazy(() => import("./pages/About"))
const HowItWorks = lazy(() => import("./pages/HowItWorks"))
const Contact = lazy(() => import("./pages/Contact"))
const Pricing = lazy(() => import("./pages/Pricing"))
const Security = lazy(() => import("./pages/Security"))
const UseCases = lazy(() => import("./pages/UseCases"))
const Partners = lazy(() => import("./pages/Partners"))
const Compare = lazy(() => import("./pages/Compare"))
const MobileApp = lazy(() => import("./pages/MobileApp"))
const Blog = lazy(() => import("./pages/Blog"))
const BlogDetail = lazy(() => import("./pages/BlogDetail"))
const Help = lazy(() => import("./pages/Help"))
const FAQ = lazy(() => import("./pages/FAQ"))
const Feedback = lazy(() => import("./pages/Feedback"))
const Careers = lazy(() => import("./pages/Careers"))
const Whitepaper = lazy(() => import("./pages/Whitepaper"))
const Docs = lazy(() => import("./pages/Docs"))
const ApiDocs = lazy(() => import("./pages/ApiDocs"))
const IntegrationDocs = lazy(() => import("./pages/IntegrationDocs"))
const Press = lazy(() => import("./pages/Press"))
const Terms = lazy(() => import("./pages/Terms"))
const Privacy = lazy(() => import("./pages/Privacy"))
const Cookies = lazy(() => import("./pages/Cookies"))
const Licenses = lazy(() => import("./pages/Licenses"))
const NotFound = lazy(() => import("./pages/NotFound"))

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <TooltipProvider>
            <Toaster position="top-right" toastOptions={{ className: "glass-card" }} />
            <Suspense fallback={<PageLoader />}>
              <Switch>
                <Route path="/" component={Home} />
                <Route path="/about" component={About} />
                <Route path="/how-it-works" component={HowItWorks} />
                <Route path="/contact" component={Contact} />
                <Route path="/pricing" component={Pricing} />
                <Route path="/security" component={Security} />
                <Route path="/use-cases" component={UseCases} />
                <Route path="/partners" component={Partners} />
                <Route path="/compare" component={Compare} />
                <Route path="/mobile" component={MobileApp} />
                <Route path="/blog" component={Blog} />
                <Route path="/blog/:slug" component={BlogDetail} />
                <Route path="/help" component={Help} />
                <Route path="/faq" component={FAQ} />
                <Route path="/feedback" component={Feedback} />
                <Route path="/careers" component={Careers} />
                <Route path="/whitepaper" component={Whitepaper} />
                <Route path="/docs" component={Docs} />
                <Route path="/docs/api" component={ApiDocs} />
                <Route path="/docs/integration" component={IntegrationDocs} />
                <Route path="/press" component={Press} />
                <Route path="/terms" component={Terms} />
                <Route path="/privacy" component={Privacy} />
                <Route path="/cookies" component={Cookies} />
                <Route path="/licenses" component={Licenses} />
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