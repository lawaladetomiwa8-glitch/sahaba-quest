"use client";

import { useCallback, useEffect, useRef } from "react";
import Script from "next/script";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
    }
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type TurnstileWidgetProps = {
  action: "auth" | "signup";
  resetSignal: number;
  onTokenChange: (token: string | null) => void;
};

const SITE_KEY = process.env.NEXT_PUBLIC_CLOUDFLARE_SITE_KEY;

export default function TurnstileWidget({
  action,
  resetSignal,
  onTokenChange,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const renderWidget = useCallback(() => {
    const turnstile = window.turnstile;
    const container = containerRef.current;

    if (!SITE_KEY || !turnstile || !container || widgetIdRef.current) {
      return;
    }

    try {
      widgetIdRef.current = turnstile.render(container, {
        sitekey: SITE_KEY,
        action,
        callback: (token) => onTokenChange(token),
        "error-callback": () => onTokenChange(null),
        "expired-callback": () => onTokenChange(null),
      });
    } catch {
      onTokenChange(null);
    }
  }, [action, onTokenChange]);

  useEffect(() => {
    if (resetSignal > 0 && widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
      onTokenChange(null);
    }
  }, [onTokenChange, resetSignal]);

  useEffect(
    () => () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // The widget may already have been removed by Turnstile.
        } finally {
          widgetIdRef.current = null;
        }
      }
    },
    []
  );

  if (!SITE_KEY) return null;

  return (
    <>
      <Script
        id="cloudflare-turnstile"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={renderWidget}
        onError={() => onTokenChange(null)}
      />
      <div ref={containerRef} aria-label="Security verification" />
    </>
  );
}
