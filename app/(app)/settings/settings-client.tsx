'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PageHeader } from '@/components/layouts/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Users, Link2, Shield, Plus, CheckCircle2, XCircle, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { SafeDate } from '@/components/safe-format';

export function SettingsClient() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === 'ADMIN';

  // Users
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'SALES_REP' });
  const [saving, setSaving] = useState(false);

  // Google
  const [googleStatus, setGoogleStatus] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setUsersLoading(true);
    fetch('/api/settings/users').then(r => r.json()).then(d => setUsers(d ?? [])).catch(() => {}).finally(() => setUsersLoading(false));
    fetch('/api/google/status').then(r => r.json()).then(d => setGoogleStatus(d)).catch(() => {});
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/settings/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? 'Failed'); return; }
      toast.success('User added');
      setAddUserOpen(false);
      setNewUser({ name: '', email: '', password: '', role: 'SALES_REP' });
      fetch('/api/settings/users').then(r => r.json()).then(d => setUsers(d ?? [])).catch(() => {});
    } catch { toast.error('Failed to add user'); }
    finally { setSaving(false); }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await fetch(`/api/settings/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !currentActive }),
      });
      toast.success(currentActive ? 'User deactivated' : 'User activated');
      fetch('/api/settings/users').then(r => r.json()).then(d => setUsers(d ?? [])).catch(() => {});
    } catch { toast.error('Failed to update user'); }
  };

  const handleChangeRole = async (id: string, role: string) => {
    try {
      await fetch(`/api/settings/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      toast.success('Role updated');
      fetch('/api/settings/users').then(r => r.json()).then(d => setUsers(d ?? [])).catch(() => {});
    } catch { toast.error('Failed to update role'); }
  };

  const connectGoogle = async () => {
    try {
      const res = await fetch('/api/google/connect');
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error(data?.error ?? 'Failed to connect');
      }
    } catch { toast.error('Failed to initiate connection'); }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/google/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Synced: ${data?.synced?.contacts ?? 0} contacts, ${data?.synced?.deals ?? 0} deals, ${data?.synced?.transactions ?? 0} transactions`);
        fetch('/api/google/status').then(r => r.json()).then(d => setGoogleStatus(d)).catch(() => {});
      } else {
        toast.error(data?.error ?? 'Sync failed');
      }
    } catch { toast.error('Sync failed'); }
    finally { setSyncing(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your CRM configuration" />

      <Tabs defaultValue="google">
        <TabsList>
          <TabsTrigger value="google"><Link2 className="h-4 w-4 mr-1" />Google Sheets</TabsTrigger>
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-1" />Users</TabsTrigger>
        </TabsList>

        <TabsContent value="google" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5 text-primary" />Google Sheets Integration</CardTitle>
              <CardDescription>Connect your Google account to sync CRM data to Google Sheets</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Status:</span>
                {googleStatus?.connected ? (
                  <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Connected</Badge>
                ) : (
                  <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Not Connected</Badge>
                )}
              </div>
              {googleStatus?.lastSyncAt && (
                <p className="text-sm text-muted-foreground">Last synced: <SafeDate date={googleStatus.lastSyncAt} options={{ dateStyle: 'medium', timeStyle: 'short' }} /></p>
              )}
              {!googleStatus?.configured && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-lg text-sm">
                  Google OAuth is not yet configured. Please set up your Google Cloud project credentials first.
                </div>
              )}
              <div className="flex gap-3">
                {isAdmin && (
                  <Button onClick={connectGoogle} disabled={!googleStatus?.configured}>
                    {googleStatus?.connected ? 'Reconnect' : 'Connect'} Google Account
                  </Button>
                )}
                {googleStatus?.connected && (
                  <Button variant="outline" onClick={handleSync} disabled={syncing}>
                    {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Sync Now
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" />User Management</CardTitle>
                <CardDescription>Add, edit, and manage team members</CardDescription>
              </div>
              {isAdmin && (
                <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add User</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add New User</DialogTitle></DialogHeader>
                    <form onSubmit={handleAddUser} className="space-y-4">
                      <div className="space-y-2"><Label>Name *</Label><Input value={newUser.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUser(p => ({ ...p, name: e.target.value }))} required /></div>
                      <div className="space-y-2"><Label>Email *</Label><Input type="email" value={newUser.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUser(p => ({ ...p, email: e.target.value }))} required /></div>
                      <div className="space-y-2"><Label>Password *</Label><Input type="password" value={newUser.password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUser(p => ({ ...p, password: e.target.value }))} required minLength={6} /></div>
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select value={newUser.role} onValueChange={(v: string) => setNewUser(p => ({ ...p, role: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="SALES_REP">Sales Rep</SelectItem><SelectItem value="ADMIN">Admin</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <Button type="submit" className="w-full" loading={saving}>Add User</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="space-y-3">{[1,2,3].map((i: number) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : (
                <div className="space-y-3">
                  {users.map((u: any) => (
                    <div key={u?.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{u?.name ?? 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{u?.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={u?.active ? 'default' : 'secondary'}>{u?.active ? 'Active' : 'Inactive'}</Badge>
                        {isAdmin ? (
                          <Select value={u?.role} onValueChange={(v: string) => handleChangeRole(u?.id, v)}>
                            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="ADMIN">Admin</SelectItem><SelectItem value="SALES_REP">Sales Rep</SelectItem></SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline">{u?.role}</Badge>
                        )}
                        {isAdmin && u?.id !== session?.user?.id && (
                          <Button variant="outline" size="sm" onClick={() => handleToggleActive(u?.id, u?.active)}>
                            {u?.active ? 'Deactivate' : 'Activate'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
