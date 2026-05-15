import { Toaster } from "@/components/ui/sonner";
import { Outlet, Link, createRootRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { storage } from "@/lib/storage";
import { applyTheme } from "@/components/ThemeToggle";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-strong max-w-md rounded-3xl p-10 text-center">
        <h1 className="font-display text-7xl font-bold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:scale-105"
            style={{ background: "var(--gradient-primary)" }}
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function ThemeBootstrap() {
  useEffect(() => {
    applyTheme(storage.getTheme());
  }, []);
  return null;
}

function RootComponent() {
  return (
    <>
      <ThemeBootstrap />
      <Outlet />
      <Toaster richColors position="top-center" />
    </>
  );
}
