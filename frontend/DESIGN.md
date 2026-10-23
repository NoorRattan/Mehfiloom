# Mehfiloom frontend

The direction is a contemporary celebration journal: warm paper, editorial serif typography, restrained motion, authentic photography, and generous space. It avoids invented testimonials and popularity counts.

## Research

- [Stripe Sessions](https://stripe.com/sessions/2025): reviewed event storytelling, clear hierarchy, and the progression from inspiration to a concrete next action.
- [Joy’s wedding planning checklist](https://withjoy.com/blog/wp-content/uploads/2024/03/wedding-planning-checklist-revamp.pdf): reviewed the sequencing of budgets, dates, venues, guest lists, invitations, and vendor confirmations.
- [React Three Fiber performance guidance](https://r3f.docs.pmnd.rs/advanced/scaling-performance): informed viewport-based loading, adaptive rendering resolution, restrained geometry, and fallbacks.
- Next.js 16.4.2 documentation bundled with this checkout: checked routing, Server/Client Component boundaries, and Tailwind integration.

## Separate experiences

| Event     | Inspiration  | Organizer             | Assistant           | Identity                                                       |
| --------- | ------------ | --------------------- | ------------------- | -------------------------------------------------------------- |
| Wedding   | `/wedding`   | `/wedding/organize`   | `/wedding/assist`   | Burgundy, parchment, tall romantic arches, Instrument Serif    |
| Birthday  | `/birthday`  | `/birthday/organize`  | `/birthday/assist`  | Lilac, citron, oversized sans typography, offset print shadows |
| Community | `/community` | `/community/organize` | `/community/assist` | Olive, forest, open compositions, sunlit photography           |

The landing pages have separate compositions. Workspaces share typed behavior and accessible controls while retaining each event’s palette, wording, priorities, visual details, and independent storage key.

## Behavior

- Browser-local drafts use the versioned `mehfiloom:v2:<event>` key. No account or shared database is implied.
- Storage is schema-checked; incomplete form drafts are supported. Storage failures fall back to tab memory.
- Starter budgets use the existing deterministic planning templates and are explicitly labelled. AI results come from the real `/api/generate` endpoint, with visible errors and request timeouts.
- Follow-up prompts use the backend’s revision request contract. Results feed the matching organizer’s timeline, budget, vendor checklist, and ideas.
- Text exports contain event details, task status, vendor notes, allocations, and ideas.
- Motion uses Framer Motion for reveals, GSAP for pointer interactions, and Lenis for smooth scrolling. Reduced-motion preferences disable decorative movement.
- The sculpture loads only on desktop when near the viewport, uses PBR materials and procedural HDR environment lighting, adapts pixel ratio, and falls back to the brand flower when WebGL is unavailable.

## Assets

Fonts are served locally: DM Sans and Instrument Serif from Google Fonts. Photographs are served locally from Unsplash image assets `photo-1519225421980-715cb0215aed`, `photo-1530103862676-de8c9debad1d`, `photo-1511632765486-a01980e01a18`, and `photo-1478146896981-b80fe463b330`.

No Lighthouse score is asserted without a measured production audit.
