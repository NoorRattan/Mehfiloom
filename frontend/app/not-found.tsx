import Link from "next/link";
import { Header, Footer, Flower } from "@/components/chrome";

export default function NotFound() {
  return (
    <div className="home-page">
      <Header />
      <main id="main" className="not-found wrap">
        <Flower />
        <p className="eyebrow">A LITTLE OFF THE GUEST LIST.</p>
        <h1>
          This page has
          <br />
          <em>slipped away.</em>
        </h1>
        <p>There’s still something lovely waiting to be planned.</p>
        <Link href="/" className="button button-accent">
          Back to the good things ↗
        </Link>
      </main>
      <Footer />
    </div>
  );
}
