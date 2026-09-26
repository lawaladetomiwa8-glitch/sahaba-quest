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

const familyMemberNavigation: NavigationItem[] = [
  { label: "Home", href: "/family-member-dashboard", icon: "⌂" },
  { label: "Play", href: "/family-member-quiz", icon: "▶" },
  { label: "My Progress", href: "/family-member-dashboard#progress", icon: "↗" },
  { label: "Family Ranking", href: "/family-member-dashboard#leaderboard", icon: "★" },
  { label: "Switch Member", href: "/family-member-login", icon: "⇄" },
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
    label: "Members",
    href: "/family-members",
    icon: "👥",
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
    pathname === "/family-profile" ||
    pathname === "/family-members";

  const isFamilyMemberPath =
    pathname === "/family-member-dashboard" ||
    pathname === "/family-member-quiz";

  const navigation = useMemo(() => {
    // A stored member token must NEVER override the Owner navigation.
    // The URL identifies which dashboard is currently being viewed.
    if (isFamilyMemberPath) {
      return familyMemberNavigation;
    }

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
  }, [accountType, isFamilyPath, isFamilyMemberPath, pathname]);

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
      return pathname === "/dashboard";
    }

    if (href === "/family-dashboard") {
      return pathname === "/family-dashboard";
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

    if (href === "/family-members") {
      return pathname === "/family-members";
    }

    if (href === "/family-member-dashboard") {
      return pathname === "/family-member-dashboard";
    }

    if (href === "/family-member-quiz") {
      return pathname === "/family-member-quiz";
    }

    if (href === "/family-member-login") {
      return pathname === "/family-member-login";
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

      <nav
        className="sq-nav"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "24px",
          padding: "12px 24px",
          background: "rgba(255, 255, 255, 0.96)",
          borderBottom: "1px solid #dfe9e7",
          boxShadow: "0 4px 18px rgba(6, 63, 59, 0.06)",
          position: "relative",
          zIndex: 50,
        }}
      >
        <Link
          href={
            isFamilyMemberPath
              ? "/family-member-dashboard"
              : accountType === "family"
                ? "/family-dashboard"
                : "/dashboard"
          }
          aria-label="Sahaba Quest Home"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            textDecoration: "none",
            color: "#123b38",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: "44px",
              height: "44px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "13px",
              background:
                "linear-gradient(145deg, #063f3b 0%, #075b55 55%, #08766d 100%)",
              border: "1px solid rgba(8, 118, 109, 0.25)",
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: 900,
              letterSpacing: "-0.5px",
              boxShadow: "0 5px 14px rgba(6, 63, 59, 0.18)",
            }}
          >
            SQ
          </span>

          <span
            style={{
              display: "flex",
              flexDirection: "column",
              lineHeight: 1.05,
            }}
          >
            <span
              style={{
                color: "#123b38",
                fontSize: "15px",
                fontWeight: 900,
                letterSpacing: "-0.3px",
              }}
            >
              Sahaba Quest
            </span>
            <span
              style={{
                marginTop: "4px",
                color: "#08766d",
                fontSize: "7px",
                fontWeight: 800,
                letterSpacing: "1.1px",
              }}
            >
              LEARN • REMEMBER • COMPETE
            </span>
          </span>
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

      <nav
        className="sq-mobile-nav"
        style={{
          position: "relative",
          zIndex: 50,
          background: "#ffffff",
          borderBottom: "1px solid #dfe9e7",
          boxShadow: "0 4px 18px rgba(6, 63, 59, 0.06)",
        }}
      >
        <div
          className="sq-mobile-header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "14px",
            padding: "10px 16px",
          }}
        >
          <Link
            href={
              isFamilyMemberPath
                ? "/family-member-dashboard"
                : accountType === "family"
                  ? "/family-dashboard"
                  : "/dashboard"
            }
            aria-label="Sahaba Quest Home"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "9px",
              textDecoration: "none",
              color: "#123b38",
            }}
          >
            <span
              style={{
                width: "40px",
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "12px",
                background:
                  "linear-gradient(145deg, #063f3b 0%, #075b55 55%, #08766d 100%)",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: 900,
                boxShadow: "0 4px 12px rgba(6, 63, 59, 0.16)",
              }}
            >
              SQ
            </span>
            <span
              style={{
                color: "#123b38",
                fontSize: "14px",
                fontWeight: 900,
                letterSpacing: "-0.25px",
              }}
            >
              Sahaba Quest
            </span>
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
