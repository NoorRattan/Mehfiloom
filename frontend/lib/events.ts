import type { EventBrief, EventType } from "@/lib/planner";

export type EventKind = EventType;
export const eventKinds: EventKind[] = ["wedding", "birthday", "community"];
export const events = {
  wedding: {
    label: "Weddings",
    singular: "wedding",
    chapter: "01",
    subtitle: "FOR THE TWO OF YOU",
    title: "A day that feels like you.",
    image: "/images/wedding.jpg",
    description:
      "The big yes. The little details. A celebration of your story, thoughtfully brought together.",
    organizerTitle: "Your forever starts here.",
    assistantTitle: "Consider me your something helpful.",
    assistantIntro:
      "From the first moodboard to the last dance, let’s make a day that feels entirely yours.",
    prompts: [
      "Plan an intimate garden wedding",
      "Help me make the most of my budget",
      "Find meaningful, personal touches",
    ],
    tasks: [
      "Choose your date and guest count",
      "Set your priorities and budget",
      "Shortlist your ceremony and reception venues",
      "Reach out to a photographer",
      "Plan the menu and dietary options",
      "Send invitations and track RSVPs",
    ],
    vendors: [
      "Venue & ceremony",
      "Catering & drinks",
      "Photography & film",
      "Florals & styling",
    ],
    styles: ["Garden romance", "Modern heirloom", "Intimate & understated"],
    budget: "250000",
    guests: 120,
  },
  birthday: {
    label: "Birthdays",
    singular: "birthday",
    chapter: "02",
    subtitle: "ANOTHER TRIP AROUND THE SUN",
    title: "Big wishes. Better parties.",
    image: "/images/birthday.jpg",
    description:
      "For the big milestones, the small circles, and the just-because-you-deserve-it kind of days.",
    organizerTitle: "Let’s get this party started.",
    assistantTitle: "Your partner in party.",
    assistantIntro:
      "A brilliant theme, a cake worth talking about, a party that’s so them. Let’s dream it up.",
    prompts: [
      "Dream up a birthday with a twist",
      "Plan a great party on a small budget",
      "Create a relaxed party timeline",
    ],
    tasks: [
      "Choose a date and guest list",
      "Pick a theme the honoree loves",
      "Find a space for the celebration",
      "Arrange the cake and refreshments",
      "Plan activities and a playlist",
      "Send the invites",
    ],
    vendors: [
      "Party space",
      "Cake & treats",
      "Decor & balloons",
      "Music & activities",
    ],
    styles: ["Disco after dark", "Picnic & cake", "Colour outside the lines"],
    budget: "30000",
    guests: 20,
  },
  community: {
    label: "Community",
    singular: "community gathering",
    chapter: "03",
    subtitle: "GOOD PEOPLE. COMMON GROUND.",
    title: "Together is a good place to be.",
    image: "/images/community.jpg",
    description:
      "A neighbourhood table. A shared cause. Something wonderful happens when people come together.",
    organizerTitle: "Good things grow together.",
    assistantTitle: "A helping hand for your gathering.",
    assistantIntro:
      "Let’s turn a shared idea into a welcoming gathering, with space for everyone to belong.",
    prompts: [
      "Plan a neighbourhood get-together",
      "Help organise volunteers and roles",
      "Make our event more inclusive",
    ],
    tasks: [
      "Define the gathering’s purpose",
      "Choose an accessible location",
      "Set a shared budget",
      "Assign volunteer roles",
      "Arrange food and a weather backup",
      "Share the invitation with the community",
    ],
    vendors: [
      "Venue & permissions",
      "Food & refreshments",
      "Equipment & facilities",
      "Access & transport",
    ],
    styles: ["The long table", "Local makers’ market", "A day in the park"],
    budget: "100000",
    guests: 100,
  },
} as const;

export function newBrief(kind: EventKind): EventBrief {
  return {
    eventType: kind,
    eventName: "",
    location: "",
    eventDate: "",
    timeZone: null,
    eventTime: "",
    eventTimeOccurrence: null,
    sessions: [],
    guestCount: events[kind].guests,
    budgetAmount: events[kind].budget,
    currency: "INR",
    style: "",
    mustHaves: "",
  };
}

const moneyFormatters = new Map<string, Intl.NumberFormat>();
const MAX_MONEY_FORMATTERS = 16;

export function money(minor: number, currency = "INR") {
  const normalized = currency.trim().toUpperCase();
  let formatter = moneyFormatters.get(normalized);
  if (!formatter) {
    formatter = new Intl.NumberFormat(normalized === "INR" ? "en-IN" : "en", {
      style: "currency",
      currency: normalized,
      minimumFractionDigits: 0,
    });
    if (moneyFormatters.size >= MAX_MONEY_FORMATTERS) {
      moneyFormatters.delete(moneyFormatters.keys().next().value!);
    }
    moneyFormatters.set(normalized, formatter);
  }
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(minor / 10 ** digits);
}
