"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ArrowRight, Menu, X, Sparkles } from "lucide-react";
import { events, eventKinds, type EventKind } from "@/lib/events";
import { Magnetic } from "./motion";

export function Flower({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`flower ${className}`}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      {Array.from({ length: 8 }, (_, index) => (
        <ellipse
          key={index}
          cx="24"
          cy="13"
          rx="5.8"
          ry="11.5"
          fill="currentColor"
          transform={`rotate(${index * 45} 24 24)`}
        />
      ))}
      <circle cx="24" cy="24" r="4" fill="var(--paper)" />
    </svg>
  );
}

export function Header({ kind }: { kind?: EventKind }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
      if (event.key === "Tab") {
        const links = menuRef.current?.querySelectorAll<HTMLAnchorElement>("a");
        if (!links?.length) return;
        if (
          !event.shiftKey &&
          document.activeElement === links[links.length - 1]
        ) {
          event.preventDefault();
          toggleRef.current?.focus();
        } else if (
          event.shiftKey &&
          document.activeElement === toggleRef.current
        ) {
          event.preventDefault();
          links[links.length - 1].focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <header className={`site-header ${kind ? `header-${kind}` : ""}`}>
      <Link href="/" className="brand" aria-label="Mehfiloom home">
        <Flower />
        <span>
          mehfiloom<span className="brand-dot">.</span>
        </span>
      </Link>
      <nav className="desktop-nav" aria-label="Celebrations">
        {eventKinds.map((type) => (
          <Link
            href={`/${type}`}
            key={type}
            className={kind === type ? "active" : ""}
            aria-current={pathname === `/${type}` ? "page" : undefined}
          >
            {events[type].label}
            {kind === type && <span className="nav-dot" />}
          </Link>
        ))}
        <Link href="/#the-approach">Our approach</Link>
      </nav>
      <Magnetic className="header-action">
        <Link
          className="button button-small button-ink"
          href={kind ? `/${kind}/organize` : "/#celebrations"}
        >
          {kind ? "Open your planner" : "Let’s make a plan"}
          <ArrowUpRight size={15} />
        </Link>
      </Magnetic>
      <button
        ref={toggleRef}
        className="menu-toggle"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        aria-controls="mobile-navigation"
        onClick={() => setOpen(!open)}
      >
        {open ? <X /> : <Menu />}
      </button>
      {open && (
        <div id="mobile-navigation" className="mobile-nav" ref={menuRef}>
          <nav aria-label="Mobile navigation">
            {eventKinds.map((type) => (
              <Link key={type} href={`/${type}`} onClick={() => setOpen(false)}>
                {events[type].label}
                <ArrowUpRight />
              </Link>
            ))}
            <Link href="/#the-approach" onClick={() => setOpen(false)}>
              Our approach
              <ArrowUpRight />
            </Link>
            <Link
              href={kind ? `/${kind}/organize` : "/#celebrations"}
              onClick={() => setOpen(false)}
            >
              Start planning
              <ArrowRight />
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

export function EventNav({
  kind,
  active,
}: {
  kind: EventKind;
  active: "explore" | "organize" | "assist";
}) {
  return (
    <nav className="event-nav" aria-label={`${events[kind].label} workspace`}>
      <Link href={`/${kind}`} className="event-nav-label">
        THE {kind === "community" ? "GATHERING" : kind.toUpperCase()} EDIT{" "}
        <span>↘</span>
      </Link>
      <div>
        {(["explore", "organize", "assist"] as const).map((tab) => (
          <Link
            key={tab}
            aria-current={active === tab ? "page" : undefined}
            className={active === tab ? "selected" : ""}
            href={`/${kind}${tab === "explore" ? "" : `/${tab}`}`}
          >
            {tab === "assist" && <Sparkles size={13} />}
            {tab === "explore"
              ? "The inspiration"
              : tab === "organize"
                ? "Your organizer"
                : "Your AI assistant"}
          </Link>
        ))}
      </div>
      <span className="event-nav-note">A little less to think about.</span>
    </nav>
  );
}

export function Footer({ kind }: { kind?: EventKind }) {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <Link href="/" className="brand">
          <Flower />
          <span>mehfiloom.</span>
        </Link>
        <p>
          Made for the moments
          <br />
          that make a life.
        </p>
        <Link
          href={kind ? `/${kind}/organize` : "/#celebrations"}
          className="footer-cta"
        >
          Make something memorable
          <ArrowUpRight size={22} />
        </Link>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Mehfiloom</span>
        <span>Thoughtfully planned. Wholeheartedly celebrated.</span>
        <a href="#top">Back to top ↑</a>
      </div>
    </footer>
  );
}
