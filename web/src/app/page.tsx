import { Topbar } from "@/components/site/topbar";
import { Hero } from "@/components/site/hero";
import { Proof } from "@/components/site/proof";
import { How } from "@/components/site/how";
import { Injection } from "@/components/site/injection";
import { Exhibit } from "@/components/site/exhibit";
import { Close } from "@/components/site/close";

export default function Home() {
  return (
    <>
      <Topbar />
      <main className="flex-1">
        <Hero />
        <Proof />
        <How />
        <Injection />
        <Exhibit />
        <Close />
      </main>
    </>
  );
}
