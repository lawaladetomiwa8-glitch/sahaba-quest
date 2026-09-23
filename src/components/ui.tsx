"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type AccountType = "free" | "individual" | "family";

type NavigationItem = {
  label: string;
  href: string;
  icon: string;
};

const individualNavigation: NavigationItem[] = [
  {
    label: "Home",
    href: "/dashboard",
    icon: "⌂",
  },
  {
    label: "Play",
    href: "/quiz",
    icon: "▶",
  },
  {
    label: "Progress",
    href: "/progress",
    icon: "↗",
  },
  {
    label: "Leaderboard",
    href: "/leaderboard",
    icon: "★",
  },
  {
    label: "Challenges",
    href: "/challenges",
    icon: "◆",
  },
  {
    label: "Pricing",
    href: "/pricing",
    icon: "₦",
  },
  {
    label: "Profile",
    href: "/profile",
    icon: "●",
  },
];

const familyNavigation: NavigationItem[] = [
  {
    label: "Home",
    href: "/family-dashboard",
    icon: "⌂",
  },
  {
    label: "Play",
    href: "/family-quest",
    icon: "▶",
  },
  {
    label: "Progress",
    href: "/family-progress",
    icon: "↗",
  },
  {
    label: "Leaderboard",
    href: "/family-leaderboard",
    icon: "★",
  },
  {
    label: "Challenges",
    href: "/family-challenges",
    icon: "◆",
  },
  {
    label: "Pricing",
    href: "/pricing",
    icon: "₦",
  },
  {
    label: "Profile",
    href: "/family-profile",
    icon: "●",
  },
];

export function AppNavbar() {
  const pathname = usePathname();

  const [accountType, setAccountType] =
    useState<AccountType | null>(null);

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  /*
   * ---------------------------------------------------------
   * LOAD ACCOUNT TYPE
   * ---------------------------------------------------------
   *
   * The navbar uses the user's actual account_type from
   * profiles so Family users automatically receive Family
   * navigation while Individual/Free users keep the normal
   * navigation.
   */
  useEffect(() => {
    let mounted = true;

    async function loadAccountType() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || !mounted) {
          return;
        }

        const { data: profile, error } =
          await supabase
            .from("profiles")
            .select("account_type")
            .eq("id", user.id)
            .maybeSingle();

        if (error) {
          console.error(
            "Navbar account type error:",
            error
          );

          return;
        }

        if (!mounted) {
          return;
        }

        const type = profile?.account_type;

        if (
          type === "family" ||
          type === "individual" ||
          type === "free"
        ) {
          setAccountType(type);
        }
      } catch (error) {
        console.error(
          "Navbar account loading error:",
          error
        );
      }
    }

    void loadAccountType();

    return () => {
      mounted = false;
    };
  }, []);

  /*
   * ---------------------------------------------------------
   * SELECT NAVIGATION
   * ---------------------------------------------------------
   *
   * We also use the URL as an immediate fallback.
   *
   * This prevents a Family page from briefly showing the
   * Individual navigation while the profile query is loading.
   */
  const isFamilyPath =
    pathname === "/family-dashboard" ||
    pathname === "/family-quest" ||
    pathname === "/family-progress" ||
    pathname === "/family-leaderboard" ||
    pathname === "/family-challenges" ||
    pathname.startsWith("/family-challenges/") ||
    pathname === "/family-profile";

  const navigation = useMemo(() => {
    if (accountType === "family") {
      return familyNavigation;
    }

    if (accountType === "individual" || accountType === "free") {
      return individualNavigation;
    }

    if (isFamilyPath) {
      return familyNavigation;
    }

    return individualNavigation;
  }, [accountType, isFamilyPath]);

  /*
   * ---------------------------------------------------------
   * CORRECT LOGO DESTINATION
   * ---------------------------------------------------------
   */
  const homeHref =
    accountType === "family" || isFamilyPath
      ? "/family-dashboard"
      : "/dashboard";

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  /*
   * ---------------------------------------------------------
   * ACTIVE LINK
   * ---------------------------------------------------------
   */
  function isNavigationActive(href: string) {
    if (href === "/dashboard") {
      return (
        pathname === "/dashboard"
      );
    }

    if (href === "/family-dashboard") {
      return (
        pathname === "/family-dashboard"
      );
    }

    if (href === "/quiz") {
      return pathname === "/quiz";
    }

    if (href === "/family-quest") {
      return pathname === "/family-quest";
    }

    if (href === "/progress") {
      return pathname === "/progress";
    }

    if (href === "/family-progress") {
      return pathname === "/family-progress";
    }

    if (href === "/leaderboard") {
      return pathname === "/leaderboard";
    }

    if (href === "/family-leaderboard") {
      return pathname === "/family-leaderboard";
    }

    if (href === "/challenges") {
      return (
        pathname === "/challenges" ||
        pathname.startsWith("/challenges/")
      );
    }

    if (href === "/family-challenges") {
      return (
        pathname === "/family-challenges" ||
        pathname.startsWith("/family-challenges/")
      );
    }

    if (href === "/profile") {
      return pathname === "/profile";
    }

    if (href === "/family-profile") {
      return pathname === "/family-profile";
    }

    if (href === "/pricing") {
      return pathname === "/pricing";
    }

    return pathname === href;
  }

  return (
    <>
      {/* =====================================================
          DESKTOP NAVIGATION
      ====================================================== */}

      <nav className="sq-nav">
        <Link
          href={homeHref}
          className="sq-logo"
        >
          Sahaba Quest
        </Link>

        <div className="sq-nav-links">
          {navigation.map((item) => {
            const isActive =
              isNavigationActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className="sq-nav-link"
                style={
                  isActive
                    ? {
                        background:
                          "var(--primary-light)",
                        color:
                          "var(--primary-dark)",
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

      {/* =====================================================
          MOBILE NAVIGATION
      ====================================================== */}

      <nav className="sq-mobile-nav">
        <div className="sq-mobile-header">
          <Link
            href={homeHref}
            className="sq-mobile-logo"
            onClick={closeMobileMenu}
          >
            Sahaba Quest
          </Link>

          <button
            type="button"
            className="sq-mobile-menu-button"
            onClick={() =>
              setMobileMenuOpen(
                (open) => !open
              )
            }
            aria-label={
              mobileMenuOpen
                ? "Close navigation menu"
                : "Open navigation menu"
            }
            aria-expanded={
              mobileMenuOpen
            }
          >
            {mobileMenuOpen
              ? "✕"
              : "☰"}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="sq-mobile-menu">
            {navigation.map((item) => {
              const isActive =
                isNavigationActive(
                  item.href
                );

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sq-mobile-menu-item ${
                    isActive
                      ? "sq-mobile-menu-item-active"
                      : ""
                  }`}
                  onClick={
                    closeMobileMenu
                  }
                >
                  <span className="sq-mobile-menu-icon">
                    {item.icon}
                  </span>

                  <span>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </nav>
    </>
  );
}