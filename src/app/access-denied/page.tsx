"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { Clock } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
function AccessMessage() {
    const { t } = useLanguage();
    const params = useSearchParams();
    return <AuthShell><Card className="learning-panel learning-mistakeAnalysis"><CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />{t.access.deniedTitle}</CardTitle></CardHeader><CardContent className="space-y-5"><p>{params.get("reason") === "expired" ? t.access.expiredMessage : t.access.disabledMessage}</p><Button className="w-full" onClick={() => signOut({ callbackUrl: "/login" })}>{t.access.backToLogin}</Button></CardContent></Card></AuthShell>;
}
export default function AccessDeniedPage() { return <Suspense><AccessMessage /></Suspense>; }
