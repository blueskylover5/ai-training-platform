/*
 * What the home page shows (19 November 2026). Images live in /public/images; while a `src` is
 * null, a coloured panel stands in, so the owner's photos can drop in without layout changes.
 * Recommended sizes: hero slides 1600 × 1200 (4:3), challenge photos 1200 × 900 (4:3), platform
 * logos as SVG or PNG about 240 × 80 on a transparent background.
 */

export interface HeroSlide {
  /** For example "/images/hero/slide-1.jpg"; null shows the coloured panel. */
  src: string | null;
  /** Describes the photo for people who can't see it. */
  alt: string;
  title: string;
  text: string;
  /** The panel's gradient while there is no photo (Tailwind classes). */
  panel: string;
}

export const heroSlides: HeroSlide[] = [
  {
    src: null,
    alt: "Someone reading reviewer feedback on a laptop, relieved.",
    title: "From “too simple” to accepted",
    text: "Find out what reviewers actually look for.",
    panel: "from-brand to-[#7c3aed]",
  },
  {
    src: null,
    alt: "Someone at a desk, passing an online assessment.",
    title: "From failed attempt to passed",
    text: "See where your attempts go wrong, and fix it.",
    panel: "from-[#0e7490] to-brand",
  },
  {
    src: null,
    alt: "Someone smiling at a laptop after finishing a hard task.",
    title: "From stuck to earning again",
    text: "Step-by-step help until it's solved.",
    panel: "from-[#b45309] to-[#be185d]",
  },
];

export interface Challenge {
  key: string;
  /** For example "/images/challenges/rejected.jpg"; null shows the coloured panel with the emoji. */
  src: string | null;
  alt: string;
  emoji: string;
  title: string;
  text: string;
}

/** "Are you facing these challenges?": one photo of someone struggling per challenge. */
export const challenges: Challenge[] = [
  {
    key: "rejected",
    src: null,
    alt: "A frustrated person looking at a rejected task on a laptop.",
    emoji: "🙅",
    title: "Your tasks keep getting rejected",
    text: "Reviewers call your work “too simple”, “low effort” or “not challenging enough”, and you can’t tell what they want.",
  },
  {
    key: "assessment",
    src: null,
    alt: "A worried person staring at a failed test result.",
    emoji: "📝",
    title: "You can’t pass the assessment",
    text: "You failed the qualification test or “Attempt 2”, and there may be only one try left.",
  },
  {
    key: "stump",
    src: null,
    alt: "A person with their head in their hands next to a chat with an AI model.",
    emoji: "🤖",
    title: "The model solves everything you write",
    text: "Your problems have to defeat models like Gemini, but they keep getting the answer right.",
  },
  {
    key: "no-work",
    src: null,
    alt: "A person looking at an empty task dashboard.",
    emoji: "📭",
    title: "No tasks after onboarding",
    text: "You were accepted, but your dashboard has been empty for weeks.",
  },
  {
    key: "quality",
    src: null,
    alt: "A stressed person reading a warning email about quality scores.",
    emoji: "📉",
    title: "Your quality score keeps dropping",
    text: "Warnings, lower scores, or the risk of being removed from a project you like.",
  },
  {
    key: "field",
    src: null,
    alt: "A professional unsure which AI training project fits their field.",
    emoji: "🎓",
    title: "Your expertise isn’t paying off",
    text: "You’re a nurse, lawyer, engineer or teacher, but can’t find the projects that need your field.",
  },
];

export interface PlatformMark {
  name: string;
  /** For example "/images/platforms/afterquery.svg"; null shows the name as a styled badge. */
  logo: string | null;
}

/**
 * Platforms we help with. Names and logos belong to their owners; showing them doesn't mean they
 * endorse us. No links: we never link to hiring platforms directly (AITraining.jobs agreement).
 */
export const platforms: PlatformMark[] = [
  { name: "Afterquery", logo: null },
  { name: "Handshake", logo: null },
  { name: "Alignedhq", logo: null },
  { name: "Alignerr", logo: null },
  { name: "Outlier", logo: null },
  { name: "Mercor", logo: null },
  { name: "micro1", logo: null },
  { name: "DataAnnotation", logo: null },
  { name: "Turing", logo: null },
  { name: "Invisible", logo: null },
  { name: "Prolific", logo: null },
  { name: "Welo Data", logo: null },
];
