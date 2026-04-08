import { useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  Store as StoreIcon,
  MessageSquare,
  Settings,
  Code,
  Activity,
  Brain,
  Database,
  ExternalLink,
  Shield,
  ArrowLeft,
  BookOpen,
  Layout,
  Search,
  Bot,
} from "lucide-react";
import { useGetStore, useListKnowledge } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { LoadingOverlay } from "@/components/ui/loading-overlay";

export default function AdminPage() {
  const { storeDomain } = useParams<{ storeDomain: string }>();
  const [, navigate] = useLocation();

  const {
    data: store,
    isLoading: storeLoading,
    error: storeError,
  } = useGetStore(storeDomain || "", {
    query: { enabled: !!storeDomain },
  });

  const { data: knowledge } = useListKnowledge(storeDomain || "", undefined, {
    query: { enabled: !!storeDomain },
  });

  const isUnauthorized =
    storeError &&
    typeof storeError === "object" &&
    "status" in storeError &&
    (storeError as { status: number }).status === 401;

  const shouldRedirect = !storeDomain || isUnauthorized;

  useEffect(() => {
    if (shouldRedirect) {
      navigate("/");
    }
  }, [shouldRedirect, navigate]);

  if (shouldRedirect || storeLoading) {
    return <LoadingOverlay className="h-screen" />;
  }

  if (storeError || !store) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive font-medium">
            Failed to load store data
          </p>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const knowledgeCount = Array.isArray(knowledge) ? knowledge.length : 0;

  const quickLinks = [
    {
      label: "Test Chat",
      href: `/${storeDomain}/chat`,
      icon: MessageSquare,
      description: "Open the AI chat interface",
      color: "from-blue-500 to-blue-600",
    },
    {
      label: "Settings",
      href: `/${storeDomain}/settings`,
      icon: Settings,
      description: "Store & AI configuration",
      color: "from-violet-500 to-violet-600",
    },
    {
      label: "Shop For Me",
      href: `/shop/${storeDomain}`,
      icon: Search,
      description: "Customer shopping experience",
      color: "from-emerald-500 to-emerald-600",
    },
  ];

  const embedPreviews = [
    {
      label: "Chat Embed",
      href: `/embed/${storeDomain}/chat`,
      icon: MessageSquare,
    },
    {
      label: "Search Embed",
      href: `/embed/${storeDomain}/search`,
      icon: Search,
    },
    {
      label: "Assistant Embed",
      href: `/embed/${storeDomain}/assistant`,
      icon: Bot,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Home
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-4 mb-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <Shield className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-foreground">
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {storeDomain}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatusCard
            icon={Activity}
            label="Store Status"
            value={store.chatEnabled ? "Active" : "Inactive"}
            detail={`Embed: ${store.embedEnabled ? "On" : "Off"} · Chat: ${store.chatEnabled ? "On" : "Off"}`}
            positive={store.chatEnabled}
          />
          <StatusCard
            icon={Brain}
            label="LLM Provider"
            value={store.provider}
            detail={`Model: ${store.model}`}
          />
          <StatusCard
            icon={Database}
            label="Knowledge Base"
            value={`${knowledgeCount} entries`}
            detail={`API Key: ${store.hasApiKey ? "Configured" : "Not set"}`}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <section>
            <h2 className="text-lg font-bold font-display flex items-center gap-2 mb-4">
              <Layout className="w-5 h-5 text-primary" />
              Quick Actions
            </h2>
            <div className="space-y-3">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <div className="group flex items-center gap-4 p-4 rounded-2xl border border-border/50 bg-card hover:bg-card/80 hover:border-primary/30 transition-all duration-200 cursor-pointer">
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${link.color} flex items-center justify-center text-white shadow-md`}
                    >
                      <link.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm">
                        {link.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {link.description}
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold font-display flex items-center gap-2 mb-4">
              <Code className="w-5 h-5 text-primary" />
              Embed Previews
            </h2>
            <div className="space-y-3">
              {embedPreviews.map((embed) => (
                <Link key={embed.href} href={embed.href}>
                  <div className="group flex items-center gap-4 p-4 rounded-2xl border border-border/50 bg-card hover:bg-card/80 hover:border-primary/30 transition-all duration-200 cursor-pointer">
                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-foreground">
                      <embed.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm">
                        {embed.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Preview embed component
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <section>
          <h2 className="text-lg font-bold font-display flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-primary" />
            Store Configuration
          </h2>
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
            <div className="divide-y divide-border/50">
              <ConfigRow label="Store Domain" value={store.storeDomain} />
              <ConfigRow
                label="Storefront Token"
                value={store.storefrontToken ? "Configured" : "Not set"}
              />
              <ConfigRow label="UCP Compliant" value={store.ucpCompliant ? "Yes" : "No"} />
              <ConfigRow label="Guard Sensitivity" value={store.guardSensitivity} />
              <ConfigRow
                label="Blocked Topics"
                value={
                  store.blockedTopics?.length
                    ? store.blockedTopics.join(", ")
                    : "None"
                }
              />
              <ConfigRow
                label="Recommendation Strategy"
                value={store.recommendationStrategy}
              />
              <ConfigRow
                label="Data Retention"
                value={`${store.dataRetentionDays} days`}
              />
              <ConfigRow
                label="Welcome Message"
                value={store.welcomeMessage || "Default"}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  detail,
  positive,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="text-xl font-bold text-foreground capitalize">
        {positive !== undefined && (
          <span
            className={`inline-block w-2 h-2 rounded-full mr-2 ${positive ? "bg-emerald-500" : "bg-red-400"}`}
          />
        )}
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{detail}</p>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground text-right max-w-[60%] truncate">
        {value}
      </span>
    </div>
  );
}
