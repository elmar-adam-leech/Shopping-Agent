import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/layout/error-boundary";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { ThemeProvider } from "@/components/theme/theme-provider";

const HomePage = lazy(() => import("./pages/home"));
const InstallPage = lazy(() => import("./pages/install"));
const SettingsPage = lazy(() => import("./pages/settings"));
const ChatPage = lazy(() => import("./pages/chat"));
const ShopForMePage = lazy(() => import("./pages/shop-for-me"));
const EmbedChatPage = lazy(() => import("./pages/embed-chat"));
const EmbedSearchPage = lazy(() => import("./pages/embed-search"));
const EmbedAssistantPage = lazy(() => import("./pages/embed-assistant"));
const EmbedProductPage = lazy(() => import("./pages/embed-product"));
const AdminPage = lazy(() => import("./pages/admin"));
const NotFound = lazy(() => import("./pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
    },
  },
});

function PageLoader() {
  return <LoadingOverlay className="h-screen" />;
}

function EmbedRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/embed/:storeDomain/chat" component={EmbedChatPage} />
        <Route path="/embed/:storeDomain/search" component={EmbedSearchPage} />
        <Route path="/embed/:storeDomain/assistant" component={EmbedAssistantPage} />
        <Route path="/embed/:storeDomain/product/:productHandle" component={EmbedProductPage} />
      </Switch>
    </Suspense>
  );
}

function DashboardRoutes() {
  return (
    <ThemeProvider>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/install" component={InstallPage} />
          <Route path="/_admin/:storeDomain" component={AdminPage} />
          <Route path="/:storeDomain/settings" component={SettingsPage} />
          <Route path="/:storeDomain/chat" component={ChatPage} />
          <Route path="/shop/:storeDomain" component={ShopForMePage} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </ThemeProvider>
  );
}

function Router() {
  const [location] = useLocation();
  const isEmbed = location.startsWith("/embed/");

  if (isEmbed) return <EmbedRoutes />;
  return <DashboardRoutes />;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
