"use client";

import { AccountAccessGuard } from "@/components/account-access-guard";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { SessionProvider } from "next-auth/react";
import { TimeZoneProvider } from "@/contexts/TimeZoneContext";
import { AppShell } from "@/components/app-shell";
import { BackgroundTasksButton } from "@/components/background-tasks-button";
import { FeedbackHost } from "@/components/ui/feedback-host";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

export function Providers({ children, timeZone }: { children: React.ReactNode; timeZone?: string }) {
    return (
        <SessionProvider refetchInterval={30} refetchOnWindowFocus>
            <LanguageProvider>
                <TimeZoneProvider initialTimeZone={timeZone}>
                    <AccountAccessGuard>
                        <AppShell>{children}</AppShell>
                        <BackgroundTasksButton />
                    </AccountAccessGuard>
                    <FeedbackHost />
                    <ServiceWorkerRegister />
                </TimeZoneProvider>
            </LanguageProvider>
        </SessionProvider>
    );
}
