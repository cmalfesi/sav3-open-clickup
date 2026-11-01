"use client";

// Use document navigation until the hosted framework's RSC navigation is
// compatible with this application. Native links retain keyboard, new-tab,
// history and authenticated request behavior.
const router = {
  push(href: string) { window.location.assign(href); },
  replace(href: string) { window.location.replace(href); },
};

export function useSiteRouter() { return router; }
