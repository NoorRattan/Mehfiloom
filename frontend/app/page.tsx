import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  Sparkles,
} from "lucide-react";
import { Header, Footer, Flower } from "@/components/chrome";
import { Reveal, Magnetic } from "@/components/motion";
import Sculpture from "@/components/sculpture";

export default function Home() {
  return (
    <div className="home-page">
      <Header />
      <main id="main">
        <section className="home-hero wrap" aria-labelledby="hero-title">
          <div className="hero-copy">
            <Reveal>
              <p className="eyebrow">
                <span className="tiny-sun">✳</span> LIFE IS BETTER WHEN WE
                CELEBRATE.
              </p>
              <h1 id="hero-title">
                Good times.
                <br />
                Great company.
                <br />
                <em>Your kind of magic.</em>
              </h1>
              <p className="hero-description">
                Big days. Little details. A thoughtful planning companion
                <br className="desktop-break" /> for the moments you’ll want to
                remember.
              </p>
              <div className="hero-actions">
                <Magnetic>
                  <Link className="button button-accent" href="#celebrations">
                    Find your celebration
                    <ArrowUpRight size={17} />
                  </Link>
                </Magnetic>
                <a href="#the-approach" className="text-link">
                  A little look inside <ArrowRight size={16} />
                </a>
              </div>
              <div className="hero-footnote">
                <span className="footnote-symbol">✧</span>
                <span>Your ideas. A little AI. A lot of possibility.</span>
              </div>
            </Reveal>
          </div>
          <Reveal className="hero-art" delay={0.15}>
            <div className="orbit-line" aria-hidden="true" />
            <div className="hero-photo">
              <Image
                src="/images/wedding.jpg"
                alt="An intimate reception table set with fresh flowers"
                fill
                priority
                sizes="(max-width: 760px) 78vw, 36vw"
              />
              <div className="photo-caption">
                <span>THE ART OF COMING TOGETHER</span>
                <span>NO. 001</span>
              </div>
            </div>
            <div className="hero-inset">
              <Image
                src="/images/birthday.jpg"
                alt="Colourful balloons ready for a celebration"
                fill
                sizes="(max-width: 760px) 40vw, 17vw"
              />
              <span>A reason to make a wish.</span>
            </div>
            <div className="joy-stamp">
              <Flower />
              <span>
                less planning
                <br />
                <strong>more living.</strong>
              </span>
            </div>
            <span className="handwritten hero-handwriting">
              Here’s to your next
              <br />
              favourite memory.
            </span>
            <svg
              className="hero-squiggle"
              width="97"
              height="70"
              viewBox="0 0 97 70"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 10C26 3 60 5 65 29c5 23-27 32-34 16S50 18 87 58m-15-3 16 4-3-16"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </Reveal>
        </section>
        <div className="hero-baseline wrap">
          <span>THOUGHTFULLY PLANNED. WHOLEHEARTEDLY CELEBRATED.</span>
          <a href="#celebrations" aria-label="Explore celebrations">
            <ArrowDown size={17} />
          </a>
          <span>WEDDINGS · BIRTHDAYS · TOGETHERNESS</span>
        </div>
        <section
          className="celebrations wrap section-space"
          id="celebrations"
          aria-labelledby="celebrations-title"
        >
          <Reveal className="section-heading">
            <div>
              <p className="eyebrow">A DIFFERENT WORLD FOR EVERY OCCASION</p>
              <h2 id="celebrations-title">
                What are we <em>celebrating?</em>
              </h2>
            </div>
            <p>
              Every gathering has a feeling.
              <br />
              Let’s find yours.
            </p>
          </Reveal>
          <div className="event-portals">
            <Reveal className="portal-wrap">
              <Link href="/wedding" className="event-portal portal-wedding">
                <div className="portal-image">
                  <Image
                    src="/images/wedding.jpg"
                    alt="Elegant wedding reception with fresh flowers"
                    fill
                    sizes="(max-width: 760px) 90vw, 31vw"
                  />
                  <span className="portal-number">01 / THE WEDDING EDIT</span>
                  <span className="portal-tag">A beautiful beginning</span>
                </div>
                <div className="portal-bottom">
                  <div>
                    <h3>
                      Two hearts.
                      <br />
                      <em>One beautiful day.</em>
                    </h3>
                    <span>WEDDINGS</span>
                  </div>
                  <span className="circle-arrow">
                    <ArrowUpRight />
                  </span>
                </div>
              </Link>
            </Reveal>
            <Reveal className="portal-wrap" delay={0.08}>
              <Link href="/birthday" className="event-portal portal-birthday">
                <div className="portal-image">
                  <Image
                    src="/images/birthday.jpg"
                    alt="Colourful balloons ready for a birthday"
                    fill
                    sizes="(max-width: 760px) 90vw, 31vw"
                  />
                  <span className="portal-number">02 / THE BIRTHDAY CLUB</span>
                  <Flower className="birthday-flower" />
                  <span className="portal-tag">Make a little noise.</span>
                </div>
                <div className="portal-bottom">
                  <div>
                    <h3>
                      More candles.
                      <br />
                      <em>More main character.</em>
                    </h3>
                    <span>BIRTHDAYS</span>
                  </div>
                  <span className="circle-arrow">
                    <ArrowUpRight />
                  </span>
                </div>
              </Link>
            </Reveal>
            <Reveal className="portal-wrap" delay={0.16}>
              <Link href="/community" className="event-portal portal-community">
                <div className="portal-image">
                  <Image
                    src="/images/community.jpg"
                    alt="Friends together in warm evening sunlight"
                    fill
                    sizes="(max-width: 760px) 90vw, 31vw"
                  />
                  <span className="portal-number">03 / THE TOGETHER CLUB</span>
                  <span className="community-seal">
                    COME
                    <br />
                    AS YOU
                    <br />
                    ARE ↗
                  </span>
                </div>
                <div className="portal-bottom">
                  <div>
                    <h3>
                      Good people.
                      <br />
                      <em>Common ground.</em>
                    </h3>
                    <span>COMMUNITY GATHERINGS</span>
                  </div>
                  <span className="circle-arrow">
                    <ArrowUpRight />
                  </span>
                </div>
              </Link>
            </Reveal>
          </div>
        </section>
        <section className="approach-section" id="the-approach">
          <div className="wrap approach-grid">
            <Reveal className="approach-intro">
              <p className="eyebrow">THE JOY IS IN THE MOMENT.</p>
              <h2>
                The plan?
                <br />
                <em>We’ll help with that.</em>
              </h2>
              <p>
                Keep the happy anticipation.
                <br />
                Lose the seventeen open tabs.
              </p>
              <Sculpture />
            </Reveal>
            <div className="approach-steps">
              {[
                [
                  "01",
                  "Start with a feeling.",
                  "A candlelit dinner? A dance-until-late birthday? Tell us what you have in mind. Big ideas and half-formed thoughts welcome.",
                ],
                [
                  "02",
                  "Give it a little shape.",
                  "Your AI assistant turns your brief into a personal starting point: a sensible budget, a timeline, and ideas that feel like you.",
                ],
                [
                  "03",
                  "Make room for the good part.",
                  "Keep your checklist, vendor questions, and budget together in your own event organizer. Less juggling. More being there.",
                ],
              ].map(([number, title, text]) => (
                <Reveal className="approach-step" key={number}>
                  <span>{number}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                  <ArrowUpRight size={19} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
        <section className="assistant-preview wrap section-space">
          <Reveal className="assistant-preview-copy">
            <p className="eyebrow">
              <Sparkles size={15} /> A THOUGHTFUL SECOND PAIR OF HANDS
            </p>
            <h2>
              A spark of an idea.
              <br />
              <em>A plan that’s yours.</em>
            </h2>
            <p>
              Tell us the mood, the people, the things that matter.
              <br />
              Your assistant connects the dots, so you can focus
              <br className="desktop-break" /> on what makes your celebration
              yours.
            </p>
            <Link href="#celebrations" className="text-link">
              Meet your planning companion <ArrowUpRight size={17} />
            </Link>
          </Reveal>
          <Reveal className="planning-note">
            <span className="note-tape" />
            <div className="note-header">
              <Flower />
              <span>A LITTLE PLANNING MAGIC</span>
              <span>✧</span>
            </div>
            <p className="note-prompt">
              “A garden wedding. Our closest people.
              <br />
              And a little room to dance.”
            </p>
            <div className="note-response">
              <span className="note-spark">
                <Sparkles size={16} />
              </span>
              <div>
                <strong>Let’s start with what matters.</strong>
                <p>
                  An intimate setting, a shared table, and a timeline that
                  leaves you time to enjoy it.
                </p>
              </div>
            </div>
            <div className="note-checks">
              <span>
                <Check size={13} /> Budget with breathing room
              </span>
              <span>
                <Check size={13} /> Your next steps, in order
              </span>
              <span>
                <Check size={13} /> Personal touches, thoughtfully chosen
              </span>
            </div>
            <span className="note-example">AN ILLUSTRATIVE PLANNING NOTE</span>
          </Reveal>
        </section>
        <section className="closing-section">
          <Reveal>
            <Flower />
            <p className="eyebrow">THE BEST PART IS YET TO COME.</p>
            <h2>
              Let’s make a little
              <br />
              <em>something to remember.</em>
            </h2>
            <Magnetic>
              <Link className="button button-cream" href="#celebrations">
                Your next good thing starts here <ArrowUpRight size={17} />
              </Link>
            </Magnetic>
          </Reveal>
          <span className="closing-wordmark" aria-hidden="true">
            celebrate.
          </span>
        </section>
      </main>
      <Footer />
    </div>
  );
}
