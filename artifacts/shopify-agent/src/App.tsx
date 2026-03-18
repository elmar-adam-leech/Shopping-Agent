import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import { Loader2 } from "lucide-react";

const HomePage = lazy(() => import("./pages/home"));
const InstallPage = lazy(() => import("./pages/install"));
const SettingsPage = lazy(() => import("./pages/settings"));
const ChatPage = lazy(() => import("./pages/chat"));
const AnalyticsPage = lazy(() => import("./pages/analytics"));
const ShopForMePage = lazy(() => import("./pages/shop-for-me"));
const EmbedChatPage = lazy(() => import("./pages/embed-chat"));
const EmbedSearchPage = lazy(() => import("./pages/embed-search"));
const EmbedAssistantPage = lazy(() => import("./pages/embed-assistant"));
const EmbedProductPage = lazy(() => import("./pages/embed-product"));
const NotFound = lazy(() => import("./pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/embed/:storeDomain/chat" component={EmbedChatPage} />
        <Route path="/embed/:storeDomain/search" component={EmbedSearchPage} />
        <Route path="/embed/:storeDomain/assistant" component={EmbedAssistantPage} />
        <Route path="/embed/:storeDomain/product/:productHandle" component={EmbedProductPage} />
        <Route path="/" component={HomePage} />
        <Route path="/install" component={InstallPage} />
        <Route path="/:storeDomain/settings" component={SettingsPage} />
        <Route path="/:storeDomain/chat" component={ChatPage} />
        <Route path="/:storeDomain/analytics" component={AnalyticsPage} />
        <Route path="/shop/:storeDomain" component={ShopForMePage} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
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
