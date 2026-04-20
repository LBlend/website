export const locales = ["en", "no", "ko"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  no: "Norsk",
  ko: "한국어",
};

export interface Translations {
  hero: {
    coordinates: string;
  };
  nav: {
    home: string;
    blog: string;
    photos: string;
    about: string;
    microblog: string;
    projects: string;
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
    pageTitle: string;
    semester: string;
    ects: string;
    name: string;
    birthday: string;
    location: string;
    sex: string;
    height: string;
    education: string;
    emailMe: string;
    callMe: string;
    highlightedProjects: string;
    viewAllProjects: string;
    programmingTools: string;
    humanLanguages: string;
    native: string;
    fluent: string;
    basicA2: string;
    basicA1: string;
    languagesDesc: string;
    courses: string;
    showAllCourses: string;
    showLess: string;
    timeline: string;
    present: string;
    categoryLife: string;
    categoryEducation: string;
    categoryWork: string;
    categoryVolunteer: string;
    categoryCertification: string;
    favourites: string;
    favouritesDesc: string;
    favouriteFood: string;
    favouriteMovie: string;
    favouriteTvShow: string;
    favouriteGame: string;
    favouriteAlbum: string;
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
