import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Sparkles, PartyPopper } from "lucide-react";
import { Header, EventNav, Footer, Flower } from "@/components/chrome";
import { Reveal, Magnetic } from "@/components/motion";

export const metadata: Metadata = {
  title: "The Birthday Club — Make a little noise",
  description:
    "A birthday planner with personality. Find a theme, plan your party budget, organise your checklist, and dream it up with your birthday AI assistant.",
};
export default function BirthdayPage() {
  return (
    <div className="theme-birthday event-page">
      <Header kind="birthday" />
      <EventNav kind="birthday" active="explore" />
      <main id="main">
        <section className="birthday-hero wrap">
          <Reveal className="birthday-kicker">
            <p className="eyebrow">
              <PartyPopper size={15} /> WELCOME TO THE BIRTHDAY CLUB
            </p>
            <span>CAKE. CHAOS. CORE MEMORIES.</span>
          </Reveal>
          <div className="birthday-hero-grid">
            <Reveal className="birthday-copy">
              <h1>
                MAKE
                <br />A <span>WISH.</span>
                <Flower />
              </h1>
              <p>
                Another trip around the sun.
                <br />A very good excuse to make a big deal.
              </p>
              <Magnetic>
                <Link
                  href="/birthday/organize"
                  className="button button-birthday"
                >
                  Let’s get this party started <ArrowUpRight size={18} />
                </Link>
              </Magnetic>
              <Link href="/birthday/assist" className="text-link">
                <Sparkles size={15} /> Need a brilliant party idea?
              </Link>
            </Reveal>
            <Reveal className="birthday-art" delay={0.12}>
              <div className="birthday-photo">
                <Image
                  src="/images/birthday.jpg"
                  alt="Party lights and playful birthday decorations"
                  fill
                  priority
                  sizes="(max-width: 760px) 85vw, 44vw"
                />
                <span className="birthday-photo-note">
                  This is your moment.
                </span>
              </div>
              <span className="birthday-sticker">
                GET
                <br />
                <em>carried</em>
                <br />
                AWAY ↗
              </span>
              <span className="birthday-spark">✧</span>
              <span className="handwritten birthday-handwriting">
                Big energy.
                <br />
                Very you.
              </span>
            </Reveal>
          </div>
          <div className="birthday-hero-bottom">
            <span>AGE IS JUST A NUMBER.</span>
            <span>THE VIBE? ENTIRELY YOURS.</span>
            <span>↓ THERE’S MORE GOOD STUFF</span>
          </div>
        </section>
        <section className="birthday-manifesto">
          <div className="wrap">
            <Reveal>
              <p className="eyebrow">ONE RULE: MAKE IT FEEL LIKE THEM.</p>
              <h2>
                Not another party.
                <br />
                <span>
                  Their kind of <em>party.</em>
                </span>
              </h2>
            </Reveal>
            <div className="birthday-detail-lines">
              {[
                [
                  "01 / THE VIBE",
                  "Low-key picnic? Full disco?",
                  "Start with what they love. Pick a mood that feels personal, from the first invitation to the last song.",
                ],
                [
                  "02 / THE PLAN",
                  "Good times. Sensible budget.",
                  "Make room for the cake, the activities, and those little extras. Keep your spending plan in one happy place.",
                ],
                [
                  "03 / THE MOMENT",
                  "More celebrating. Less juggling.",
                  "Invites, refreshments, setup: a simple checklist keeps the details moving so you can be part of the fun.",
                ],
              ].map(([n, t, d]) => (
                <Reveal key={n}>
                  <span className="eyebrow">{n}</span>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
        <section className="birthday-assistant wrap section-space">
          <Reveal>
            <span className="birthday-mini-tag">
              YOUR PLUS-ONE FOR THE PLANNING
            </span>
            <h2>
              Fresh out of ideas?
              <br />
              <em>We brought extra.</em>
            </h2>
            <p>
              Share their interests, your budget, and the guest list.
              <br />
              Your birthday assistant will help you find the spark.
            </p>
            <Link className="button button-ink" href="/birthday/assist">
              <Sparkles size={16} /> Dream up something good{" "}
              <ArrowUpRight size={17} />
            </Link>
          </Reveal>
          <div className="birthday-idea-poster" aria-hidden="true">
            <span>
              GOOD TIMES
              <br />
              INCOMING
            </span>
            <Flower />
            <p>
              make it
              <br />
              <em>memorable.</em>
            </p>
            <span>EST. EVERY SINGLE BIRTHDAY.</span>
          </div>
        </section>
      </main>
      <Footer kind="birthday" />
    </div>
  );
}
