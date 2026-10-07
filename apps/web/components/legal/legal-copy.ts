import type { Locale } from "@/i18n/config";
import type { LegalDocumentId } from "@/lib/legal";

export type LegalTable = { head: readonly string[]; rows: readonly (readonly string[])[] };

export type LegalSection = {
  heading: string;
  paragraphs?: readonly string[];
  bullets?: readonly string[];
  table?: LegalTable;
};

export type LegalDoc = {
  title: string;
  intro: string;
  sections: readonly LegalSection[];
};

/** Labels used by the "who we are" block rendered at the top of every document. */
export type LegalOperatorLabels = {
  controller: string;
  company: string;
  companyId: string;
  address: string;
  contact: string;
  contactFallback: string;
};

export const LEGAL_OPERATOR_LABELS: Record<Locale, LegalOperatorLabels> = {
  ro: {
    controller: "Operator de date",
    company: "Societate",
    companyId: "Cod de identificare / TVA",
    address: "Adresă",
    contact: "Contact pentru cereri privind datele personale",
    contactFallback: "Scrie-ne la adresa poștală de mai sus."
  },
  en: {
    controller: "Data controller",
    company: "Company",
    companyId: "Company ID / VAT no.",
    address: "Address",
    contact: "Contact for privacy requests",
    contactFallback: "Write to us at the postal address above."
  }
};

const roPrivacy: LegalDoc = {
  title: "Politica de confidențialitate",
  intro:
    "kidAR transformă desenele copiilor în experiențe de realitate augmentată. Aici explicăm ce date personale prelucrăm, de ce, cui le transmitem, cât timp le păstrăm și ce drepturi ai.",
  sections: [
    {
      heading: "1. Pentru cine este serviciul",
      paragraphs: [
        "kidAR este destinat adulților: părinți, tutori legali și educatori. Copiii nu își creează conturi proprii.",
        "Desenele încărcate aparțin, de regulă, unui copil. De aceea îți cerem să confirmi că ești părintele sau tutorele legal înainte de prima încărcare și, separat, înainte de a adăuga o voce.",
        "Te rugăm să încarci doar desenul, fără fotografii cu fețe sau alte informații care identifică un copil (nume complet, școală, adresă)."
      ]
    },
    {
      heading: "2. Ce date prelucrăm",
      table: {
        head: ["Date", "Scop", "Temei juridic"],
        rows: [
          [
            "Adresa de e-mail și sesiunea de autentificare",
            "Crearea contului și conectarea cu link magic",
            "Executarea contractului (art. 6 alin. 1 lit. b RGPD)"
          ],
          [
            "Desene (fotografie sau scanare), imaginile derivate, modelul 3D și setările scenei",
            "Crearea figurinei și a experienței AR",
            "Executarea contractului; confirmarea părintelui sau tutorelui, înregistrată cu data și versiunea"
          ],
          [
            "Voce înregistrată sau încărcată și mesajul text al personajului",
            "Redarea vocii în pagina AR a proiectului",
            "Consimțământ (art. 6 alin. 1 lit. a RGPD), pe care îl poți retrage oricând"
          ],
          [
            "Pagina AR publicată (model 3D, imaginea țintă, audio)",
            "Afișarea experienței oricui deschide linkul sau codul QR",
            "Executarea contractului"
          ],
          [
            "Date de plată (procesate de Stripe, nu vedem numărul cardului)",
            "Încasarea abonamentelor și respectarea obligațiilor contabile",
            "Executarea contractului; obligație legală (art. 6 alin. 1 lit. c)"
          ],
          [
            "Date tehnice din jurnalele serverelor (adresă IP, browser, momentul accesării)",
            "Securitatea și funcționarea serviciului",
            "Interes legitim (art. 6 alin. 1 lit. f)"
          ],
          [
            "Limba preferată (cookie)",
            "Afișarea site-ului în limba aleasă",
            "Strict necesar; vezi pagina Cookie-uri"
          ]
        ]
      }
    },
    {
      heading: "3. Camera telefonului în experiența AR",
      paragraphs: [
        "Pagina AR cere acces la cameră ca să recunoască desenul tipărit. Imaginea camerei este procesată pe telefonul tău, în browser. Nu este înregistrată și nu este trimisă către noi sau către terți."
      ]
    },
    {
      heading: "4. Paginile AR publice",
      paragraphs: [
        "Când publici un proiect, pagina lui AR poate fi deschisă de oricine are linkul sau codul QR. Paginile nu sunt indexate de motoarele de căutare, dar nu sunt protejate prin parolă. Nu include în ele nume, adrese sau alte date personale.",
        "Ștergerea proiectului îl scoate din aplicație. Dacă vrei ca și pagina publică să fie retrasă, spune-ne la datele de contact de mai sus."
      ]
    },
    {
      heading: "5. Cui transmitem datele",
      paragraphs: [
        "Nu vindem datele, nu facem publicitate personalizată și nu folosim instrumente de analiză sau urmărire. Folosim furnizori care prelucrează date în numele nostru, pe baza unor acorduri de prelucrare:"
      ],
      table: {
        head: ["Furnizor", "Rol"],
        rows: [
          ["Appwrite Cloud (regiunea Frankfurt, Germania)", "Conturi, bază de date și fișiere încărcate"],
          ["Cloudflare R2", "Stocarea fișierelor paginilor AR publice"],
          ["Vercel", "Găzduirea site-ului"],
          ["Railway", "Prelucrarea în fundal (generarea paginilor și a modelelor)"],
          [
            "Tripo (Tripo3D)",
            "Generarea modelului 3D din desen, doar când această funcție este activă. Desenul este trimis furnizorului numai în acest scop"
          ],
          ["Stripe", "Plăți"]
        ]
      }
    },
    {
      heading: "6. Transferuri în afara Spațiului Economic European",
      paragraphs: [
        "Unii furnizori pot prelucra date în afara SEE, de exemplu în Statele Unite. În acest caz ne bazăm pe decizii de adecvare (de exemplu Cadrul UE-SUA de confidențialitate a datelor) sau pe clauze contractuale standard aprobate de Comisia Europeană."
      ]
    },
    {
      heading: "7. Cât timp păstrăm datele",
      bullets: [
        "Contul și conținutul proiectelor: cât timp contul există sau până ștergi proiectul.",
        "Ștergerea contului și a tuturor datelor asociate: la cerere, în cel mult 30 de zile.",
        "Jurnalele serverelor: pe perioade scurte, stabilite de furnizorii de găzduire.",
        "Documentele de plată și contabile: perioada impusă de legislația contabilă și fiscală aplicabilă."
      ]
    },
    {
      heading: "8. Drepturile tale",
      paragraphs: [
        "Ai dreptul de acces, rectificare, ștergere, restricționare, portabilitate și opoziție, precum și dreptul de a retrage consimțământul în orice moment, fără ca aceasta să afecteze prelucrările făcute înainte de retragere.",
        "Trimite cererea la datele de contact de mai sus. Răspundem în cel mult o lună.",
        "Poți depune o plângere la Comisia pentru Protecția Datelor Personale din Bulgaria (www.cpdp.bg) sau la autoritatea din țara ta. În România: ANSPDCP (www.dataprotection.ro)."
      ]
    },
    {
      heading: "9. Securitate",
      paragraphs: [
        "Folosim conexiuni criptate (HTTPS), conturi cu acces limitat și linkuri semnate, cu durată scurtă, pentru fișierele private. Accesul la desenele încărcate este limitat la titularul contului și la sistemele noastre. Dacă apare o încălcare a securității care te afectează, te anunțăm și anunțăm autoritatea competentă în termenele legale."
      ]
    },
    {
      heading: "10. Modificări",
      paragraphs: [
        "Dacă schimbăm această politică într-un mod important, actualizăm data de mai sus și, când este nevoie, îți cerem din nou confirmarea."
      ]
    }
  ]
};

const enPrivacy: LegalDoc = {
  title: "Privacy policy",
  intro:
    "kidAR turns children's drawings into augmented reality experiences. This page explains which personal data we process, why, who receives it, how long we keep it, and what rights you have.",
  sections: [
    {
      heading: "1. Who the service is for",
      paragraphs: [
        "kidAR is meant for adults: parents, legal guardians and educators. Children do not create their own accounts.",
        "The drawings you upload usually belong to a child. That is why we ask you to confirm that you are the parent or legal guardian before the first upload and, separately, before you add a voice.",
        "Please upload the drawing only, without photos of faces or other information that identifies a child (full name, school, address)."
      ]
    },
    {
      heading: "2. What data we process",
      table: {
        head: ["Data", "Purpose", "Legal basis"],
        rows: [
          [
            "Email address and sign-in session",
            "Creating your account and signing you in with a magic link",
            "Performance of a contract (Art. 6(1)(b) GDPR)"
          ],
          [
            "Drawings (photo or scan), derived images, the 3D model and scene settings",
            "Creating the figurine and the AR experience",
            "Performance of a contract; the parent or guardian confirmation, recorded with date and version"
          ],
          [
            "Recorded or uploaded voice and the character's text message",
            "Playing the voice on the project's AR page",
            "Consent (Art. 6(1)(a) GDPR), which you can withdraw at any time"
          ],
          [
            "The published AR page (3D model, target image, audio)",
            "Showing the experience to anyone who opens the link or QR code",
            "Performance of a contract"
          ],
          [
            "Payment data (processed by Stripe, we never see your card number)",
            "Collecting subscriptions and meeting accounting obligations",
            "Performance of a contract; legal obligation (Art. 6(1)(c))"
          ],
          [
            "Technical data in server logs (IP address, browser, time of access)",
            "Security and operation of the service",
            "Legitimate interest (Art. 6(1)(f))"
          ],
          [
            "Preferred language (cookie)",
            "Showing the site in the language you chose",
            "Strictly necessary; see the Cookies page"
          ]
        ]
      }
    },
    {
      heading: "3. Your phone camera in the AR experience",
      paragraphs: [
        "The AR page asks for camera access to recognise the printed drawing. The camera image is processed on your phone, in the browser. It is not recorded and it is not sent to us or to anyone else."
      ]
    },
    {
      heading: "4. Public AR pages",
      paragraphs: [
        "When you publish a project, its AR page can be opened by anyone who has the link or the QR code. The pages are not indexed by search engines, but they are not password protected. Do not include names, addresses or other personal data in them.",
        "Deleting a project removes it from the app. If you also want the public page withdrawn, contact us using the details above."
      ]
    },
    {
      heading: "5. Who receives the data",
      paragraphs: [
        "We do not sell data, we do not run personalised advertising and we do not use analytics or tracking tools. We use providers that process data on our behalf under data processing agreements:"
      ],
      table: {
        head: ["Provider", "Role"],
        rows: [
          ["Appwrite Cloud (Frankfurt region, Germany)", "Accounts, database and uploaded files"],
          ["Cloudflare R2", "Storage of public AR page files"],
          ["Vercel", "Website hosting"],
          ["Railway", "Background processing (generating pages and models)"],
          [
            "Tripo (Tripo3D)",
            "Generating the 3D model from the drawing, only when this feature is enabled. The drawing is sent to the provider for this purpose only"
          ],
          ["Stripe", "Payments"]
        ]
      }
    },
    {
      heading: "6. Transfers outside the European Economic Area",
      paragraphs: [
        "Some providers may process data outside the EEA, for example in the United States. In that case we rely on adequacy decisions (such as the EU-US Data Privacy Framework) or on standard contractual clauses approved by the European Commission."
      ]
    },
    {
      heading: "7. How long we keep data",
      bullets: [
        "Account and project content: as long as the account exists or until you delete the project.",
        "Deleting your account and all associated data: on request, within 30 days at most.",
        "Server logs: for short periods set by the hosting providers.",
        "Payment and accounting records: for the period required by applicable accounting and tax law."
      ]
    },
    {
      heading: "8. Your rights",
      paragraphs: [
        "You have the right of access, rectification, erasure, restriction, portability and objection, and the right to withdraw your consent at any time without affecting processing done before the withdrawal.",
        "Send your request using the contact details above. We reply within one month at the latest.",
        "You can lodge a complaint with the Commission for Personal Data Protection of Bulgaria (www.cpdp.bg) or with the authority in your own country. In Romania: ANSPDCP (www.dataprotection.ro)."
      ]
    },
    {
      heading: "9. Security",
      paragraphs: [
        "We use encrypted connections (HTTPS), restricted accounts and short-lived signed links for private files. Access to uploaded drawings is limited to the account holder and our systems. If a security breach affects you, we will tell you and the competent authority within the legal deadlines."
      ]
    },
    {
      heading: "10. Changes",
      paragraphs: [
        "If we change this policy in a significant way, we update the date above and, where needed, ask for your confirmation again."
      ]
    }
  ]
};

const roTerms: LegalDoc = {
  title: "Termeni de utilizare",
  intro:
    "Prin folosirea kidAR accepți acești termeni. Dacă nu ești de acord, te rugăm să nu folosești serviciul.",
  sections: [
    {
      heading: "1. Serviciul",
      paragraphs: [
        "kidAR îți permite să încarci un desen, să îl transformi într-o figurină 3D și să îl publici ca experiență de realitate augmentată, accesibilă printr-un link sau un cod QR. Serviciul este în dezvoltare și poate fi schimbat sau întrerupt."
      ]
    },
    {
      heading: "2. Cine poate folosi serviciul",
      paragraphs: [
        "Contul poate fi creat doar de o persoană adultă. Dacă încarci desenul unui copil, declari că ești părintele sau tutorele legal al copilului ori că ai acordul acestuia."
      ]
    },
    {
      heading: "3. Conținutul tău",
      paragraphs: [
        "Rămâi titularul drepturilor asupra desenelor, vocilor și textelor pe care le încarci. Ne acorzi dreptul nonexclusiv de a le stoca, prelucra și afișa strict pentru a-ți furniza serviciul, inclusiv în paginile AR pe care alegi să le publici.",
        "Garantezi că ai dreptul să încarci conținutul și că nu încalcă drepturile altor persoane. Nu încărca conținut ilegal, ofensator sau care conține date personale ale altor persoane."
      ]
    },
    {
      heading: "4. Pagini publice",
      paragraphs: [
        "O pagină publicată poate fi deschisă de oricine are linkul sau codul QR. Tu decizi cui îl dai și ce publici."
      ]
    },
    {
      heading: "5. Utilizare corectă",
      bullets: [
        "Nu încerca să accesezi conturile sau datele altor utilizatori.",
        "Nu perturba funcționarea serviciului și nu folosi mijloace automate abuzive.",
        "Nu folosi serviciul pentru conținut care dăunează copiilor sau altor persoane."
      ]
    },
    {
      heading: "6. Disponibilitate și răspundere",
      paragraphs: [
        "Oferim serviciul în starea actuală, fără garanția funcționării neîntrerupte. În măsura permisă de lege, răspunderea noastră se limitează la prejudiciile directe. Aceste limitări nu afectează drepturile tale legale de consumator."
      ]
    },
    {
      heading: "7. Ștergere și încetare",
      paragraphs: [
        "Poți șterge proiectele din aplicație și poți cere ștergerea contului. Putem suspenda un cont care încalcă acești termeni."
      ]
    },
    {
      heading: "8. Legea aplicabilă",
      paragraphs: [
        "Termenii sunt guvernați de legea bulgară. Dacă ești consumator în Uniunea Europeană, rămân aplicabile dispozițiile obligatorii de protecție a consumatorului din țara ta de reședință."
      ]
    },
    {
      heading: "9. Modificări",
      paragraphs: [
        "Putem actualiza acești termeni. Data ultimei actualizări apare pe această pagină. Continuarea folosirii serviciului după o modificare înseamnă că o accepți."
      ]
    }
  ]
};

const enTerms: LegalDoc = {
  title: "Terms of use",
  intro:
    "By using kidAR you accept these terms. If you do not agree, please do not use the service.",
  sections: [
    {
      heading: "1. The service",
      paragraphs: [
        "kidAR lets you upload a drawing, turn it into a 3D figurine and publish it as an augmented reality experience that can be opened through a link or a QR code. The service is under development and may change or be interrupted."
      ]
    },
    {
      heading: "2. Who can use the service",
      paragraphs: [
        "Only an adult can create an account. If you upload a child's drawing, you declare that you are the child's parent or legal guardian, or that you have their permission."
      ]
    },
    {
      heading: "3. Your content",
      paragraphs: [
        "You keep the rights to the drawings, voices and texts you upload. You give us a non-exclusive right to store, process and display them strictly to provide the service to you, including on the AR pages you choose to publish.",
        "You guarantee that you are entitled to upload the content and that it does not infringe anyone else's rights. Do not upload content that is illegal, offensive or that contains other people's personal data."
      ]
    },
    {
      heading: "4. Public pages",
      paragraphs: [
        "A published page can be opened by anyone who has the link or the QR code. You decide who receives it and what you publish."
      ]
    },
    {
      heading: "5. Fair use",
      bullets: [
        "Do not try to access other users' accounts or data.",
        "Do not disrupt the service or use abusive automated means.",
        "Do not use the service for content that harms children or other people."
      ]
    },
    {
      heading: "6. Availability and liability",
      paragraphs: [
        "We provide the service as is, without a guarantee of uninterrupted operation. To the extent permitted by law, our liability is limited to direct damages. These limits do not affect your statutory consumer rights."
      ]
    },
    {
      heading: "7. Deletion and termination",
      paragraphs: [
        "You can delete projects in the app and you can ask us to delete your account. We may suspend an account that breaches these terms."
      ]
    },
    {
      heading: "8. Governing law",
      paragraphs: [
        "These terms are governed by Bulgarian law. If you are a consumer in the European Union, the mandatory consumer protection rules of your country of residence still apply."
      ]
    },
    {
      heading: "9. Changes",
      paragraphs: [
        "We may update these terms. The date of the last update is shown on this page. Continuing to use the service after a change means you accept it."
      ]
    }
  ]
};

const roCookies: LegalDoc = {
  title: "Politica privind cookie-urile",
  intro:
    "kidAR folosește doar cookie-uri strict necesare funcționării. Nu folosim cookie-uri de analiză, publicitate sau urmărire, așa că nu afișăm un banner de consimțământ.",
  sections: [
    {
      heading: "Cookie-urile folosite",
      table: {
        head: ["Nume", "Rol", "Durată"],
        rows: [
          ["kidar_locale", "Reține limba aleasă (română sau engleză)", "1 an"],
          ["a_session_*", "Sesiunea ta de autentificare, setată după ce te conectezi", "Durata sesiunii"],
          ["kidar_next", "Reține pagina la care te întorci după conectare", "10 minute"]
        ]
      }
    },
    {
      heading: "Paginile AR publice",
      paragraphs: [
        "Paginile AR publicate nu setează cookie-uri și nu stochează date pe dispozitivul vizitatorului."
      ]
    },
    {
      heading: "Controlul tău",
      paragraphs: [
        "Poți șterge sau bloca cookie-urile din setările browserului. Fără cookie-ul de sesiune nu te poți conecta."
      ]
    }
  ]
};

const enCookies: LegalDoc = {
  title: "Cookie policy",
  intro:
    "kidAR only uses cookies that are strictly necessary for the service to work. We do not use analytics, advertising or tracking cookies, so we do not show a consent banner.",
  sections: [
    {
      heading: "Cookies we use",
      table: {
        head: ["Name", "Purpose", "Duration"],
        rows: [
          ["kidar_locale", "Remembers the language you chose (Romanian or English)", "1 year"],
          ["a_session_*", "Your sign-in session, set after you sign in", "Session length"],
          ["kidar_next", "Remembers the page to return to after you sign in", "10 minutes"]
        ]
      }
    },
    {
      heading: "Public AR pages",
      paragraphs: [
        "Published AR pages do not set cookies and do not store data on the visitor's device."
      ]
    },
    {
      heading: "Your control",
      paragraphs: [
        "You can delete or block cookies in your browser settings. Without the session cookie you cannot sign in."
      ]
    }
  ]
};

export const LEGAL_DOCS: Record<Locale, Record<LegalDocumentId, LegalDoc>> = {
  ro: { privacy: roPrivacy, terms: roTerms, cookies: roCookies },
  en: { privacy: enPrivacy, terms: enTerms, cookies: enCookies }
};
