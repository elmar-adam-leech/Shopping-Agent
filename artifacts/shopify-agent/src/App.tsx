import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import HomePage from "./pages/home";
import InstallPage from "./pages/install";
import SettingsPage from "./pages/settings";
import ChatPage from "./pages/chat";
import AnalyticsPage from "./pages/analytics";
import ShopForMePage from "./pages/shop-for-me";
import EmbedChatPage from "./pages/embed-chat";
import EmbedSearchPage from "./pages/embed-search";
import EmbedAssistantPage from "./pages/embed-assistant";
import EmbedProductPage from "./pages/embed-product";
import NotFound from "./pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

function Router() {
  return (
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
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
