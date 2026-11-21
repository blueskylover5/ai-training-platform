/*
 * What the home page shows (19 November 2026). Images live in /public/images; while a `src` is
 * null, a coloured panel stands in. The photos are CC0 or public domain; where each one comes from
 * is in docs/image-credits.md.
 * Recommended sizes: hero backgrounds 2400 × 1350 (16:9, landscape, JPG), challenge photos
 * 1200 × 900 (4:3), platform logos as SVG or PNG about 240 × 80 on a transparent background.
 */

export interface HeroBackground {
  /** For example "/images/hero/hero-1.jpg"; null shows the coloured panel. */
  src: string | null;
  /** The panel's gradient while there is no photo (Tailwind classes). */
  panel: string;
}

/**
 * The hero's background slideshow: the photos fade into one another behind the headline. They are
 * decoration (the headline says it all), so they have no descriptions. A dark layer on top keeps
 * the white text readable over any photo.
 */
export const heroBackgrounds: HeroBackground[] = [
  // A team working through a problem together, someone back on track, someone working calmly.
  { src: "/images/hero/hero-1.jpg", panel: "from-brand to-[#7c3aed]" },
  { src: "/images/hero/hero-2.jpg", panel: "from-[#0e7490] to-brand" },
  { src: "/images/hero/hero-3.jpg", panel: "from-[#b45309] to-[#be185d]" },
];

export interface Challenge {
  key: string;
  /** For example "/images/challenges/rejected.jpg"; null shows the coloured panel with the emoji. */
  src: string | null;
  alt: string;
  /** Which part of the photo to keep when the card crops it (CSS object-position); centre by default. */
  position?: string;
  emoji: string;
  title: string;
  text: string;
}

/** "Are you facing these challenges?": one photo of someone struggling per challenge. */
export const challenges: Challenge[] = [
  {
    key: "rejected",
    src: "/images/challenges/rejected.jpg",
    alt: "A man at a laptop, holding his head in frustration.",
    emoji: "🙅",
    title: "Your tasks keep getting rejected",
    text: "Reviewers call your work “too easy”, “low effort” or “not challenging enough”, and you can’t tell what they want.",
  },
  {
    key: "assessment",
    src: "/images/challenges/assessment.jpg",
    alt: "A woman at a laptop with her hand on her head, worried.",
    emoji: "📝",
    title: "You can’t pass the assessment",
    text: "You failed the qualification test, and there may be only one try left.",
  },
  {
    key: "stump",
    src: "/images/challenges/stump.jpg",
    alt: "A man at his desk late at night, head in his hand, in front of an AI assistant on screen.",
    emoji: "🤖",
    title: "The model solves everything you write",
    text: "Your problems have to defeat models like Gemini, but they keep getting the answer right.",
  },
  {
    key: "no-work",
    src: "/images/challenges/no-work.jpg",
    alt: "A woman resting her chin on her hand, waiting in front of her laptop.",
    emoji: "📭",
    title: "No tasks after onboarding",
    text: "You were accepted, but your dashboard has been empty for weeks.",
  },
  {
    key: "quality",
    src: "/images/challenges/quality.jpg",
    alt: "A stressed woman with both hands on her head.",
    position: "center 20%",
    emoji: "📉",
    title: "Your quality score keeps dropping",
    text: "Warnings, lower scores, or the risk of being removed from a project you like.",
  },
  {
    key: "field",
    src: "/images/challenges/field.jpg",
    alt: "A man at a laptop, hand over his mouth, unsure what to do next.",
    emoji: "🎓",
    title: "Your expertise isn’t paying off",
    text: "You’re a nurse, lawyer, engineer or teacher, but can’t find the projects that need your field.",
  },
];

export interface PlatformMark {
  name: string;
  /**
   * The platform's own site icon (the one browsers show in the tab), redrawn as a 128 × 128 PNG; null
   * shows the first letter instead. Shown beside the name.
   */
  logo: string | null;
}

/**
 * Platforms we help with. Names and logos belong to their owners; showing them doesn't mean they
 * endorse us. No links: we never link to hiring platforms directly (AITraining.jobs agreement).
 */
export const platforms: PlatformMark[] = [
  { name: "AfterQuery", logo: "/images/platforms/afterquery.png" },
  { name: "Handshake", logo: "/images/platforms/handshake.png" },
  { name: "Alignedhq", logo: "/images/platforms/alignedhq.png" },
  { name: "Alignerr", logo: "/images/platforms/alignerr.png" },
  { name: "Outlier", logo: "/images/platforms/outlier.png" },
  { name: "Mercor", logo: "/images/platforms/mercor.png" },
  { name: "micro1", logo: "/images/platforms/micro1.png" },
  { name: "DataAnnotation", logo: "/images/platforms/dataannotation.png" },
  { name: "Turing", logo: "/images/platforms/turing.png" },
  { name: "Invisible", logo: "/images/platforms/invisible.png" },
  { name: "Prolific", logo: "/images/platforms/prolific.png" },
  { name: "Welo Data", logo: "/images/platforms/welo-data.png" },
];

/**
 * The platforms the home page hero names when it asks visitors whether they work on any of them
 * (owner's request, 21 November 2026). Each must be in `platforms`, which supplies its logo.
 */
export const heroPlatformNames = ["AfterQuery", "Outlier", "Handshake", "DataAnnotation"] as const;
