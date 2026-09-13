"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { label: "Home", href: "/dashboard" },
  { label: "Play", href: "/quiz" },
  { label: "Progress", href: "/progress" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "Challenges", href: "/challenges" },
  { label: "Profile", href: "/profile" },
];

export function AppNavbar() {
  const pathname = usePathname();

  return (
    <nav className="sq-nav">
      <Link href="/dashboard" className="sq-logo">
        Sahaba Quest
      </Link>

      <div className="sq-nav-links">
        {navigation.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="sq-nav-link"
              style={
                isActive
                  ? {
                      background: "var(--primary-light)",
                      color: "var(--primary-dark)",
                    }
                  : undefined
              }
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}