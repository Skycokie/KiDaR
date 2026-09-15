import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>kidAR Studio</h1>
      <p>Turn children&apos;s drawings into playful WebAR experiences.</p>
      <Link href="/dashboard">Open dashboard</Link>
    </main>
  );
}
