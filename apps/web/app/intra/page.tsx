import { SimpleCreatorShell } from "@/components/simple-creator/shell";
import { IntraForm } from "./intra-form";

export default function IntraPage() {
  return (
    <SimpleCreatorShell>
      <h1>Intră în kidAR</h1>
      <p className="creaza-lead">Folosești doar adresa de email. Fără parolă.</p>
      <IntraForm />
    </SimpleCreatorShell>
  );
}
