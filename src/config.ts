// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = "Cloud & Code with Damian Esteban ";
export const SITE_DESCRIPTION =
  "Dive into the world of cloud computing, software engineering, and application architecture. Damian Esteban brings you practical guides, tips, and tech musings.";
export const TWITTER_HANDLE = "@estebanrules";
export const MY_NAME = "Damian Esteban";

// setup in astro.config.mjs
const BASE_URL = new URL(import.meta.env.SITE);
export const SITE_URL = BASE_URL.origin;
