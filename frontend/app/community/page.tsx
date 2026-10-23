import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Sparkles, MoveDown, Sprout } from "lucide-react";
import { Header, EventNav, Footer, Flower } from "@/components/chrome";
import { Reveal, Magnetic } from "@/components/motion";

export const metadata: Metadata = {
  title: "Common Ground — Good things grow together",
  description:
    "Plan a welcoming community gathering. Shared budgets, volunteer checklists, thoughtful timelines, and your own community planning assistant.",
};
export default function CommunityPage() {
  return (
    <div className="theme-community event-page">
      <Header kind="community" />
      <EventNav kind="community" active="explore" />
      <main id="main">
        <section className="community-hero wrap">
          <Reveal className="community-hero-top">
            <p className="eyebrow">
              <Sprout size={16} /> A LITTLE COMMON GROUND.
            </p>
            <span>OPEN HEARTS. OPEN INVITATION.</span>
          </Reveal>
          <div className="community-headline">
            <Reveal>
              <h1>
                Good things
                <br />
                grow <em>together.</em>
              </h1>
            </Reveal>
            <Reveal className="community-hero-aside">
              <div className="community-emblem">
                <Flower />
                <span>COME AS YOU ARE</span>
              </div>
              <p>
                A shared table. A familiar face.
                <br />A neighbourhood that feels like home.
                <br />
                Let’s bring people together.
              </p>
              <Magnetic>
                <Link
                  href="/community/organize"
                  className="button button-green"
                >
                  Make room for everyone <ArrowUpRight size={17} />
                </Link>
              </Magnetic>
            </Reveal>
          </div>
          <Reveal className="community-wide-photo">
            <Image
              src="/images/community.jpg"
              alt="Friends standing together in warm evening sunlight"
              fill
              priority
              sizes="90vw"
            />
            <div>
              <span>THERE’S A PLACE FOR YOU HERE.</span>
              <MoveDown size={21} />
            </div>
          </Reveal>
          <div className="community-photo-caption">
            <span>SMALL GATHERINGS. BIG CONNECTIONS.</span>
            <span>THE TOGETHER EDIT / 03</span>
          </div>
        </section>
        <section className="community-purpose wrap section-space">
          <Reveal>
            <p className="eyebrow">MORE THAN AN EVENT.</p>
            <h2>
              A reason to show up.
              <br />
              <em>A place to belong.</em>
            </h2>
            <p>
              Whether it’s a neighbourhood potluck, a local makers’ market, or a
              gathering for a shared cause, the best plans start with people.
            </p>
          </Reveal>
          <div className="community-purpose-list">
            {[
              [
                "A shared purpose",
                "Give your gathering a clear intention, then build the day around the people you’re bringing together.",
              ],
              [
                "Many hands, one plan",
                "Make volunteer roles, vendor conversations, and next steps easier to see and share.",
              ],
              [
                "Everyone considered",
                "Keep access, dietary needs, quiet spaces, and a weather backup part of the conversation from the start.",
              ],
            ].map(([t, d], i) => (
              <Reveal key={t}>
                <span>0{i + 1}</span>
                <div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
                <Sprout size={21} />
              </Reveal>
            ))}
          </div>
        </section>
        <section className="community-invitation">
          <div className="wrap">
            <Reveal>
              <p className="eyebrow">
                <Sparkles size={15} /> GOOD IDEAS NEED A LITTLE HELP TO GROW.
              </p>
              <h2>
                You bring the people.
                <br />
                <em>Let’s find the possibilities.</em>
              </h2>
              <p>
                Your community assistant can help shape your idea into a
                practical,
                <br className="desktop-break" /> welcoming starting plan. A
                little support goes a long way.
              </p>
              <Link href="/community/assist" className="button button-cream">
                Meet your gathering assistant <ArrowUpRight size={17} />
              </Link>
            </Reveal>
            <Flower className="community-invitation-flower" />
          </div>
        </section>
      </main>
      <Footer kind="community" />
    </div>
  );
}
