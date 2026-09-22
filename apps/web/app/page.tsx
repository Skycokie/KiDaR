import Link from "next/link";
import { SimpleCreatorShell } from "@/components/simple-creator/shell";
import { getLoggedInUser } from "@/lib/appwrite/client";

export default async function HomePage() {
  const user = await getLoggedInUser();
  const createHref = user ? "/creaza" : "/intra";
  const studioHref = user ? "/studio" : "/login";

  return (
    <SimpleCreatorShell>
      <h1>Fă o pagină să prindă viață.</h1>
      <p className="creaza-lead">
        Fotografiază un desen, o pagină de poveste sau un indiciu. Primești un QR, iar copilul
        vede surpriza în telefon.
      </p>
      <div className="creaza-hero-actions">
        <Link className="creaza-btn creaza-btn-primary" href={createHref}>
          Creează o surpriză
        </Link>
        <Link className="creaza-btn creaza-btn-secondary" href={studioHref}>
          Intră în Studio
        </Link>
      </div>

      <section className="creaza-use-cases" aria-label="Pentru cine este">
        <article className="creaza-use-case">
          <h2>Povești care prind viață</h2>
          <p>
            Fotografiază pagina tipărită. Pe telefon, copilul îndreaptă camera spre aceeași
            pagină — nu oriunde în cameră.
          </p>
        </article>
        <article className="creaza-use-case">
          <h2>Desene care ies din foaie</h2>
          <p>
            Un desen colorat pe hârtie. Telefonul recunoaște foaia și arată surpriza deasupra ei.
          </p>
        </article>
        <article className="creaza-use-case">
          <h2>Misiuni și escape rooms</h2>
          <p>
            Un afiș sau o hartă tipărită. Jucătorii deschid linkul, apoi îndreaptă telefonul
            spre imaginea de pe perete sau masă.
          </p>
        </article>
      </section>

      <h2>Fără aplicație de instalat</h2>
      <ol className="creaza-steps">
        <li>Creezi surpriza</li>
        <li>Deschizi linkul pe telefon</li>
        <li>Îndrepți telefonul spre pagină</li>
      </ol>
      <p className="creaza-note">
        Linkul pe telefon, codul QR și pagina care prinde viață urmează. Astăzi poți începe
        surpriza și poți folosi Studio în engleză.
      </p>
    </SimpleCreatorShell>
  );
}
