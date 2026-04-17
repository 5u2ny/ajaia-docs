import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in · Ajaia Docs" };

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Ajaia Docs
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            A lightweight collaborative document editor.
          </p>
        </header>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>

        <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-900">Demo credentials</p>
          <ul className="mt-2 space-y-1 font-mono text-xs">
            <li>alex@demo.app · password123</li>
            <li>maya@demo.app · password123</li>
            <li>jordan@demo.app · password123</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
