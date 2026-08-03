/**
 * App routes — change paths here to update links across the app.
 *
 * Redirect behavior (where to edit):
 * ┌─────────────────────────────┬──────────────────────────────────────────┐
 * │ Event                       │ File → what to change                    │
 * ├─────────────────────────────┼──────────────────────────────────────────┤
 * │ After sign up               │ LoginForm.tsx → router.push after register│
 * │ After log in                │ LoginForm.tsx → router.push after login   │
 * │ Already logged in on /login │ LoginForm.tsx → useEffect router.replace │
 * │ After sample request        │ Top10Products.tsx → onSuccess router.push │
 * │ After CM brief submit       │ CMWizard.tsx → reset brief, router.push   │
 * └─────────────────────────────┴──────────────────────────────────────────┘
 *
 * Next.js navigation:
 *   router.push("/path")     — navigate (adds history entry)
 *   router.replace("/path")  — navigate without back stack
 */
export const ROUTES = {
  home: "/",
  login: "/login",
  contact: "/contact",
  dashboard: "/dashboard",
  orders: "/dashboard/orders",
  tracking: "/dashboard/tracking",
} as const;

/** Where to send the user right after creating an account */
export const REDIRECT_AFTER_REGISTER = ROUTES.home;

/** Where to send the user right after logging in */
export const REDIRECT_AFTER_LOGIN = ROUTES.dashboard;

/** Where to send the user after submitting a Top 10 sample request */
export const REDIRECT_AFTER_SAMPLE_REQUEST = ROUTES.orders;

/** After CM brief submit — brief is reset; user lands on My Orders */
export const REDIRECT_AFTER_BRIEF_SUBMIT = ROUTES.orders;
