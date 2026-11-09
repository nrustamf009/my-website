import { redirect } from "next/navigation";

export default async function BrokerRoot({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/b/${slug}/check`);
}
