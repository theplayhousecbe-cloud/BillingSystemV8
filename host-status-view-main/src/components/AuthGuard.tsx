import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { storage } from "@/lib/storage";
import type { Staff } from "@/lib/types";

export function useStaff() {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setStaff(storage.getStaff());
    setReady(true);
  }, []);
  return { staff, ready, setStaff: (s: Staff | null) => { storage.setStaff(s); setStaff(s); } };
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { staff, ready } = useStaff();
  const navigate = useNavigate();
  useEffect(() => {
    if (ready && !staff) navigate({ to: "/login" });
  }, [ready, staff, navigate]);
  if (!ready || !staff) return null;
  return <>{children}</>;
}
