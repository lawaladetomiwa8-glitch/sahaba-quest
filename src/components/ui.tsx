"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { label: "Home", href: "/dashboard", icon: "⌂" },
  { label: "Play", href: "/quiz", icon: "▶" },
  { label: "Progress", href: "/progress", icon: "↗" },
  { label: "Leaderboard", href: "/leaderboard", icon: "★" },
  { label: "Challenges", href: "/challenges", icon: "◆" },
  { label: "Profile", href: "/profile", icon: "●" },
];

export function AppNavbar() {
  const pathname = usePathname();

  return (
    <>
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

      <nav className="sq-mobile-nav">
        {navigation.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sq-mobile-nav-item ${
                isActive ? "sq-mobile-nav-item-active" : ""
              }`}
            >
              <span className="sq-mobile-nav-icon">
                {item.icon}
              </span>

              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}