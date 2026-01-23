export const locales = ["en", "no", "ko"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  no: "Norsk",
  ko: "한국어",
};

export interface Translations {
  nav: {
    home: string;
    blog: string;
    photos: string;
    about: string;
    microblog: string;
    swimming: string;
  };
  blog: {
    title: string;
    description: string;
    selectTags: string;
    showingPosts: string;
    showingPost: string;
    noPosts: string;
    latestPosts: string;
    viewAllPosts: string;
    subscribe: string;
  };
  footer: {
    pgpKey: string;
    copiedXmr: string;
    enableJs: string;
    xmrPrefix: string;
  };
  intro: {
    greeting: string;
    ageText: string;
    welcome: string;
    passions: string;
    location: string;
    hopingChange: string;
  };
  visitedPlaces: {
    title: string;
    description: string;
  };
  stats: {
    title: string;
    quote: string;
    quoteAttribution: string;
    disclaimer: string;
    moviesWatched: string;
    showsWatched: string;
    watchingAnime: string;
    playingGames: string;
    clickingCircles: string;
    programming: string;
    days: string;
    hours: string;
  };
  microblog: {
    title: string;
    noPosts: string;
    viewAll: string;
  };
  swimming: {
    title: string;
    pageTitle: string;
    description: string;
    onlyBestTimes: string;
    showPartials: string;
    distance: string;
    stroke: string;
    time: string;
    date: string;
    city: string;
    country: string;
    poolLength: string;
    partialDistance: string;
    yes: string;
  };
  about: {
    title: string;
    comingSoon: string;
  };
  notFound: {
    title: string;
    message: string;
  };
  common: {
    minRead: string;
  };
  recentlyLikedSongs: {
    title: string;
    fetchError: string;
  };
  photos: {
    title: string;
    description: string;
    subtitle: string;
  };
}
