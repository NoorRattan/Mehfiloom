import type { Metadata } from "next";
import Link from "next/link";
import { Accessibility, ArrowRight, Check, CloudSun, HandHeart, Megaphone, UsersRound } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Community event planning, built around the people who make it happen | Mehfiloom",
  description: "Plan a neighborhood gathering, workshop or fundraiser with shared tasks, a practical run sheet, access prompts and clear local checks.",
};

const run = [
  { label: "BEFORE", icon: <HandHeart size={17} />, title: "Set the space", copy: "Access route, tables, signs, supplies and a five-minute volunteer handoff." },
  { label: "ARRIVAL", icon: <UsersRound size={17} />, title: "Make a warm welcome", copy: "Show people check-in, seating, facilities and who can answer a question." },
  { label: "TOGETHER", icon: <Megaphone size={17} />, title: "Make room for the reason", copy: "Keep the activity, meal or shared moment visible, with breathing room." },
  { label: "AFTER", icon: <Check size={17} />, title: "Close the loop", copy: "Clear the site, return borrowed gear and thank the people who helped." },
];

export default function CommunityPage() {
  return (
    <div className="site event-page community-page" id="top">
      <SiteHeader current="community" />
      <main id="main-content" tabIndex={-1}>
        <section className="community-hero" aria-labelledby="community-title">
          <div className="community-hero-copy">
            <p className="eyebrow"><span className="eyebrow-star">↗</span> COMMUNITY · FROM SHARED IDEA TO SHARED WORK</p>
            <h1 id="community-title">Bring people<br /><span>together for a reason.</span></h1>
            <p>For the neighborhood meal, the local workshop, the cleanup or the fundraiser. Turn the purpose into a first draft that a team can actually use.</p>
            <Link className="button button-primary" href="/planner/community">Start a community plan <ArrowRight size={16} /></Link>
            <div className="event-reassurance"><span><Check size={15} /> Start with the people and purpose</span><span><Check size={15} /> Give each task an owner</span></div>
          </div>
          <figure className="community-hero-art">
            <div className="community-hero-photo" role="img" aria-label="Friends sharing a picnic and toasting outdoors" />
            <figcaption>GOOD THINGS HAPPEN TOGETHER <a href="https://unsplash.com/photos/friends-enjoying-a-picnic-and-toasting-drinks-outdoors-6lkDaLeroEA" target="_blank" rel="noreferrer">Photo: Vitaly Gariev / Unsplash</a></figcaption>
            <div className="community-route-map" role="img" aria-label="A simple event flow: place, people, purpose, plan"><span>PLACE</span><i /><span>PEOPLE</span><i /><span>PURPOSE</span><i /><b>PLAN</b></div>
          </figure>
          <span className="community-ring" aria-hidden="true">✳</span>
        </section>

        <section className="purpose-section" aria-labelledby="purpose-title">
          <div className="purpose-aside"><span>01</span><span>THE REASON</span><i /></div>
          <div className="purpose-main"><p className="eyebrow eyebrow-dark">START WITH THE PEOPLE, NOT THE PAPERWORK</p><h2 id="purpose-title">Who is it for?<br /><span>What should they leave with?</span></h2></div>
          <p className="purpose-copy">Purpose helps set the format, time, place and amount of coordination. A small meet-up shouldn’t inherit a festival-sized task list.</p>
        </section>

        <section className="run-sheet-section" aria-labelledby="runsheet-title">
          <div className="run-sheet-intro"><p className="eyebrow eyebrow-dark">THE DAY, IN HUMAN HANDS</p><h2 id="runsheet-title">Every moving piece<br />needs a <span>person.</span></h2><p>Assign an owner, handoff time and backup. Put setup, welcome, the main moment, cleanup and follow-up on the same run sheet.</p><Link className="text-arrow" href="/planner/community">Build a run sheet in your plan <ArrowRight size={16} /></Link></div>
          <div className="run-sheet">
            <div className="run-sheet-header"><span>RUN OF SHOW</span><span>OWNER · TIME · BACKUP</span></div>
            {run.map((item) => <article key={item.label}><span className="run-time">{item.label}</span><span className="run-icon">{item.icon}</span><div><h3>{item.title}</h3><p>{item.copy}</p></div></article>)}
            <p className="run-sheet-note">Example flow only. Scale, timing and roles depend on your actual event.</p>
          </div>
        </section>

        <section className="community-contingency" aria-labelledby="contingency-title">
          <div className="contingency-mark"><CloudSun size={24} /></div><div><p className="eyebrow">OUTDOORS? MAKE THE PLAN FLEX.</p><h2 id="contingency-title">Decide who calls it<br /><span>before the weather does.</span></h2></div><p>Name a decision owner, local weather source, shelter or alternate site and attendee message route. Check capacity, access and emergency movement with the venue or authority responsible.</p>
        </section>

        <section className="community-welcome" aria-labelledby="welcome-title">
          <div className="welcome-photo" role="img" aria-label="Friends enjoying an outdoor picnic"><span>MAKE THE WAY IN CLEAR</span></div>
          <div><p className="eyebrow eyebrow-dark"><Accessibility size={15} /> A GATHERING PEOPLE CAN JOIN</p><h2 id="welcome-title">Welcome starts<br /><span>before arrival.</span></h2><p>Share directions, transit and drop-off, access information, seating and restrooms. If serving food, assign someone to confirm ingredients and handling with the provider. Check local rules for your place and activity.</p></div>
        </section>

        <section className="fundraising-note"><div><p className="eyebrow eyebrow-dark">IF THE GATHERING RAISES FUNDS</p><h2>Keep money in<br /><span>separate columns.</span></h2></div><p>The current register tracks expenses. Keep tickets, donations, sponsorship, in-kind support and fees in your organization’s own records; reconcile the totals with whoever manages the funds.</p></section>

        <section className="event-cta community-cta"><p className="eyebrow">A GATHERING IS A TEAM EFFORT</p><h2>Make the next step<br />easy to share.</h2><p>This is a draft to help coordinate—not a permit, safety approval, or substitute for local guidance.</p><Link className="button button-light" href="/planner/community">Build the first draft <ArrowRight size={16} /></Link></section>
      </main>
      <SiteFooter />
    </div>
  );
}

