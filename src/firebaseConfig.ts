// MintGuard — Firebase project configuration.
//
// HOW TO CONNECT A REAL PROJECT (see README.md for the full steps):
//   1. Create a Firebase project on the no-cost Spark plan (do NOT link a
//      billing account — that would flip the project to Blaze/pay-as-you-go).
//   2. In the Firebase console go to AI Services > AI Logic > Get started
//      and choose "Gemini Developer API".
//   3. Register this web app and copy the web config values below.
//   4. Enable App Check via the Fraud Defense (reCAPTCHA Enterprise)
//      provider and paste the Enterprise site key into
//      RECAPTCHA_ENTERPRISE_SITE_KEY below. Classic reCAPTCHA v3 is
//      deprecated in the Firebase console and cannot be used. For local
//      development, use an App Check debug token instead (see README.md).
//
// Until every placeholder below is replaced with real values, the app runs
// in MOCK MODE: a local rule-based analyzer answers instead of Firebase AI
// Logic, and the UI labels every result as mock. The Firebase *web* config
// below is a public client identifier by design (it ships in the built JS
// bundle) — real secrets (service-account keys, reCAPTCHA secret keys)
// must never be committed; see .gitignore.

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export const firebaseConfig: FirebaseWebConfig = {
  apiKey: "AIzaSyDKxSjltZ98dEMXU9EGLlz-sHRPZOP5EZk",
  authDomain: "mintguard-df373.firebaseapp.com",
  projectId: "mintguard-df373",
  storageBucket: "mintguard-df373.firebasestorage.app",
  messagingSenderId: "419379277074",
  appId: "1:419379277074:web:5aa9bfa9b83d726cfc17cb",
};

/** reCAPTCHA Enterprise (Fraud Defense) site key used by Firebase App Check (required by AI Logic). Classic reCAPTCHA v3 is deprecated — do not use it. */
export const RECAPTCHA_ENTERPRISE_SITE_KEY = "6Lf8zyYuAAAAAHRr9Mq_1bRx_023apvlqRdSLgxj";

/** True only when every placeholder above has been replaced with real values. */
export function isFirebaseConfigured(): boolean {
  const values = [
    firebaseConfig.apiKey,
    firebaseConfig.authDomain,
    firebaseConfig.projectId,
    firebaseConfig.storageBucket,
    firebaseConfig.messagingSenderId,
    firebaseConfig.appId,
  ];
  return values.every(
    (v) => typeof v === "string" && v.length > 0 && !v.startsWith("YOUR_"),
  );
}
