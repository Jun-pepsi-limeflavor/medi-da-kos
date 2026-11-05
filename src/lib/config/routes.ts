/** App routes — change paths here to update links across the app. */
export const ROUTES = {
  home: "/",
  login: "/login",
  contact: "/contact",
} as const;

/** Where to send the user right after creating an account */
export const REDIRECT_AFTER_REGISTER = ROUTES.home;

/** Where to send the user right after logging in (Dashboard는 2차 개발 전까지 없다) */
export const REDIRECT_AFTER_LOGIN = ROUTES.home;
