import type { EventBrief, EventType, PlannerProposal } from "./planner.ts";

export const EXAMPLE_BRIEF: EventBrief = {
  eventType: "wedding",
  eventName: "A spring wedding",
  location: "Jaipur, India",
  eventDate: "2027-02-14",
  timeZone: null,
  eventTime: "",
  eventTimeOccurrence: null,
  guestCount: 120,
  sessions: [],
  budgetAmount: "250000",
  currency: "INR",
  style: "Warm, relaxed, and intimate, with room for both families to mingle.",
  mustHaves:
    "Vegetarian meal options, step-free access, and an indoor weather backup.",
};

export const EXAMPLE_PROPOSAL: PlannerProposal = {
  conceptTitle: "A garden gathering with a family-table heart",
  overview:
    "Build the day around a welcoming shared meal, gentle florals, and unhurried time together. Keep the guest route step-free and confirm an indoor alternative before any outdoor booking.",
  theme:
    "Soft garden colors, handmade details, and an easy flow between moments.",
  budgetAllocations: [
    {
      category: "venue",
      weight: 24,
      rationale: "Protect a comfortable gathering space and a weather backup.",
    },
    {
      category: "food",
      weight: 28,
      rationale: "Prioritize the shared meal and clear vegetarian choices.",
    },
    {
      category: "decor",
      weight: 10,
      rationale: "Use a few personal details instead of broad room coverage.",
    },
    {
      category: "photography",
      weight: 9,
      rationale: "Keep a focused record of the day and family moments.",
    },
    {
      category: "entertainment",
      weight: 7,
      rationale: "Leave room for music that suits the group's energy.",
    },
    {
      category: "accessibility",
      weight: 7,
      rationale: "Plan step-free movement and guest comfort from the start.",
    },
    {
      category: "logistics",
      weight: 7,
      rationale: "Cover setup, transport, and coordination needs.",
    },
    {
      category: "contingency",
      weight: 8,
      rationale: "Keep a host-controlled reserve for unresolved costs.",
    },
  ],
  timeline: [
    {
      task: "Confirm the event date, guest range, and non-negotiable needs",
      timing: "First planning session",
      priority: "high",
    },
    {
      task: "Shortlist venues and verify step-free access plus indoor backup",
      timing: "As early as possible",
      priority: "high",
    },
    {
      task: "Ask caterers for vegetarian menus, inclusions, and minimums",
      timing: "After venue shortlist",
      priority: "high",
    },
    {
      task: "Choose a simple decor direction and reuse-friendly materials",
      timing: "Once venue is known",
      priority: "medium",
    },
    {
      task: "Confirm music, photography, and setup responsibilities",
      timing: "Before invitations are finalized",
      priority: "medium",
    },
    {
      task: "Recheck guest count, access route, weather plan, and final balances",
      timing: "One week before",
      priority: "high",
    },
  ],
  vendorChecklist: [
    {
      category: "Venue",
      questions: [
        "Is step-free access available for the full guest route?",
        "What is included in the hire and what costs extra?",
        "What indoor option is available if the weather changes?",
      ],
    },
    {
      category: "Catering",
      questions: [
        "Can you share vegetarian menu choices and allergen handling?",
        "What guest minimum, service, and setup fees apply?",
        "When does the final headcount need to be confirmed?",
      ],
    },
    {
      category: "Photography",
      questions: [
        "Which hours and deliverables are included?",
        "Are travel, overtime, or editing fees separate?",
        "When should we expect the finished images?",
      ],
    },
  ],
  ideas: [
    {
      title: "Family recipe cards",
      whyItFits:
        "Invite each side to share one dish or food memory for the table.",
      costNote:
        "Low-material idea; printing and translation needs are not priced.",
    },
    {
      title: "Quiet welcome corner",
      whyItFits:
        "A calmer seating area can make arrivals easier for guests who need a pause.",
      costNote: "Space and seating are required; venue suitability is unknown.",
    },
    {
      title: "Reusable table details",
      whyItFits:
        "A few borrowed or reusable pieces keep the garden feel personal and reduce single-use decor.",
      costNote: "Availability and any rental costs need local quotes.",
    },
  ],
  openQuestions: [
    "Does the budget include outfits, travel, and any pre-event gatherings?",
    "Are there dietary, language, cultural, religious, or tradition-specific preferences to include or avoid?",
  ],
  assumptions: [
    "The attendance figure is an early planning estimate and may change.",
    "No venue, vendor availability, or local price has been verified, and no cultural or religious practice has been inferred.",
    "Timeline suggestions are starting points; adjust them to the confirmed date, event scale, and local availability.",
  ],
};

const BIRTHDAY_TEMPLATE: PlannerProposal = {
  conceptTitle: "A birthday gathering shaped around the guest of honor",
  overview:
    "Build the celebration around the honoree’s stated interests, with a clear choice about whether the gathering is a surprise. Keep activities optional, check food and access needs with the host, and confirm age or venue restrictions only when they apply.",
  theme:
    "Personal details, flexible activities, and an easy welcome for every guest.",
  budgetAllocations: [
    {
      category: "venue",
      weight: 18,
      rationale:
        "Choose a space that suits the activity, guest count, access needs, and weather plan.",
    },
    {
      category: "food",
      weight: 22,
      rationale:
        "Cover the meal, drinks, dessert, dietary needs, and any service charges.",
    },
    {
      category: "decor",
      weight: 8,
      rationale:
        "Use a few personal details without assuming a particular age or style.",
    },
    {
      category: "photography",
      weight: 7,
      rationale:
        "Set aside room for photos only if the honoree and host want them.",
    },
    {
      category: "entertainment",
      weight: 13,
      rationale:
        "Match optional activities to interests and confirm any age or access limits.",
    },
    {
      category: "accessibility",
      weight: 8,
      rationale:
        "Plan step-free movement, seating, sensory comfort, and clear event information.",
    },
    {
      category: "logistics",
      weight: 12,
      rationale:
        "Allow for setup, invitations, supplies, cleanup, and transport where needed.",
    },
    {
      category: "contingency",
      weight: 12,
      rationale:
        "Keep a host-controlled reserve for unresolved fees or last-minute changes.",
    },
  ],
  timeline: [
    {
      task: "Ask the honoree or host what kind of gathering they want and whether it is a surprise",
      timing: "First planning conversation; adapt to the honoree's preference",
      priority: "high",
    },
    {
      task: "Set a guest range, activity direction, and spending cap",
      timing: "About 6–8 weeks before; shorten or extend to fit the plan",
      priority: "high",
    },
    {
      task: "Compare venues or activity providers for capacity, access, restrictions, and total fees",
      timing: "About 4–6 weeks before, before paying a deposit",
      priority: "high",
    },
    {
      task: "Confirm food, dessert, dietary information, and any age or ingredient requirements",
      timing: "About 3–4 weeks before; confirm final counts with providers",
      priority: "high",
    },
    {
      task: "Send invitations with location, access details, RSVP date, and whether the event is a surprise",
      timing: "About 2–4 weeks before, as appropriate for the guest group",
      priority: "medium",
    },
    {
      task: "Reconfirm attendance, activity supplies, setup help, and a quieter seating option",
      timing: "About 1 week before",
      priority: "medium",
    },
    {
      task: "Check deliveries, access route, weather backup, and cleanup roles",
      timing: "1–2 days before",
      priority: "high",
    },
  ],
  vendorChecklist: [
    {
      category: "Venue or activity provider",
      questions: [
        "What capacity, age restrictions, and activity rules apply?",
        "Is the full guest route step-free, and what seating or quiet space is available?",
        "What is included in the price, and which deposits, fees, or cancellation terms apply?",
      ],
    },
    {
      category: "Cake or dessert provider",
      questions: [
        "Can you accommodate the host's stated dietary and allergen requirements?",
        "What are the size, serving, delivery, and storage details?",
        "What is the full price, including changes or delivery?",
      ],
    },
    {
      category: "Food and beverage provider",
      questions: [
        "What menu options and allergen controls can you confirm in writing?",
        "Are service, setup, equipment, and cleanup included?",
        "When is the final guest count due, and what happens if it changes?",
      ],
    },
    {
      category: "Entertainment or activity provider",
      questions: [
        "What age, mobility, sensory, or participation limits should the host know?",
        "Can guests opt out or take a quieter break without missing essential parts?",
        "What equipment, setup time, travel fees, and backup arrangements are included?",
      ],
    },
  ],
  ideas: [
    {
      title: "Honoree-led activity menu",
      whyItFits:
        "Offer two or three optional activities based on interests the honoree has actually shared.",
      costNote:
        "Cost depends on the chosen supplies or provider; check before committing.",
    },
    {
      title: "Message and memory table",
      whyItFits:
        "Give guests a low-pressure way to leave a note, drawing, or shared memory.",
      costNote:
        "Usually needs basic materials; printing, translation, and setup are unpriced.",
    },
    {
      title: "Flexible welcome and quiet corner",
      whyItFits:
        "A clear arrival point and calmer seating can help guests take part at their own pace.",
      costNote:
        "Requires suitable space and seating; confirm venue access and any rental fee.",
    },
  ],
  openQuestions: [
    "What does the honoree enjoy, and do they want a surprise or a say in the plan?",
    "Are there age, dietary, sensory, mobility, language, cultural, or religious preferences the host wants included or avoided?",
  ],
  assumptions: [
    "The guest count is a planning estimate and the host will confirm it.",
    "No age, surprise format, tradition, vendor, availability, or local price has been assumed or verified.",
    "Timeline suggestions are starting points; adjust them to the confirmed date, event scale, and local availability.",
  ],
};

const COMMUNITY_TEMPLATE: PlannerProposal = {
  conceptTitle: "A community gathering built for shared participation",
  overview:
    "Start with the organizers’ purpose, who the gathering should serve, and how people can take part. Assign clear roles, verify permission and local requirements with the relevant venue or authority, and make access, weather, sanitation, and cleanup part of the first plan.",
  theme:
    "A welcoming, practical gathering shaped by local organizers and attendees.",
  budgetAllocations: [
    {
      category: "venue",
      weight: 20,
      rationale:
        "Cover space, capacity, setup access, and any required site charges.",
    },
    {
      category: "food",
      weight: 18,
      rationale:
        "Plan refreshments with dietary information, service needs, and cleanup in view.",
    },
    {
      category: "entertainment",
      weight: 10,
      rationale:
        "Support programming chosen by organizers and suitable for the setting.",
    },
    {
      category: "accessibility",
      weight: 12,
      rationale:
        "Plan accessible routes, seating, facilities, communication, and participation options.",
    },
    {
      category: "logistics",
      weight: 20,
      rationale:
        "Cover staffing, equipment, signage, waste, sanitation, transport, and site operations.",
    },
    {
      category: "decor",
      weight: 5,
      rationale:
        "Keep signage and shared-space details useful, reusable, and within site rules.",
    },
    {
      category: "photography",
      weight: 3,
      rationale:
        "Reserve funds only if documentation is wanted and consent can be handled.",
    },
    {
      category: "contingency",
      weight: 12,
      rationale:
        "Keep a host-controlled reserve for weather, access, or site-cost changes.",
    },
  ],
  timeline: [
    {
      task: "Agree the gathering's purpose, intended attendees, organizer roles, and decision owner",
      timing: "About 8–12 weeks before; adjust for scale and local process",
      priority: "high",
    },
    {
      task: "Estimate attendance and shortlist spaces; verify capacity, permission, access, and facilities",
      timing: "About 8–10 weeks before and before announcing a location",
      priority: "high",
    },
    {
      task: "Check relevant local requirements directly with the venue or responsible authority",
      timing: "As early as possible; requirements vary by place and event",
      priority: "high",
    },
    {
      task: "Set a volunteer, safety, weather, sanitation, waste, and incident-response plan",
      timing: "About 4–6 weeks before; assign named organizer roles",
      priority: "high",
    },
    {
      task: "Confirm program, sound or equipment needs, food service, and access information",
      timing: "About 3–4 weeks before",
      priority: "medium",
    },
    {
      task: "Share attendee information, arrival options, access details, and a contact route",
      timing: "About 1–2 weeks before; update if plans change",
      priority: "medium",
    },
    {
      task: "Walk the site, brief volunteers, check weather alternatives, and assign cleanup",
      timing: "About 1 week before and again at setup",
      priority: "high",
    },
  ],
  vendorChecklist: [
    {
      category: "Venue or public-space contact",
      questions: [
        "Who can confirm permission, capacity, access hours, and applicable site conditions?",
        "Are step-free routes, accessible facilities, seating, shade, and quiet space available?",
        "Which charges, deposits, insurance, cleanup, or cancellation conditions need written confirmation?",
      ],
    },
    {
      category: "Food service provider",
      questions: [
        "How will dietary and allergen information be collected and communicated?",
        "What are the serving, handwashing, water, waste, and cleanup arrangements?",
        "What minimums, staffing, equipment, fees, and final-count rules apply?",
      ],
    },
    {
      category: "Sound or equipment provider",
      questions: [
        "What equipment, power, setup access, and operator time are included?",
        "Can sound levels, placement, and communication needs work for the site and attendees?",
        "What are the full fees, site restrictions, and backup arrangements?",
      ],
    },
    {
      category: "Accessibility support or equipment",
      questions: [
        "Which attendee needs can the equipment or service address, and what remains out of scope?",
        "Can the full route and setup be checked with the venue before the event?",
        "What delivery, staffing, maintenance, and removal costs apply?",
      ],
    },
  ],
  ideas: [
    {
      title: "Organizer-led welcome board",
      whyItFits:
        "Show the purpose, schedule, access information, and a contact point in one easy-to-find place.",
      costNote:
        "Printing and weatherproofing may add cost; language choices should come from organizers.",
    },
    {
      title: "Shared skills or resource exchange",
      whyItFits:
        "Invite attendees to contribute an optional skill, resource, or local knowledge chosen by the group.",
      costNote:
        "Can be low-cost; confirm space, materials, moderation, and participation needs.",
    },
    {
      title: "Reusable service and cleanup station",
      whyItFits:
        "Make water, waste sorting, and reusable serving options visible and assign an organizer to maintain them.",
      costNote:
        "Depends on site facilities and rental availability; verify any local waste rules directly.",
    },
  ],
  openQuestions: [
    "What purpose, attendee groups, organizer roles, and decisions define success for this gathering?",
    "Which cultural, religious, language, access, safety, or local-process preferences have organizers confirmed?",
  ],
  assumptions: [
    "Attendance and organizer capacity are estimates until the host confirms them.",
    "No permission, local requirement, vendor, price, tradition, or attendee preference has been verified or inferred.",
    "Timeline suggestions are starting points; adjust them to the confirmed date, scale, local availability, and applicable requirements.",
  ],
};

export const EVENT_TEMPLATE_PROPOSALS: Record<EventType, PlannerProposal> = {
  wedding: EXAMPLE_PROPOSAL,
  birthday: BIRTHDAY_TEMPLATE,
  community: COMMUNITY_TEMPLATE,
};

export function getEventTemplateProposal(
  eventType: EventType,
): PlannerProposal {
  // Return a fresh object so callers can safely edit a local draft.
  return structuredClone(EVENT_TEMPLATE_PROPOSALS[eventType]);
}

export function exampleBriefForEvent(
  eventType: EventType,
  current: EventBrief = EXAMPLE_BRIEF,
): EventBrief {
  const examples: Record<
    EventType,
    Pick<EventBrief, "eventName" | "guestCount" | "style" | "mustHaves">
  > = {
    wedding: {
      eventName: "A spring wedding",
      guestCount: 120,
      style:
        "Warm, relaxed, and intimate, with room for both families to mingle.",
      mustHaves:
        "Vegetarian meal options, step-free access, and an indoor weather backup.",
    },
    birthday: {
      eventName: "A birthday gathering",
      guestCount: 40,
      style:
        "A relaxed gathering shaped around the honoree's stated interests, with activities optional.",
      mustHaves:
        "Ask about the honoree's preferences, dietary needs, step-free access, and a quieter space.",
    },
    community: {
      eventName: "A neighborhood gathering",
      guestCount: 100,
      style: "A welcoming event shaped by local organizers and attendee needs.",
      mustHaves:
        "Step-free access, clear event information, accessible facilities, and a weather contingency.",
    },
  };

  return { ...current, eventType, ...examples[eventType] };
}
