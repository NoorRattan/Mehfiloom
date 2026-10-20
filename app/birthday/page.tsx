import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Clock3, Heart, Sparkles, Utensils } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Birthday planning built around the guest of honor | Mehfiloom",
  description: "Shape an editable birthday budget, party rhythm and host checklist around the person being celebrated.",
};

const beats = [
  { icon: <Clock3 size={18} />, time: "ARRIVE", title: "Settle in", copy: "Give people time to find the space and each other." },
  { icon: <Sparkles size={18} />, time: "THE MAIN THING", title: "Make the memory", copy: "Let the activity or shared moment have the best part of the day." },
  { icon: <Utensils size={18} />, time: "PAUSE", title: "Eat & celebrate", copy: "Food and cake at a pace that suits the group." },
  { icon: <Heart size={18} />, time: "WIND DOWN", title: "End gently", copy: "Leave space for gifts, goodbyes or quiet." },
];

export default function BirthdayPage() {
  return (
    <div className="site event-page birthday-page" id="top">
      <SiteHeader current="birthday" />
      <main id="main-content" tabIndex={-1}>
        <section className="birthday-hero" aria-labelledby="birthday-title">
          <div className="birthday-hero-copy">
            <p className="eyebrow"><span className="eyebrow-star">✳</span> BIRTHDAYS · BUILT AROUND THE PERSON</p>
            <h1 id="birthday-title">Make it feel<br /><span>like their day.</span></h1>
            <p>Start with what makes the guest of honor light up—not a one-size-fits-all party list. Then shape the people, food, activity and pace around them.</p>
            <Link className="button button-primary" href="/planner/birthday">Start a birthday plan <ArrowRight size={16} /></Link>
            <div className="event-reassurance"><span><Check size={15} /> Child, teen, adult or mixed ages</span><span><Check size={15} /> No name or exact age needed</span></div>
          </div>
          <figure className="birthday-hero-art">
            <div className="birthday-hero-photo" role="img" aria-label="A small birthday cake with lit candles" />
            <figcaption>MAKE A WISH · TAKE YOUR TIME <a href="https://unsplash.com/photos/a-birthday-cake-with-lit-candles-on-a-table-XpdGn1cb6Sc" target="_blank" rel="noreferrer">Photo: BenMoses M / Unsplash</a></figcaption>
            <div className="birthday-sticker" aria-hidden="true"><span>for the</span><strong>one<br />you love</strong><i>✳</i></div>
            <div className="birthday-caption-card"><span>FIRST, ASK</span><strong>What would make them grin?</strong></div>
          </figure>
          <span className="birthday-ribbon" aria-hidden="true">SMALL PARTY / BIG PARTY / YOUR PARTY</span>
        </section>

        <section className="birthday-formats" aria-labelledby="formats-title">
          <div className="section-intro"><p className="eyebrow eyebrow-dark">THE FORMAT FOLLOWS THE PERSON</p><h2 id="formats-title">What kind of birthday<br /><span>would they actually love?</span></h2><p>Keep the plan loose until the honoree’s energy, the guest mix and the space make the shape clear.</p></div>
          <div className="format-tape">
            <article><span>01 / SLOW</span><h3>Good food, good talk</h3><p>A dinner, picnic or open-door afternoon with no packed schedule.</p></article>
            <article><span>02 / MAKE</span><h3>Something to do</h3><p>A game, craft, show or trip with the gathering built around it.</p></article>
            <article><span>03 / SURPRISE</span><h3>Keep the secret safely</h3><p>Decide who can see the details and how the guest of honor stays out of the invite loop.</p></article>
          </div>
        </section>

        <section className="birthday-rhythm" aria-labelledby="rhythm-title">
          <div className="rhythm-heading"><p className="eyebrow">AN OPTIONAL RHYTHM, NOT A RULE</p><h2 id="rhythm-title">If an activity is<br /><span>the main event.</span></h2><p>Use the beats as a starting point. A dinner, surprise or drop-in party needs a different flow.</p><Link className="text-arrow" href="/planner/birthday">Put your own rhythm in the plan <ArrowRight size={16} /></Link></div>
          <div className="rhythm-list">{beats.map((beat, index) => <article key={beat.time} className={index === 1 ? "rhythm-featured" : ""}><span className="rhythm-icon">{beat.icon}</span><small>{beat.time}</small><h3>{beat.title}</h3><p>{beat.copy}</p></article>)}</div>
        </section>

        <section className="birthday-budget" aria-labelledby="birthday-budget-title">
          <div><p className="eyebrow eyebrow-dark">THE SMALL STUFF ADDS UP</p><h2 id="birthday-budget-title">Make space for<br /><span>the fun and the practical.</span></h2><p>These are budget categories, not suggested prices. Replace planning targets with quotes for your place, group and format.</p></div>
          <ol><li>Space &amp; setup</li><li>Food &amp; cake</li><li>Main activity</li><li>Decor &amp; supplies</li><li>Helpers &amp; cleanup</li><li>A little reserve</li></ol>
        </section>

        <section className="birthday-care" aria-labelledby="care-title">
          <div className="care-photo" role="img" aria-label="Birthday candles glowing in a warmly lit room"><span>GOOD HOSTING IS IN THE DETAILS</span></div>
          <div><p className="eyebrow">COMFORT IS PART OF THE PARTY</p><h2 id="care-title">A good time has<br /><span>room to be yourself.</span></h2><p>Confirm food ingredients and preparation directly with the provider. Consider clear routes, a quieter place to pause, activity options and a named adult for child supervision when appropriate.</p><p className="care-note"><Check size={16} /> Keep sensitive health and food details with the host; don’t put them into an AI prompt.</p><Link className="text-arrow" href="/planner/birthday">Build a thoughtful host checklist <ArrowRight size={16} /></Link></div>
        </section>

        <section className="event-cta birthday-cta"><p className="eyebrow">START WITH WHAT THEY LOVE</p><h2>Plan the party.<br />Keep the day theirs.</h2><p>Use a sample without an account, then edit the plan. Mehfiloom won’t order supplies or contact guests.</p><Link className="button button-dark" href="/planner/birthday">Make the first draft <ArrowRight size={16} /></Link></section>
      </main>
      <SiteFooter />
    </div>
  );
}
