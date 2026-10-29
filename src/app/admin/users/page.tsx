"use client";
import { UserManagement } from "@/components/admin/user-management";
import { PageHeader } from "@/components/ui/page-header";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePageTitle } from "@/lib/page-title";
export default function AccountsPage() {
    const { t } = useLanguage();
    usePageTitle(t.access.manageAccounts);
    return <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8"><PageHeader title={t.access.manageAccounts} description={t.access.manageDescription} backHref="/admin" /><UserManagement /></main>;
}
