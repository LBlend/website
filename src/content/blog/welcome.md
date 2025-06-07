---
title: Welcome to my website!
description: I finally got my shit together and made a website.
pubDate: 2025-03-10
language: en
tags:
  - dev
---

## Morn!

If you're reading this... then you're probably on my new website! Once upon a time I did have one, but I took it down. Over the years, I've always had the idea of creating a new one lingering in the back of my mind, but I never got around to it. I think it was a sense of wanting it to be "perfect" and not knowing what to put on there. Well, now I do - after taking some heavy inspiration from other people, as mentioned in the footer.

The website will essentially be a one-stop shop for oversharing about myself. Here, I can fulfill my need to talk about myself while not bothering anyone. I may be talking to a wall, but at least it's _my_ wall. Still, I'm secretly hoping someone stumbles across what I put up here. Personally, I like lurking around on the internet late at night and often find myself on random people's websites. Maybe someone like me will come around? 👀

Though I'm not much of a writer, I also made this blog. Here I will put miscellaneous thoughts that I feel like writing about. It'll be an outlet for my _"deep"_ and _"profound"_ thoughts to fill my narcissistic needs.

## The stack

The website is built using:

- Astro
- Tailwind
- TypeScript

Is it overkill? Probably.

Do I care? No.

I want the flexibility to do whatever the hell I want in the future. I've shot myself in the foot in the past by limiting the scope of my stack choice. After all, this is modern web development. We don't care about optimization. That said, Astro in particular promises pretty good performance while giving me all the bells and whistles I could ever need.

### The hardest choice of any modern web dev - Choosing a framework

Initially I built this website using Next.js. I had been out of the loop in the web development world for a while, and since there's a new hot JS framework being released every week, things looked different now than even just 3 years ago. One name that had repeatedly come up though was Next. I kept seeing friends building stuff with it and got curious. The promises were amazing so I jumped on the bandwagon. Honestly, I was pretty happy with it however I kept getting spoiled for choice and there was a lot of outdated "documentation". Next is changing fast, which means the good ol' Stackoverflow answer you found often does not apply to you. Next also introduces a lot of decisions to make like whether to use the new app router or not. It felt exhausting to use. I could just <abbr title="Read The Fucking Manual">RTFM</abbr> but that would be no fun! The final straw was seeing that it generally lacked in the performance department, and I of course want my blog to load blazingly fast and shave off those 100ms!

Why care about frameworks when you can use vanilla HTML/CSS/JS? No, that would make too much sense! I love hype trains. Choo-motherfucking-choo!

### Trying out Tailwind

Another name that came up was Tailwind. I was initially very skeptical of it as it seemed like inline CSS with extra steps and went against the principle of separating styling from content. I decided to give it a try anyway and can happily say it's beginning to grow on me. I like how quick and easy it is to make a design since you don't need to context switch between two separate files. Being able to directly style the particular element you want to design, saves more time than you'd think! Having consistent color palettes as well as spacing also helps free some redundant mental workload.

Tailwind still feels a bit messy, though. Having a potentially long list of classes in the middle of all your HTML makes things feel cluttered. This is remedied by two things however: the tailwind prettier plugin as well as having a good base style. The plugin automatically sorts your classes, allowing for consistency, something I have manually done in CSS files in the past. If you have a good global stylesheet that covers most cases you don't need as many classes. From a consistency perspective you wouldn't need to write any classes at all but a good web design is not always consistent. One thing to note however is that being too aggressive with the global styling makes your life harder, an issue I ran into when building this website.

## Final notes

I spent way too long building this. More than I'd like to admit. Why you may ask? Because instead of making a design before writing any code, I jumped straight into it. And instead of focusing on creating the _content_ I wanted on the site first, I instead ended up nudging CSS values around, only to find out it didn't look the part when all the content was finally in place.

Anyway, even though I kinda hate writing, there is more to come in the future.

Bye for now! 👋
