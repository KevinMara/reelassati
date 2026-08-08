import { getDb } from "../api/queries/connection";
import {
  templates,
  trendingContent,
  users,
  clients,
  scripts,
  contentLibrary,
  publishingSchedule,
  analytics,
} from "./schema";

async function seed() {
  const db = getDb();
  console.log("Seeding database...");

  // Seed templates
  const templateData = [
    {
      name: "Hook & Demo",
      description: "Grab attention in 1 second, demonstrate your product",
      type: "hook_demo" as const,
      niche: "ecommerce",
      structure: JSON.stringify({
        intro: "0-1s",
        hook: "1-3s",
        demo: "3-20s",
        cta: "20-30s",
      }),
      isSystem: true,
    },
    {
      name: "Wall of Text",
      description: "Text-heavy storytelling format",
      type: "wall_of_text" as const,
      niche: "education",
      structure: JSON.stringify({ text: "0-30s", background: "static" }),
      isSystem: true,
    },
    {
      name: "Slideshow Story",
      description: "Image carousel with voiceover",
      type: "slideshow" as const,
      niche: "lifestyle",
      structure: JSON.stringify({ slides: 5, duration: 30 }),
      isSystem: true,
    },
    {
      name: "Green Screen Meme",
      description: "React to trending content",
      type: "green_screen" as const,
      niche: "entertainment",
      structure: JSON.stringify({ reaction: "0-30s", original: "overlay" }),
      isSystem: true,
    },
    {
      name: "UGC Testimonial",
      description: "Authentic user-style review",
      type: "ugc" as const,
      niche: "beauty",
      structure: JSON.stringify({
        intro: "0-3s",
        review: "3-25s",
        cta: "25-30s",
      }),
      isSystem: true,
    },
    {
      name: "Trending Meme",
      description: "Jump on viral meme formats",
      type: "meme" as const,
      niche: "general",
      structure: JSON.stringify({ meme: "0-15s", branding: "15-30s" }),
      isSystem: true,
    },
    {
      name: "Product Showcase",
      description: "Cinematic product reveal",
      type: "reel" as const,
      niche: "fashion",
      structure: JSON.stringify({
        teaser: "0-5s",
        reveal: "5-20s",
        details: "20-30s",
      }),
      isSystem: true,
    },
    {
      name: "Day in the Life",
      description: "Behind-the-scenes content",
      type: "short" as const,
      niche: "personal_brand",
      structure: JSON.stringify({
        morning: "0-10s",
        work: "10-20s",
        evening: "20-30s",
      }),
      isSystem: true,
    },
  ];

  for (const t of templateData) {
    await db.insert(templates).values(t);
  }
  console.log("Templates seeded");

  // Seed trending content
  const trendingData = [
    {
      platform: "tiktok" as const,
      creator: "@viralcreator",
      niche: "fitness",
      format: "hook_demo" as const,
      hook: "This one exercise changed my life...",
      views: 2500000,
      engagementRate: "8.5%",
      soundName: "Original Sound",
    },
    {
      platform: "instagram" as const,
      creator: "@fashiondaily",
      niche: "fashion",
      format: "reel" as const,
      hook: "POV: You found the perfect outfit",
      views: 1200000,
      engagementRate: "6.2%",
      soundName: "Trending Audio",
    },
    {
      platform: "tiktok" as const,
      creator: "@foodieking",
      niche: "food",
      format: "slideshow" as const,
      hook: "3 ingredients, 5 minutes, infinite flavor",
      views: 3200000,
      engagementRate: "9.1%",
      soundName: "Cooking Beat",
    },
    {
      platform: "youtube" as const,
      creator: "@techreview",
      niche: "tech",
      format: "hook_demo" as const,
      hook: "I tested 100 phones so you don't have to",
      views: 1500000,
      engagementRate: "5.8%",
      soundName: "Tech Intro",
    },
    {
      platform: "tiktok" as const,
      creator: "@motivationdaily",
      niche: "self_improvement",
      format: "wall_of_text" as const,
      hook: "5 habits that 99% of millionaires have",
      views: 4500000,
      engagementRate: "11.2%",
      soundName: "Inspiring Piano",
    },
    {
      platform: "instagram" as const,
      creator: "@travelbug",
      niche: "travel",
      format: "green_screen" as const,
      hook: "This hidden gem costs $10 a night",
      views: 800000,
      engagementRate: "7.3%",
      soundName: "Adventure Music",
    },
  ];

  for (const t of trendingData) {
    await db.insert(trendingContent).values(t);
  }
  console.log("Trending content seeded");

  console.log("Seed complete!");
}

seed().catch(console.error);
