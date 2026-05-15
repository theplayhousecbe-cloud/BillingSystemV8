import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { User, KeyRound, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useStaff } from "@/components/AuthGuard";
import { EMPLOYEES } from "@/lib/employees";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const { staff, setStaff } = useStaff();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { 
    if (staff) {
      nav({ to: "/" }); 
    }
  }, [staff, nav]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      return toast.error("Enter both username and password");
    }

    setLoading(true);
    
    // Check if employee exists and password matches
    const validEmployee = EMPLOYEES.find(
      (emp) => emp.username.toLowerCase() === username.trim().toLowerCase() && emp.passwordId === password.trim()
    );

    if (!validEmployee) {
      setLoading(false);
      return toast.error("Invalid username or password");
    }

    // Restriction: Only 3 Admins/Stakeholders and Host Vijay can access the billing system
    const allowedUsernames = ["sanjay", "suganya", "arunkumar", "vijayakumar"];
    if (!allowedUsernames.includes(validEmployee.username.toLowerCase())) {
      setLoading(false);
      return toast.error("Access denied: You do not have permission to use the billing system.");
    }

    // All authorized employees in the whitelist can log in
    setStaff({ 
      name: validEmployee.username, 
      mobile: "", 
      loggedInAt: Date.now(), 
      role: validEmployee.role,
      access: (validEmployee as any).access
    } as any);
    toast.success(`Welcome back, ${validEmployee.username}!`);
    nav({ to: "/" });
  };

  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="glass-strong w-full max-w-md rounded-3xl p-8 sm:p-10">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
              <KeyRound className="h-6 w-6" />
            </div>
            <h1 className="font-display text-2xl font-bold">Billing System</h1>
            <p className="text-sm text-muted-foreground">For PlayHouse Cafe — Staff Login</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <Field icon={<User className="h-4 w-4" />} label="Username (First Name)" id="username">
              <input 
                id="username"
                name="username"
                autoComplete="username"
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                placeholder="e.g. Praveenbalaji" 
                className="w-full bg-transparent outline-none" 
              />
            </Field>
            <Field icon={<KeyRound className="h-4 w-4" />} label="Password (ID)" id="password">
              <div className="flex w-full items-center">
                <input 
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  type={showPassword ? "text" : "password"}
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="e.g. PHPS03" 
                  className="w-full bg-transparent outline-none" 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-muted-foreground hover:text-foreground outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <PrimaryButton disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                </>
              ) : (
                <>
                  Login <ArrowRight className="h-4 w-4" />
                </>
              )}
            </PrimaryButton>
          </form>
        </div>
      </main>
    </div>
  );
}

function Field({ icon, label, id, children }: { icon: React.ReactNode; label: string; id: string; children: React.ReactNode }) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <div className="glass flex items-center gap-2 rounded-xl px-3 py-2.5">
        <span className="text-muted-foreground">{icon}</span>
        {children}
      </div>
    </label>
  );
}

function PrimaryButton({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="submit" disabled={disabled} className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50" style={{ background: "var(--gradient-primary)" }}>
      {children}
    </button>
  );
}
