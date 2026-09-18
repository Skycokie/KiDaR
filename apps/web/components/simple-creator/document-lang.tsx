"use client";

import { useEffect } from "react";
import "./creaza.css";

export function DocumentLang({ lang }: { lang: "ro" | "en" }) {
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = lang;
    return () => {
      document.documentElement.lang = previous || "en";
    };
  }, [lang]);
  return null;
}
