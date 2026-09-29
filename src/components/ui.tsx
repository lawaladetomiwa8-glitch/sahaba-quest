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
    label: "Daily Quest",
    href: "/daily-quest",
    icon: "☀",
  },
  {
    label: "Sponsored",
    href: "/sponsored-competitions",
    icon: "🏆",
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
  { label: "Family Ranking", href: "/family-member-leaderboard", icon: "★" },
  { label: "Challenges", href: "/family-member-challenges", icon: "◆" },
  { label: "Daily Quest", href: "/family-member-daily-quest", icon: "☀" },
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
    label: "Daily Quest",
    href: "/daily-quest",
    icon: "☀",
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
    pathname === "/family-member-quiz" ||
    pathname === "/family-member-challenges" ||
    pathname.startsWith("/family-member-challenges/") ||
    pathname === "/family-member-daily-quest" ||
    pathname === "/family-member-leaderboard";

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

  /*
   * ---------------------------------------------------------
   * MOBILE MENU BEHAVIOUR
   * ---------------------------------------------------------
   *
   * The menu closes automatically whenever the route changes
   * and when the user presses Escape. This prevents an open
   * overlay from remaining on top of another page.
   */
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

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

    if (href === "/family-member-challenges") {
      return (
        pathname === "/family-member-challenges" ||
        pathname.startsWith("/family-member-challenges/")
      );
    }

    if (href === "/family-member-daily-quest") {
      return pathname === "/family-member-daily-quest";
    }

    if (href === "/family-member-leaderboard") {
      return pathname === "/family-member-leaderboard";
    }

    if (href === "/daily-quest") {
      return pathname === "/daily-quest";
    }

    if (href === "/sponsored-competitions") {
      return (
        pathname === "/sponsored-competitions" ||
        pathname.startsWith("/sponsored-competitions/")
      );
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
                aria-current={isActive ? "page" : undefined}
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
          zIndex: 100,
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
          <div
            className="sq-mobile-menu"
            role="menu"
            aria-label="Sahaba Quest navigation"
          >
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

      {/* =====================================================
          RESPONSIVE NAVIGATION
          Desktop keeps the existing full navigation.
          Mobile shows only ONE header: the branded header
          with the hamburger menu.
      ====================================================== */}
      <style jsx>{`
        /*
         * =====================================================
         * RESPONSIVE NAVIGATION SYSTEM
         * =====================================================
         *
         * Desktop:
         * - Full navigation from 901px upward.
         * - Navigation links can scroll horizontally at narrower
         *   desktop/tablet widths instead of breaking the page.
         *
         * Mobile/tablet:
         * - Compact branded header.
         * - Hamburger menu.
         * - Menu overlays the page instead of pushing content down.
         */

        .sq-nav {
          display: flex;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          overflow: hidden;
        }

        .sq-nav-links {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 6px;
          flex: 1 1 auto;
          min-width: 0;
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: none;
          -ms-overflow-style: none;
          padding: 2px 0;
        }

        .sq-nav-links::-webkit-scrollbar {
          display: none;
        }

        .sq-nav-link {
          flex: 0 0 auto;
          white-space: nowrap;
          min-height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .sq-mobile-nav {
          display: none;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }

        .sq-mobile-menu-button {
          flex-shrink: 0;
          width: 44px;
          height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #dfe9e7;
          border-radius: 12px;
          background: #ffffff;
          color: #123b38;
          font-size: 22px;
          line-height: 1;
          font-weight: 800;
          cursor: pointer;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }

        .sq-mobile-menu-button:hover {
          background: #f2f8f7;
        }

        .sq-mobile-menu-button:focus-visible {
          outline: 3px solid rgba(8, 118, 109, 0.2);
          outline-offset: 2px;
        }

        .sq-mobile-menu-item {
          min-height: 48px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 18px;
          color: #123b38;
          text-decoration: none;
          font-size: 14px;
          font-weight: 800;
          border-bottom: 1px solid #edf3f2;
          -webkit-tap-highlight-color: transparent;
        }

        .sq-mobile-menu-item:last-child {
          border-bottom: 0;
        }

        .sq-mobile-menu-item:hover {
          background: #f6faf9;
        }

        .sq-mobile-menu-item-active {
          background: var(--primary-light);
          color: var(--primary-dark);
        }

        .sq-mobile-menu-icon {
          width: 30px;
          min-width: 30px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 17px;
        }

        /*
         * Medium desktop/tablet widths.
         * Keep the full web navigation available without allowing
         * it to force horizontal overflow across the application.
         */
        @media (max-width: 1180px) and (min-width: 901px) {
          .sq-nav {
            gap: 12px !important;
            padding-left: 16px !important;
            padding-right: 16px !important;
          }

          .sq-nav-links {
            gap: 2px;
          }

          .sq-nav-link {
            padding-left: 9px !important;
            padding-right: 9px !important;
            font-size: 12px !important;
          }
        }

        /*
         * Mobile and small tablets.
         * 900px is intentional so tablets in portrait mode do not
         * receive a cramped desktop navigation.
         */
        @media (max-width: 900px) {
          .sq-nav {
            display: none !important;
          }

          .sq-mobile-nav {
            display: block !important;
            position: relative;
            z-index: 1000;
            background: #ffffff;
            border-bottom: 1px solid #dfe9e7;
            box-shadow: 0 4px 18px rgba(6, 63, 59, 0.06);
          }

          .sq-mobile-header {
            width: 100%;
            min-height: 68px;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 10px 14px;
          }

          .sq-mobile-header > a {
            min-width: 0;
            flex: 1 1 auto;
            overflow: hidden;
          }

          .sq-mobile-header > a > span:last-child {
            min-width: 0;
            overflow: hidden;
          }

          .sq-mobile-header > a > span:last-child > span:first-child,
          .sq-mobile-header > a > span:last-child > span:last-child {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          /*
           * The menu is an overlay. It does NOT push dashboard,
           * quiz, leaderboard, profile or any other page content.
           */
          .sq-mobile-menu {
            position: absolute !important;
            top: 100% !important;
            left: 0 !important;
            right: 0 !important;
            z-index: 9999 !important;
            width: 100% !important;
            max-width: 100vw !important;
            max-height: calc(100dvh - 68px) !important;
            overflow-x: hidden !important;
            overflow-y: auto !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            border-top: 1px solid #dfe9e7 !important;
            border-bottom: 1px solid #dfe9e7 !important;
            box-shadow: 0 12px 28px rgba(6, 63, 59, 0.14) !important;
            overscroll-behavior: contain;
            -webkit-overflow-scrolling: touch;
          }

          .sq-mobile-menu-item {
            width: 100%;
          }
        }

        @media (max-width: 420px) {
          .sq-mobile-header {
            padding-left: 10px;
            padding-right: 10px;
          }

          .sq-mobile-header a > span:first-child {
            width: 38px !important;
            height: 38px !important;
            min-width: 38px !important;
            font-size: 13px !important;
          }

          .sq-mobile-header a > span:last-child > span:first-child {
            font-size: 14px !important;
          }

          .sq-mobile-header a > span:last-child > span:last-child {
            font-size: 6px !important;
            letter-spacing: 0.8px !important;
          }

          .sq-mobile-menu-button {
            width: 42px;
            height: 42px;
          }
        }

        /*
         * Reduced-motion support for users/devices that request it.
         */
        @media (prefers-reduced-motion: reduce) {
          .sq-mobile-menu,
          .sq-mobile-menu-item,
          .sq-nav-link {
            scroll-behavior: auto !important;
            transition: none !important;
          }
        }
      `}</style>
    </>
  );
}
