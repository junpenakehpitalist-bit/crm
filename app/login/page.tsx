import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect('/dashboard');

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">CRM Hub</h1>
          <p className="text-muted-foreground mt-2">Sign in to manage your sales pipeline</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
