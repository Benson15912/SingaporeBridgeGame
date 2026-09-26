import type { Metadata } from "next";
import { RoomScreen } from "@/components/room/RoomScreen";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `Room ${code.toUpperCase()}`,
    description: "You've been invited to a game of Floating Bridge. Join the table and play.",
    robots: { index: false, follow: false },
  };
}

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RoomScreen code={code} />;
}
