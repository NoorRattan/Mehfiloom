import Link from "next/link";
import { ArrowUpRight, Menu } from "lucide-react";

const links = [
  { href: "/wedding", label: "Weddings" },
  { href: "/birthday", label: "Birthdays" },
  { href: "/community", label: "Community" },
] as const;

type EventKey = "wedding" | "birthday" | "community";

export function SiteHeader({ current }: { current?: EventKey }) {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="Mehfiloom home">
          <span className="wordmark-symbol" aria-hidden="true">m</span>
          <span>mehfiloom<span className="wordmark-period">.</span></span>
        </Link>
        <nav className="site-nav" aria-label="Explore event planning">
          {links.map((item) => <Link href={item.href} key={item.href} aria-current={current === item.href.slice(1) ? "page" : undefined}>{item.label}</Link>)}
        </nav>
        <Link className="header-action" href="/#gathering-types">Start with your event <ArrowUpRight size={16} aria-hidden="true" /></Link>
        <details className="mobile-nav">
          <summary><Menu size={20} aria-hidden="true" /><span className="visually-hidden">Toggle navigation menu</span></summary>
          <nav aria-label="Mobile event navigation">
            {links.map((item) => <Link href={item.href} key={item.href} aria-current={current === item.href.slice(1) ? "page" : undefined}>{item.label}</Link>)}
            <Link href="/#gathering-types">Start a plan</Link>
          </nav>
        </details>
      </header>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <Link className="wordmark footer-wordmark" href="/" aria-label="Mehfiloom home">
          <span className="wordmark-symbol" aria-hidden="true">m</span>
          <span>mehfiloom<span className="wordmark-period">.</span></span>
        </Link>
        <p>Better plans. More room for the people.</p>
        <Link href="#top" className="footer-top">Back to top <ArrowUpRight size={15} aria-hidden="true" /></Link>
      </div>
      <div className="footer-bottom">
        <span>Private drafts, kept on this device.</span>
        <span>Weddings · Birthdays · Community</span>
      </div>
    </footer>
  );
}
