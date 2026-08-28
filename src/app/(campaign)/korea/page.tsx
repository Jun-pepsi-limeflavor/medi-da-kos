import { redirect } from "next/navigation";

export default async function LegacyKoreaRedirect(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value)) value.forEach((v) => query.append(key, v));
  }
  const queryString = query.toString();
  redirect(`/landing/korea${queryString ? `?${queryString}` : ""}`);
}
