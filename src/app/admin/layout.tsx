"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type AdminUser = {
  user_id: string;
  role: "super_admin" | "admin";
  is_active: boolean;
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [admin, setAdmin] = useState<AdminUser | null>(null);

  useEffect(() => {
    let mounted = true;

    async function verifyAdmin() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("admin_users")
        .select("user_id, role, is_active")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (error || !data) {
        router.replace("/dashboard");
        return;
      }

      if (mounted) {
        setAdmin(data as AdminUser);
        setChecking(false);
      }
    }

    verifyAdmin();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (checking || !admin) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--background)", padding: 24 }}>
        <div className="sq-card" style={{ maxWidth: 420, width: "100%", padding: 36, textAlign: "center" }}>
          <div style={{ fontSize: 42, marginBottom: 16 }}>🔐</div>
          <h2 style={{ margin: 0 }}>Verifying admin access...</h2>
          <p className="sq-subtitle">Please wait while we verify your permissions.</p>
        </div>
      </main>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 50, borderBottom: "1px solid var(--border)", background: "var(--background)", backdropFilter: "blur(12px)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 20 }}>Sahaba Quest</div>
            <div style={{ marginTop: 2, fontSize: 11, fontWeight: 800, color: "var(--muted)", letterSpacing: ".6px", textTransform: "uppercase" }}>
              Admin Panel
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ padding: "7px 10px", borderRadius: 999, background: "var(--primary-light)", color: "var(--primary)", fontSize: 11, fontWeight: 900, textTransform: "uppercase" }}>
              {admin.role.replace("_", " ")}
            </span>
            <button
              type="button"
              className="sq-button-secondary"
              style={{ border: "none", cursor: "pointer" }}
              onClick={async () => {
                await supabase.auth.signOut();
                router.replace("/login");
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "22px 20px 60px" }}>
        {children}
      </div>
    </div>
  );
}
