import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, CircleHelp, ClipboardCheck, Sparkles, WalletCards } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

const events = [
  {
    number: "01",
    name: "Wedding",
    subtitle: "A day that sounds like the two of you.",
    text: "Hold your priorities, guest range and vendor questions together—without assuming what your celebration should look like.",
    href: "/wedding",
    theme: "wedding",
    photo: "A table dressed for a warm evening wedding dinner",
    credit: "Photo: ISKRA Photography / Unsplash",
    creditHref: "https://unsplash.com/photos/a-banquet-hall-with-chandeliers-and-tables-iXTkKQyVqbM",
  },
  {
    number: "02",
    name: "Birthday",
    subtitle: "Make it about the person, not the checklist.",
    text: "Find a party rhythm that fits the guest of honor, from a slow dinner to a full afternoon of doing.",
    href: "/birthday",
    theme: "birthday",
    photo: "A small birthday cake with glowing candles",
    credit: "Photo: BenMoses M / Unsplash",
    creditHref: "https://unsplash.com/photos/a-birthday-cake-with-lit-candles-on-a-table-XpdGn1cb6Sc",
  },
  {
    number: "03",
    name: "Community",
    subtitle: "Turn a shared idea into a day people can run.",
    text: "Give the gathering a purpose, put a person beside each task, and keep access and the day-of flow in view.",
    href: "/community",
    theme: "community",
    photo: "Friends sharing a picnic and toasting outdoors",
    credit: "Photo: Vitaly Gariev / Unsplash",
    creditHref: "https://unsplash.com/photos/friends-enjoying-a-picnic-and-toasting-drinks-outdoors-6lkDaLeroEA",
  },
] as const;

export default function Home() {
  return (
    <div className="site site-home" id="top">
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <section className="home-hero" aria-labelledby="home-title">
          <div className="hero-text">
            <p className="eyebrow"><span className="eyebrow-star" aria-hidden="true">✳</span> A CELEBRATION PLANNING ASSISTANT</p>
            <h1 id="home-title">Less “what now?”<br /><span>More “we’re here.”</span></h1>
            <p className="hero-explainer">Mehfiloom turns your wedding, birthday or community-event idea into an editable plan: budget, timeline, checklist and personal touches, all in one place.</p>
            <div className="hero-actions">
              <Link href="#gathering-types" className="button button-primary">Find your kind of gathering <ArrowDown size={16} aria-hidden="true" /></Link>
              <Link href="#how-it-works" className="button button-quiet">See what the plan includes <ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
            <div className="hero-proof"><span><Check size={15} aria-hidden="true" /> Start with a sample</span><span><Check size={15} aria-hidden="true" /> Edit every detail</span><span><Check size={15} aria-hidden="true" /> Nothing gets booked</span></div>
          </div>
          <div className="hero-scene">
            <div className="hero-photo" role="img" aria-label="Friends sharing a picnic and toasting outdoors" />
            <div className="hero-photo-tint" />
            <div className="scene-note scene-note-top"><span>FOR THE PEOPLE</span><i aria-hidden="true">✳</i></div>
            <div className="plan-snapshot" aria-label="Illustrative preview of a Mehfiloom plan">
              <div className="snapshot-head"><span className="snapshot-icon"><Sparkles size={15} aria-hidden="true" /></span><div><small>YOUR FIRST DRAFT</small><strong>A plan taking shape</strong></div><span className="snapshot-status">EDITABLE</span></div>
              <div className="snapshot-preview">
                <div className="snapshot-label"><span>Budget by priority</span><span>Planning targets</span></div>
                <div className="snapshot-bars" aria-hidden="true"><i /><i /><i /><i /></div>
              </div>
              <div className="snapshot-bottom"><span><ClipboardCheck size={15} aria-hidden="true" /> Your next steps</span><span><WalletCards size={15} aria-hidden="true" /> Cost register</span></div>
              <p>Illustrative example · no vendor prices or availability are verified</p>
            </div>
            <div className="scene-caption"><span>A gathering is more than a to-do list.</span><a href="https://unsplash.com/photos/friends-enjoying-a-picnic-and-toasting-drinks-outdoors-6lkDaLeroEA" target="_blank" rel="noreferrer">Photo: Vitaly Gariev / Unsplash</a><span>01 / 03</span></div>
          </div>
          <div className="hero-side-label" aria-hidden="true">A PLACE FOR THE PLANNING THAT MAKES ROOM FOR THE MOMENT</div>
        </section>

        <section className="plain-language" aria-label="What Mehfiloom does">
          <div className="plain-mark" aria-hidden="true">✳</div>
          <p><strong>You bring the occasion.</strong> Mehfiloom helps sort the moving parts into a first plan you can change as real decisions arrive.</p>
          <span className="plain-note"><CircleHelp size={16} aria-hidden="true" /> Not a vendor marketplace</span>
        </section>

        <section className="event-picker" id="gathering-types" aria-labelledby="events-heading">
          <div className="section-intro">
            <p className="eyebrow eyebrow-dark">THREE KINDS OF TOGETHER</p>
            <h2 id="events-heading">What are we<br /><span>getting together for?</span></h2>
            <p>Pick the one that feels like your event. Each starting point is built around different questions.</p>
          </div>
          <div className="event-stack">
            {events.map((event) => (
              <article className={"event-entry event-entry-" + event.theme} key={event.href}>
                <figure className="event-photo-link">
                  <div className="event-entry-photo" role="img" aria-label={event.photo} />
                  <figcaption className="event-photo-credit"><a href={event.creditHref} target="_blank" rel="noreferrer">{event.credit}</a></figcaption>
                </figure>
                <div className="event-entry-copy">
                  <p className="event-index">{event.number} <span /> {event.name.toUpperCase()}</p>
                  <h3>{event.subtitle}</h3>
                  <p>{event.text}</p>
                  <Link className="event-link" href={event.href}>Explore {event.name.toLowerCase()} planning <ArrowUpRight size={16} aria-hidden="true" /></Link>
                </div>
                <span className="event-entry-glyph" aria-hidden="true">{event.theme === "wedding" ? "♡" : event.theme === "birthday" ? "✳" : "↗"}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="plan-explainer" id="how-it-works" aria-labelledby="plan-heading">
          <div className="plan-explainer-copy">
            <p className="eyebrow">FROM “I HAVE AN IDEA” TO “I KNOW WHAT’S NEXT”</p>
            <h2 id="plan-heading">A helpful first draft.<br /><span>Your calls, always.</span></h2>
            <p>Start with what you know. Leave the uncertain bits open. Use a sample or ask AI for a draft, then adjust it to the real people, place and quotes involved.</p>
            <Link href="/planner/wedding" className="text-arrow">See the planning workspace <ArrowRight size={17} aria-hidden="true" /></Link>
          </div>
          <ol className="process-list">
            <li><span className="process-count">01</span><div><h3>Tell us what matters</h3><p>A few details and the feeling you want. “Not sure yet” is a fine place to start.</p></div></li>
            <li><span className="process-count">02</span><div><h3>See a first plan</h3><p>Ideas, tasks, budget categories and vendor questions, together in one draft.</p></div></li>
            <li><span className="process-count">03</span><div><h3>Make it yours</h3><p>Edit, save in this browser and export a copy when you want one.</p></div></li>
          </ol>
        </section>

        <section className="truth-panel">
          <div className="truth-sticker" aria-hidden="true">THE<br />GOOD<br />PART</div>
          <div><p className="eyebrow">KEEP THE IMPORTANT PARTS HUMAN</p><h2>The plan is a helper.<br /><span>The day is the point.</span></h2></div>
          <div className="truth-points"><p><Check size={16} aria-hidden="true" /> Your draft stays on this device.</p><p><Check size={16} aria-hidden="true" /> Examples work without an API key.</p><p><Check size={16} aria-hidden="true" /> Live AI drafting needs a Groq key; your brief is sent to Groq.</p><p><Check size={16} aria-hidden="true" /> Nothing gets ordered, booked or sent to guests.</p></div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
