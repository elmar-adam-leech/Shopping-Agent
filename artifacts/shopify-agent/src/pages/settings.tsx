import { useRoute } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { LLMConfigForm } from "@/components/settings/LLMConfigForm";
import { KnowledgeEditor } from "@/components/settings/KnowledgeEditor";
import { ThemeIntegrationSettings } from "@/components/settings/ThemeIntegrationSettings";
import { BrandVoiceSettings } from "@/components/settings/BrandVoiceSettings";
import { CustomInstructionsSettings } from "@/components/settings/CustomInstructionsSettings";
import { DataRetentionSettings } from "@/components/settings/DataRetentionSettings";
import { WebhookSettings } from "@/components/settings/WebhookSettings";

export default function SettingsPage() {
  const [, params] = useRoute("/:storeDomain/settings");
  const storeDomain = params?.storeDomain || "";

  return (
    <AppLayout storeDomain={storeDomain}>
      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 sm:space-y-12">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">Agent Settings</h1>
          <p className="text-muted-foreground text-lg">Configure the brain behind your AI shopping assistant.</p>
        </div>

        <BrandVoiceSettings storeDomain={storeDomain} />

        <CustomInstructionsSettings storeDomain={storeDomain} />

        <LLMConfigForm storeDomain={storeDomain} />

        <ThemeIntegrationSettings storeDomain={storeDomain} />

        <WebhookSettings storeDomain={storeDomain} />

        <KnowledgeEditor storeDomain={storeDomain} />

        <DataRetentionSettings storeDomain={storeDomain} />
      </div>
    </AppLayout>
  );
}
