"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Clock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTimeZone } from "@/contexts/TimeZoneContext";
import { accountAccessStatus } from "@/lib/account-access";
import { apiClient } from "@/lib/api-client";
import { formatDateTime } from "@/lib/date-time";
import { getApiErrorMessage } from "@/lib/error-message";
import { toast } from "@/lib/feedback";
import type { AdminUser } from "@/types/api";

function localInput(value: Date) {
    return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
interface UserAccessProps { user: AdminUser; onSaved: () => void }
export function UserAccessStatus({ user }: { user: AdminUser }) {
    const { t } = useLanguage();
    const { timeZone } = useTimeZone();
    const status = accountAccessStatus(user);
    return <div className="space-y-1">
        <Badge variant={status === "active" ? "secondary" : "destructive"}>{status === "expired" ? t.access.expired : status === "active" ? t.admin.active : t.admin.disabled}</Badge>
        <p className="text-xs text-muted-foreground">{user.role === "admin" || !user.accessExpiresAt ? t.access.unlimited : `${t.access.expiryShort} ${formatDateTime(user.accessExpiresAt, "yyyy-MM-dd HH:mm", timeZone)}`}</p>
    </div>;
}
export function UserAccessDialog({ user, onSaved }: UserAccessProps) {
    const { t } = useLanguage();
    const { data: session } = useSession();
    const [open, setOpen] = useState(false);
    const [role, setRole] = useState(user.role || "user");
    const [active, setActive] = useState(user.isActive ?? true);
    const [ai, setAi] = useState(user.canUseAi !== false);
    const [data, setData] = useState(user.canImportExport !== false);
    const [unlimited, setUnlimited] = useState(!user.accessExpiresAt);
    const [expiry, setExpiry] = useState(user.accessExpiresAt ? localInput(new Date(user.accessExpiresAt)) : "");
    const [saving, setSaving] = useState(false);
    const protectedUser = user.id === session?.user.id || user.email === "admin@localhost";
    function show() {
        setRole(user.role || "user"); setActive(user.isActive ?? true);
        setAi(user.canUseAi !== false); setData(user.canImportExport !== false);
        setUnlimited(!user.accessExpiresAt); setExpiry(user.accessExpiresAt ? localInput(new Date(user.accessExpiresAt)) : "");
        setOpen(true);
    }
    async function save() {
        const value = new Date(expiry);
        if (role !== "admin" && !unlimited && (!expiry || !Number.isFinite(value.getTime()))) { toast.error(t.access.invalidTime); return; }
        setSaving(true);
        try {
            await apiClient.patch(`/api/admin/users/${user.id}`, { role, isActive: active, canUseAi: ai, canImportExport: data, accessExpiresAt: role === "admin" || unlimited ? null : value.toISOString() });
            toast.success(t.access.saved); setOpen(false); onSaved();
        } catch (error) { toast.error(getApiErrorMessage(error) || t.common.error); }
        finally { setSaving(false); }
    }
    return <>
        <Button variant="outline" size="sm" onClick={show} disabled={protectedUser} title={protectedUser ? t.access.protected : t.access.editAccess}><Clock className="h-4 w-4" />{t.access.editAccess}</Button>
        <Dialog open={open} onOpenChange={value => !saving && setOpen(value)}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
                <DialogHeader><DialogTitle>{t.access.editAccess}</DialogTitle><DialogDescription className="break-all">{user.name} · {user.email}</DialogDescription></DialogHeader>
                <div className="space-y-5">
                    <div className="space-y-2"><Label htmlFor={`role-${user.id}`}>{t.admin.role}</Label><Select value={role} onValueChange={setRole} disabled={saving}><SelectTrigger id={`role-${user.id}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="user">{t.admin.user}</SelectItem><SelectItem value="admin">{t.admin.admin}</SelectItem></SelectContent></Select></div>
                    <div className="flex items-center justify-between gap-3"><Label htmlFor={`active-${user.id}`}>{t.admin.active}</Label><Switch id={`active-${user.id}`} checked={active} onCheckedChange={setActive} disabled={saving} /></div>
                    <p className="text-sm text-muted-foreground">{t.access.permissionHint}</p>
                    <div className="flex items-center justify-between gap-3"><Label htmlFor={`ai-${user.id}`}>{t.access.aiPermission}</Label><Switch id={`ai-${user.id}`} checked={role === "admin" || ai} onCheckedChange={setAi} disabled={saving || role === "admin"} /></div>
                    <div className="flex items-center justify-between gap-3"><Label htmlFor={`data-${user.id}`}>{t.access.dataPermission}</Label><Switch id={`data-${user.id}`} checked={role === "admin" || data} onCheckedChange={setData} disabled={saving || role === "admin"} /></div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3 dark:border-amber-800 dark:bg-amber-950/20">
                        <div className="flex justify-between gap-3"><Label htmlFor={`unlimited-${user.id}`}>{t.access.unlimited}</Label><Switch id={`unlimited-${user.id}`} checked={role === "admin" || unlimited} onCheckedChange={setUnlimited} disabled={saving || role === "admin"} /></div>
                        <Label htmlFor={`expiry-${user.id}`}>{t.access.expiresAt}</Label>
                        <Input id={`expiry-${user.id}`} type="datetime-local" value={expiry} onChange={e => setExpiry(e.target.value)} disabled={saving || unlimited || role === "admin"} />
                        <p className="text-xs text-muted-foreground">{t.access.localTime} · {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
                        <div className="flex flex-wrap gap-2">{[1, 7, 30].map(days => <Button key={days} size="sm" variant="outline" disabled={saving || role === "admin"} onClick={() => { const current = expiry ? new Date(expiry).getTime() : 0; setExpiry(localInput(new Date(Math.max(Number.isFinite(current) ? current : 0, Date.now()) + days * 86400000))); setUnlimited(false); }}>{days === 1 ? t.access.extend1 : days === 7 ? t.access.extend7 : t.access.extend30}</Button>)}</div>
                        <p className="text-xs text-muted-foreground">{t.access.extendHint}</p>
                        <p className="text-sm">{t.access.expiryHint}</p>
                    </div>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t.common.cancel}</Button><Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{t.common.save}</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    </>;
}
