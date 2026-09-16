"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navigation = [
  { label: "Home", href: "/dashboard", icon: "⌂" },
  { label: "Play", href: "/quiz", icon: "▶" },
  { label: "Progress", href: "/progress", icon: "↗" },
  { label: "Leaderboard", href: "/leaderboard", icon: "★" },
  { label: "Challenges", href: "/challenges", icon: "◆" },
  { label: "Pricing", href: "/pricing", icon: "₦" },
  { label: "Profile", href: "/profile", icon: "●" },
];

export function AppNavbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Desktop Navigation */}
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

      {/* Mobile Navigation */}
      <nav className="sq-mobile-nav">
        <div className="sq-mobile-header">
          <Link
            href="/dashboard"
            className="sq-mobile-logo"
            onClick={closeMobileMenu}
          >
            Sahaba Quest
          </Link>

          <button
            type="button"
            className="sq-mobile-menu-button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="sq-mobile-menu">
            {navigation.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sq-mobile-menu-item ${
                    isActive ? "sq-mobile-menu-item-active" : ""
                  }`}
                  onClick={closeMobileMenu}
                >
                  <span className="sq-mobile-menu-icon">
                    {item.icon}
                  </span>

                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </nav>
    </>
  );
}