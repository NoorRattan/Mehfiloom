import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Sparkles, Heart, ArrowDown } from "lucide-react";
import { Header, EventNav, Footer, Flower } from "@/components/chrome";
import { Reveal, Magnetic } from "@/components/motion";

export const metadata: Metadata = {
  title: "The Wedding Edit — Your kind of forever",
  description:
    "A romantic, thoughtful space to plan your wedding. Personal ideas, a practical budget, vendor questions, and your own wedding assistant.",
};
export default function WeddingPage() {
  return (
    <div className="theme-wedding event-page">
      <Header kind="wedding" />
      <EventNav kind="wedding" active="explore" />
      <main id="main">
        <section className="wedding-hero wrap">
          <Reveal className="wedding-hero-copy">
            <p className="eyebrow">
              <Heart size={13} /> THE BEGINNING OF YOUR NEXT CHAPTER
            </p>
            <h1>
              For your
              <br />
              kind of <em>forever.</em>
            </h1>
            <p>
              For the vows and the dance floor.
              <br />
              The family traditions and the ones you’ll start.
              <br />
              Let’s make a day that feels like you.
            </p>
            <div className="hero-actions">
              <Magnetic>
                <Link href="/wedding/organize" className="button button-cream">
                  Begin your beautiful day <ArrowUpRight size={17} />
                </Link>
              </Magnetic>
              <Link href="/wedding/assist" className="text-link">
                <Sparkles size={15} /> Dream it up with AI
              </Link>
            </div>
            <span className="wedding-smallnote">
              A little less planning. A little more being in love.
            </span>
          </Reveal>
          <Reveal className="wedding-art" delay={0.12}>
            <div className="wedding-arch">
              <Image
                src="/images/wedding.jpg"
                alt="A romantic wedding table with a floral centrepiece and glowing candles"
                fill
                priority
                sizes="(max-width: 760px) 85vw, 43vw"
              />
            </div>
            <span className="wedding-sideword">
              A DAY. A FEELING. A FOREVER.
            </span>
            <div className="wedding-art-seal">
              <Flower />
              <span>
                entirely
                <br />
                <em>yours.</em>
              </span>
            </div>
            <span className="handwritten wedding-handwriting">
              All the little things
              <br />
              that mean everything.
            </span>
          </Reveal>
        </section>
        <div className="wedding-ribbon">
          <span>THE BIG YES.</span>
          <Flower />
          <span>THE LITTLE DETAILS.</span>
          <Flower />
          <span>THE WHOLE HEART.</span>
          <Flower />
          <span>YOUR BEAUTIFUL BEGINNING.</span>
        </div>
        <section className="event-editorial wrap section-space">
          <Reveal className="editorial-photo">
            <Image
              src="/images/table.jpg"
              alt="A thoughtfully styled wedding celebration"
              fill
              sizes="(max-width: 760px) 90vw, 43vw"
            />
            <span className="editorial-photo-label">
              A feeling, before a checklist.
            </span>
          </Reveal>
          <Reveal className="editorial-copy">
            <p className="eyebrow">LESS OVERWHELM. MORE BUTTERFLIES.</p>
            <h2>
              Every love story
              <br />
              has its <em>own rhythm.</em>
            </h2>
            <p>
              Your wedding should too. Start with the things that matter to you,
              and give the rest a little breathing room.
            </p>
            <div className="editorial-lines">
              <div>
                <span>01</span>
                <p>
                  <strong>Your priorities, beautifully balanced.</strong>A
                  budget that makes room for the things you love.
                </p>
              </div>
              <div>
                <span>02</span>
                <p>
                  <strong>A timeline that lets you exhale.</strong>From finding
                  your venue to your final little details.
                </p>
              </div>
              <div>
                <span>03</span>
                <p>
                  <strong>Good questions. Better decisions.</strong>Thoughtful
                  checklists for your vendor conversations.
                </p>
              </div>
            </div>
            <Link href="/wedding/organize" className="text-link">
              Let’s bring your day together <ArrowUpRight size={17} />
            </Link>
          </Reveal>
        </section>
        <section className="event-assistant-band wrap">
          <Reveal>
            <p className="eyebrow">
              <Sparkles size={14} /> YOUR WEDDING COMPANION
            </p>
            <h2>
              Something old. Something new.
              <br />
              <em>Something helpful.</em>
            </h2>
            <p>
              Tell your assistant about the day you’re imagining.
              <br />
              Find personal ideas, a starting budget, and your next steps.
            </p>
            <Link href="/wedding/assist" className="button button-ink">
              Meet your wedding assistant <ArrowUpRight size={16} />
            </Link>
          </Reveal>
          <Flower className="band-flower" />
        </section>
        <div className="event-endnote wrap">
          <Heart size={18} />
          <span>Here’s to the two of you.</span>
          <a href="#top" aria-label="Back to top">
            <ArrowDown className="rotate-180" size={18} />
          </a>
        </div>
      </main>
      <Footer kind="wedding" />
    </div>
  );
}
