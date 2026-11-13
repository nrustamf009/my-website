import { redirect } from "next/navigation";

export default async function BrokerRoot({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string>> }) {
  const { slug } = await params;
  const qs = new URLSearchParams(await searchParams).toString();
  redirect(`/b/${slug}/check${qs ? `?${qs}` : ""}`);
}
