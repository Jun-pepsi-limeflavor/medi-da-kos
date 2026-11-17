export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  phone: string;
  country: string;
  companyName: string;
  provider: "email" | "google" | "mock";
  role?: "admin" | "user";
  createdAt: string;
}
