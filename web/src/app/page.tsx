import { Topbar } from "@/components/site/topbar";
import { Hero } from "@/components/site/hero";

export default function Home() {
  return (
    <>
      <Topbar />
      <main className="flex-1">
        <Hero />
      </main>
    </>
  );
}
