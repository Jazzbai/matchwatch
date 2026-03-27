"use client";

type GrecaptchaClient = {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
};

declare global {
  interface Window {
    grecaptcha?: GrecaptchaClient;
  }
}

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() ?? "";
const RECAPTCHA_SCRIPT_ID = "google-recaptcha-v3";

let recaptchaScriptPromise: Promise<void> | null = null;

export function isRecaptchaEnabled() {
  return RECAPTCHA_SITE_KEY.length > 0;
}

function ensureBrowser() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("reCAPTCHA can only run in the browser.");
  }
}

async function loadRecaptchaScript() {
  ensureBrowser();

  if (!isRecaptchaEnabled()) {
    throw new Error("reCAPTCHA is not configured yet.");
  }

  if (window.grecaptcha) {
    return;
  }

  if (!recaptchaScriptPromise) {
    recaptchaScriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.getElementById(RECAPTCHA_SCRIPT_ID) as HTMLScriptElement | null;

      const handleLoad = () => resolve();
      const handleError = () => reject(new Error("Failed to load reCAPTCHA. Please refresh and try again."));

      if (existing) {
        existing.addEventListener("load", handleLoad, { once: true });
        existing.addEventListener("error", handleError, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.id = RECAPTCHA_SCRIPT_ID;
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(RECAPTCHA_SITE_KEY)}`;
      script.async = true;
      script.defer = true;
      script.addEventListener("load", handleLoad, { once: true });
      script.addEventListener("error", handleError, { once: true });
      document.head.appendChild(script);
    }).catch((error) => {
      recaptchaScriptPromise = null;
      throw error;
    });
  }

  await recaptchaScriptPromise;
}

async function getRecaptchaClient() {
  await loadRecaptchaScript();

  const grecaptcha = window.grecaptcha;
  if (!grecaptcha) {
    throw new Error("reCAPTCHA is unavailable. Please refresh and try again.");
  }

  await new Promise<void>((resolve) => grecaptcha.ready(resolve));
  return grecaptcha;
}

export async function executeRecaptcha(action: string) {
  if (!isRecaptchaEnabled()) {
    return undefined;
  }

  const grecaptcha = await getRecaptchaClient();
  return grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
}
