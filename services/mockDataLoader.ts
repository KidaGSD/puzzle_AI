/**
 * Mock Data Loader Service
 * Loads fragment data from MockupFragments directory for demo/testing
 */

import { Fragment, FragmentType } from "../domain/models";

// All available images in MockupFragments
const MOCK_IMAGES = [
  "1.png",
  "2.png",
  "3.png",
  "4.png",
  "5.png",
  "55.png",
  "555.png",
  "64343.png",
  "64533.png",
  "1794ed486688e5573fc69748a73c7377.jpg",
  "Agencity-Gestion-Hp-1.webp",
  "Frame 5.png",
  "a7d0ce0dca36dcbcbb06d3739a1f1aab.jpg",
  "c2624ed35c1a1466cc0488e11f917be7.jpg",
  "ddk5.png",
  "df4.png",
  "dfd.png",
  "dsr4rg.png",
  "resdss5.png",
  "sdfdlv.png",
  "sdffd4.png",
  "sdlfgfb.png",
  "sdr.png",
  "sfddfdf.png",
];

// Text fragments parsed from text_fragments.txt - separated by meaningful sections
const TEXT_FRAGMENT_SECTIONS = [
  {
    title: "User Keywords",
    content: `Many Flavors: Peach Matcha, orange matcha
Zero Cal
Xuan Paper
Asia Patterns
Uji Matcha
Store Vibe
Green cup with a lid`,
  },
  {
    title: "Matcha Characteristics",
    content: `Drink matcha to refresh but not as strong as coffee.
It isn't bitter.
It doesn't make your heart race.
It clears your mind just a little.
It tastes clean and smooth.
Its color is calming.
And it wakes you up without that electric jolt.`,
  },
  {
    title: "Matcha Background",
    content: `Matcha was first created by monks who needed to stay awake.
During the Song dynasty, Zen monks ground tea leaves into a fine powder and brought this practice to Japan, using it to remain clear-minded during long hours of meditation.
They called it the "Tea of Awakening."`,
  },
  {
    title: "Brand Vibe",
    content: `Approachable, fun, clean graphics, light weight feeling, happy`,
  },
  {
    title: "Brand Story Ideation",
    content: `The Tea of Gentle Awakening
Drinking matcha with friends (IP design)
Urban adults, 18 - 35 years old
Two friends and cat owners who bonded over loving drinks`,
  },
  {
    title: "Shapes & Visual Elements",
    content: `Circle, soft round rectangle, gradients`,
  },
  {
    title: "Article Reference",
    content: `Reviewed as "most sustainable matcha" in a recent ranking.
Branding leans modern, clean, green-focused, resonates with eco consumers.
For logo design, eco/modern brands often use sans-serif fonts, iconography of leaves, simplified symbols.`,
  },
  {
    title: "Competitor: Ippodo (Japan)",
    content: `A long-standing tea company based in Kyoto, established in 1717.
Positioned as high-quality, traditional, premium "ceremonial-style" matcha.
https://global.ippodo-tea.co.jp/`,
  },
  {
    title: "Competitor: Matchaful",
    content: `Reviewed as "most sustainable matcha" in a recent ranking.
Branding leans modern, clean, green-focused, resonates with eco/health consumers.
For logo design, eco/modern brands often use sans-serif fonts, iconography of leaves, simplified symbols.
Brand's value (eco, functional, premium) aligns visually.
https://www.matchaful.com/`,
  },
  {
    title: "Competitor: Rocky's Matcha",
    content: `Emerging brand (founded ~2022) emphasising aesthetic packaging and lifestyle marketing.
Packaging uses bold color (bright blue tin, neon green label) and branding aesthetics that appeal to younger, trend-driven consumers.
If your target is younger/lifestyle oriented (TikTok/Instagram), visual boldness helps.
https://www.rockysmatcha.com/`,
  },
  {
    title: "Project Brief",
    content: `Most Viral Matcha brand will be TikTok
Face to Gen Z
Take over the market of Redbull and Monster like Energy Drink`,
  },
  {
    title: "Reference Links",
    content: `https://daoinsights.com/works/heytea-a-stylish-tea-milk-and-master-of-co-branding/
https://design.museaward.com/winner-info.php?id=27204
https://usa.mollytea.com/about-us/
https://www.cytea.com/`,
  },
];

/**
 * Generate a simple UUID
 */
const generateId = (): string => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Shuffle array using Fisher-Yates algorithm
 */
const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Get random position within canvas bounds
 */
const getRandomPosition = (
  index: number,
  total: number,
  canvasWidth = 1200,
  canvasHeight = 800
): { x: number; y: number } => {
  // Create a grid-like distribution to prevent overlap
  const cols = Math.ceil(Math.sqrt(total));
  const rows = Math.ceil(total / cols);
  const col = index % cols;
  const row = Math.floor(index / cols);

  const cellWidth = canvasWidth / cols;
  const cellHeight = canvasHeight / rows;

  // Add some randomness within the cell
  const jitterX = (Math.random() - 0.5) * cellWidth * 0.5;
  const jitterY = (Math.random() - 0.5) * cellHeight * 0.5;

  return {
    x: Math.round(col * cellWidth + cellWidth / 2 + jitterX),
    y: Math.round(row * cellHeight + cellHeight / 2 + jitterY),
  };
};

/**
 * Get random image fragments
 * @param count Number of images to select (default: 6)
 * @param projectId Project ID for the fragments
 */
export const getRandomImageFragments = (
  count: number = 3, // Reduced from 6 to 3 for faster loading
  projectId: string
): Fragment[] => {
  const shuffled = shuffleArray(MOCK_IMAGES);
  const selected = shuffled.slice(0, Math.min(count, MOCK_IMAGES.length));

  return selected.map((filename, index) => ({
    id: generateId(),
    projectId,
    type: "IMAGE" as FragmentType,
    title: filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '), // Generate title from filename
    content: `/MockupFragments/${filename}`,
    position: getRandomPosition(index, count),
    size: { width: 200, height: 150 },
    labels: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));
};

/**
 * Get all text fragments from predefined sections
 * @param projectId Project ID for the fragments
 */
export const getTextFragments = (projectId: string): Fragment[] => {
  return TEXT_FRAGMENT_SECTIONS.map((section, index) => ({
    id: generateId(),
    projectId,
    type: "TEXT" as FragmentType,
    title: section.title, // Use section title as fragment title
    content: section.content, // Just the content without title embedded
    position: getRandomPosition(index, TEXT_FRAGMENT_SECTIONS.length, 1200, 800),
    size: { width: 280, height: 180 },
    labels: [],
    tags: [section.title.toLowerCase().replace(/\s+/g, "-")],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));
};

/**
 * Load all mock fragments (6 random images + all text fragments)
 * @param projectId Project ID for the fragments
 */
export const loadMockFragments = (projectId: string): Fragment[] => {
  // Reduced counts for faster initial loading
  const imageFragments = getRandomImageFragments(3, projectId);
  const textFragments = getTextFragments(projectId).slice(0, 5); // Only first 5 text fragments

  // Combine and redistribute positions
  const allFragments = [...imageFragments, ...textFragments];

  // Re-assign positions based on total count for better distribution
  return allFragments.map((fragment, index) => ({
    ...fragment,
    position: getRandomPosition(index, allFragments.length, 1400, 900),
  }));
};

/**
 * Default project configuration for matcha brand
 */
export const MATCHA_PROJECT = {
  id: "matcha-brand-project",
  title: "Matcha Brand Design",
  processAim:
    "Create the most viral matcha brand targeting Gen Z, competing with energy drinks like Redbull and Monster. Focus on TikTok-friendly aesthetics, approachable fun vibes, and the unique 'gentle awakening' story of matcha.",
};

/**
 * Get complete mock project store data
 */
export const getMockProjectData = () => {
  const fragments = loadMockFragments(MATCHA_PROJECT.id);

  return {
    project: MATCHA_PROJECT,
    fragments,
  };
};
