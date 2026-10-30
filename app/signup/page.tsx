import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { SignupForm } from './signup-form';

export default async function SignupPage() {
  const session = await auth();
  if (session?.user) redirect('/dashboard');

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">CRM Hub</h1>
          <p className="text-muted-foreground mt-2">Create your account to get started</p>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}
