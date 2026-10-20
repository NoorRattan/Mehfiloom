import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check, CircleDollarSign, Heart, UsersRound } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Wedding planning for your kind of day | Mehfiloom",
  description: "Build an editable wedding plan around your own priorities, guest range, budget questions and traditions.",
};

const choices = [
  { no: "01", title: "What should it feel like?", body: "A big evening, a quiet ceremony, a few days together—or something only you can describe. Start with your version." },
  { no: "02", title: "Who should be there?", body: "Use a guest range while you compare capacity and catering. Add names only in the places you choose, not in the AI brief." },
  { no: "03", title: "What matters most?", body: "Choose the traditions, people and details to include, adapt or leave out. Mehfiloom won’t infer them for you." },
];

export default function WeddingPage() {
  return (
    <div className="site event-page wedding-page" id="top">
      <SiteHeader current="wedding" />
      <main id="main-content" tabIndex={-1}>
        <section className="event-hero wedding-hero" aria-labelledby="wedding-title">
          <div className="event-hero-copy">
            <p className="eyebrow"><span className="eyebrow-star">♡</span> WEDDINGS · YOUR PEOPLE, YOUR PRIORITIES</p>
            <h1 id="wedding-title">Your day.<br /><span>Your way of doing it.</span></h1>
            <p>Turn the idea of your wedding into a draft you can shape together: next steps, a budget view, supplier questions and room for the details you care about.</p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/planner/wedding">Start your wedding plan <ArrowRight size={16} /></Link>
              <a className="button button-quiet" href="#first-decisions">See what to decide first <ArrowRight size={16} /></a>
            </div>
            <div className="event-reassurance"><span><Check size={15} /> You choose what to include</span><span><Check size={15} /> No names needed to begin</span></div>
          </div>
          <figure className="event-hero-art wedding-art">
            <div className="event-hero-photo" role="img" aria-label="Wedding reception tables in a softly lit hall" />
            <div className="photo-caption">Gather around what matters <a href="https://unsplash.com/photos/a-banquet-hall-with-chandeliers-and-tables-iXTkKQyVqbM" target="_blank" rel="noreferrer">Photo: ISKRA Photography / Unsplash</a></div>
            <div className="wedding-note"><small>A QUESTION FOR THE VENUE</small><strong>What’s included in the quote?</strong><span>Setup · service · overtime · fees</span></div>
            <span className="art-sunburst" aria-hidden="true">✳</span>
          </figure>
          <span className="vertical-annotation" aria-hidden="true">A CELEBRATION, NOT A TEMPLATE</span>
        </section>

        <section className="decision-section" id="first-decisions" aria-labelledby="decisions-title">
          <div className="section-intro">
            <p className="eyebrow eyebrow-dark">BEFORE THE SEATING CHART</p>
            <h2 id="decisions-title">Start with what<br /><span>you want it to feel like.</span></h2>
            <p>No single order works for every wedding. These decisions can stay flexible while you learn more.</p>
          </div>
          <div className="decision-list">{choices.map((choice) => <article className="decision-item" key={choice.no}><span>{choice.no}</span><div><h3>{choice.title}</h3><p>{choice.body}</p></div><ArrowRight size={18} aria-hidden="true" /></article>)}</div>
        </section>

        <section className="guest-logic" aria-labelledby="guest-title">
          <div className="guest-logic-top"><span className="guest-circle" aria-hidden="true"><UsersRound size={27} /></span><p className="eyebrow">ONE ESTIMATE CAN CHANGE A LOT</p></div>
          <h2 id="guest-title">Guest count is a range<br /><span>until it’s a commitment.</span></h2>
          <p>Capacity, food and seating depend on who may come. A supplier’s minimum, final count deadline and charge are contract details, not rules the planner can assume. Keep the estimate editable, and confirm the terms in writing.</p>
          <div className="guest-flow"><span>Invited</span><i /><span>Expected</span><i /><span>Confirmed</span><i /><span>Supplier guarantee</span></div>
        </section>

        <section className="vendor-questions" aria-labelledby="vendor-title">
          <div className="vendor-intro"><p className="eyebrow eyebrow-dark">TAKE THESE TO A REAL CONVERSATION</p><h2 id="vendor-title">A quote is a<br /><span>set of questions.</span></h2><p>Record who confirmed a detail and when. Mehfiloom can hold your notes; it cannot verify a vendor’s availability, rates or contract.</p><Link className="text-arrow" href="/planner/wedding">Keep vendor questions in your plan <ArrowRight size={16} /></Link></div>
          <div className="question-sheet">
            <div className="sheet-label"><span>BEFORE YOU BOOK</span><span>ASK · COMPARE · CONFIRM</span></div>
            <article><span><CalendarDays size={18} /></span><div><h3>Date &amp; guest guarantee</h3><p>How long is the date held? When is the final count due?</p></div></article>
            <article><span><CircleDollarSign size={18} /></span><div><h3>Full cost &amp; exclusions</h3><p>What sits beyond the quote: service, setup, overtime or outside vendors?</p></div></article>
            <article><span><Heart size={18} /></span><div><h3>Changes &amp; access</h3><p>What if the plan changes? Which routes, facilities and weather backup are available?</p></div></article>
          </div>
        </section>

        <section className="event-cta wedding-cta">
          <p className="eyebrow">AN EDITABLE FIRST DRAFT, NEVER A FIXED SCRIPT</p>
          <h2>Make a little room<br />for the day you want.</h2>
          <p>Start with an example or your own details. Confirm prices, dates and local requirements with the people responsible.</p>
          <Link className="button button-light" href="/planner/wedding">Build the first draft <ArrowRight size={16} /></Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
