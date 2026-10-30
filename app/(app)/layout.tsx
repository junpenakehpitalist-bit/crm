import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { CrmSidebar } from '@/components/crm-sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <div className="min-h-screen bg-background">
      <CrmSidebar />
      <main className="md:ml-[240px] transition-all duration-normal">
        <div className="p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
