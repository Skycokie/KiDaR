import type { ReactNode } from "react";
import { DocumentLang } from "./document-lang";

export function SimpleCreatorShell({
  children,
  progress
}: {
  children: ReactNode;
  progress?: string;
}) {
  return (
    <div className="creaza-shell" lang="ro">
      <DocumentLang lang="ro" />
      <a className="creaza-skip" href="#continut">
        Sari la conținut
      </a>
      <div className="creaza-frame">
        {progress ? <p className="creaza-progress">{progress}</p> : null}
        <div id="continut">{children}</div>
      </div>
    </div>
  );
}
