import type { Messages } from "../types";

export const ro: Messages = {
  brand: {
    playWith: "PLAY WITH",
    studio: "STUDIO",
    accessibleLabel: "kidAR — Play With Studio"
  },
  landing: {
    eyebrow: "PLAY WITH",
    title: "Desenul tău prinde viață.",
    description: "Transformă un desen într-o figurină pe care o poți descoperi în lumea ta.",
    discoverCta: "Descoperă kidAR",
    studioCta: "Intră în Studio",
    originalArtNote: "Ilustrații originale create pentru kidAR.",
    processTitle: "Din desen, într-o lume nouă.",
    draw: "Desenează",
    drawBody: "Creează un personaj în stilul tău.",
    photograph: "Fotografiază",
    photographBody: "Păstrează desenul clar, întreg și bine luminat.",
    discover: "Descoperă",
    discoverBody: "Privește figurina și exploreaz-o în spațiul tău.",
    closeTitle: "O idee mică poate deveni o lume mare.",
    enterCta: "Intră în kidAR",
    revealFound3d: "Arată obiectul găsit în 3D",
    spinDetective: "Ridică și învârte detectivul galben",
    returnToPhoto: "Trimite obiectul înapoi în poză"
  },
  auth: {
    title: "Intră în kidAR",
    lead: "Folosești doar adresa de email. Fără parolă.",
    emailLabel: "Email",
    emailPlaceholder: "nume@exemplu.ro",
    submit: "Trimite legătura de intrare",
    submitting: "Se trimite…",
    invalidEmail: "Introdu o adresă de email validă.",
    sendError: "Nu am putut trimite legătura. Verifică adresa și încearcă din nou.",
    sendMailError: "Nu am putut trimite emailul. Verifică adresa și încearcă din nou.",
    checkEmail: "Verifică emailul",
    checkEmailBody: "Ți-am trimis o legătură de intrare. Deschide emailul și apasă butonul pentru a continua.",
    spamHint: "Dacă nu vezi mesajul, verifică folderul Spam sau cere o legătură nouă.",
    requestNewLink: "Cere o legătură nouă",
    confirmTitle: "Confirmă intrarea în kidAR",
    confirmBody: "Apasă butonul pentru a intra în kidAR.",
    scannerProtection: "Confirmarea oprește scanerele de email să consume legătura înaintea ta.",
    enter: "Intră în kidAR",
    devOnly: "Doar pe acest computer:",
    openLink: "deschide legătura de intrare",
    studioAccount: "Am deja un cont Studio",
    confirmPageTitle: "Confirmă intrarea",
    retryTitle: "Intră din nou",
    linkMissing: "Linkul de intrare lipsește sau e incomplet.",
    expiredTitle: "Link expirat",
    linkUsedBeforeEnter: "Linkul a fost deja folosit sau a expirat. Cere unul nou și apasă",
    linkUsedAfterEnter: "o singură dată, din cel mai recent email.",
    sessionFailed: "Nu am putut deschide sesiunea. Cere o legătură nouă și încearcă din nou.",
    unknownError: "Eroare necunoscută"
  },
  studio: {
    steps: {
      drawing: "Desen",
      character: "Personaj",
      appearance: "Aspect",
      motion: "Mișcare",
      decor: "Decor",
      context: "Context",
      ar: "AR"
    },
    stepHints: {
      drawing: "Hârtia de start",
      character: "Ridică forma",
      appearance: "Lumină și culoare",
      motion: "Dă viață",
      decor: "Așază în lume",
      context: "Construiește povestea",
      ar: "Previzualizare locală"
    },
    previewOnly: "Previzualizare locală",
    demoPreview: "Previzualizare demonstrativă",
    addDrawingFirst: "Adaugă mai întâi un desen pentru a explora scena.",
    applyPreview: "Aplică în previzualizare",
    resetScene: "Resetează scena",
    arPreparing: "AR în pregătire",
    skipToContent: "Sari la conținut"
  },
  prompt: {
    label: "Ideea ta pentru figurină",
    heading: "Spune-i AI-ului ce îți imaginezi",
    description: "Scrie o idee, iar previzualizarea se schimbă aici, în Studio.",
    placeholder: "De exemplu: Vreau ca personajul meu să plutească printre stele.",
    apply: "Aplică în previzualizare",
    reset: "Resetează ideea",
    fallback: "Poți alege apoi mișcarea, decorul și culorile din Studio.",
    empty: "Scrie întâi o idee pentru previzualizare.",
    resultTitle: "Am ales pentru previzualizare",
    suggestions: [
      "Să plutească printre stele",
      "Să danseze într-o grădină",
      "Să sară lângă o casă colorată",
      "Să fie liniștit sub un nor",
      "Să fie într-o lume cu baloane"
    ]
  },
  accessibility: {
    skipToContent: "Sari la conținut",
    languageSelector: "Limbă",
    menu: "Meniu",
    close: "Închide"
  },
  worlds: {
    metaDescription: "Lumile tale — Atelier editorial pentru surprize AR din desene.",
    noscript: "Activează JavaScript pentru Studio.",
    nav: {
      main: "Principal",
      mobile: "Mobil",
      worlds: "Lumi",
      library: "Bibliotecă",
      create: "Creează",
      profile: "Profil"
    },
    atelier: {
      kicker: "Atelier",
      titleLine1: "Orice poză poate",
      titleLine2: "deveni o lume.",
      lead: "Adaugă o poză, alege ce prinde viață și vezi-l în AR.",
      startWithPhoto: "Începe cu o poză",
      seeWorlds: "Vezi lumile tale →",
      stepsLabel: "Cum începe",
      stepPhoto: "Poza ta",
      stepWorld: "Lumea ta",
      stepPhone: "Pe telefonul tău",
      heroLabel: "Poză → Lume AR"
    },
    gallery: {
      title: "Lumile tale",
      lead: "Nu o listă de fișiere — afișe, coperți, postere din pozele tale.",
      startNew: "Începe o lume nouă →",
      loading: "Îți adunăm lumile…",
      error: "Nu am putut deschide lumile tale acum. Reîncearcă.",
      retry: "Reîncearcă →",
      emptyTitle: "Nicio lume încă.",
      emptyBody: "Începe cu o poză — aici va apărea ca un afiș, nu ca un fișier.",
      quote: "„Poza devine poartă.”",
      untitled: "Lume fără nume",
      updatedToday: "actualizat azi",
      updatedYesterday: "actualizat ieri",
      updatedOn: "actualizat {date}",
      status: { draft: "În lucru", ready: "Pregătit", published: "Publicat" },
      fixtures: {
        aurora: { title: "Aurora", line: "Un dragon de creion iese din noapte." },
        garden: { title: "Grădina ascunsă", line: "Pagina ilustrată se deschide ca o poartă." },
        kite: { title: "Zmeu de hârtie", line: "Un desen de după-amiază, încă neterminat." }
      }
    },
    create: {
      kicker: "Creează",
      title: "Cu ce începe lumea?",
      lead: "Patru porți mari. Doar una e deschisă acum.",
      available: "Disponibil acum",
      soon: "În curând",
      continueHint: "Continuă în fluxul existent de creare.",
      choices: {
        drawing: { title: "Un desen", detail: "Pornim de la o pagină, o schiță sau o ilustrație." },
        photo: { title: "O fotografie", detail: "O poză de pe masă sau din album, transformată în poartă." },
        character: { title: "Un personaj", detail: "Alegi cine iese din pagină — din bibliotecă sau dintr-o idee." },
        idea: { title: "O idee", detail: "Cuvinte care vor deveni formă, când AI-ul va fi gata." }
      },
      promptLabel: "Imaginează ce apare din poză…",
      promptPlaceholder: "Un vulpoi de hârtie cu urechi din acuarelă…",
      promptNote: "În curând. Fără generare acum, fără chat, fără pretenții false."
    },
    library: {
      kicker: "Bibliotecă",
      title: "Biblioteca ta",
      lead: "Desene, personaje, sunete și lumi care așteaptă să prindă viață.",
      filtersLabel: "Filtre bibliotecă",
      filters: { all: "Toate", drawing: "Desene", character: "Personaje", sound: "Sunete", scene: "Scene" },
      assets: {
        whale: { title: "Balena de pe cer", meta: "Desen · privat" },
        fox: { title: "Vulpea din pădure", meta: "Personaj" },
        dragon: { title: "Dragon de hârtie", meta: "Personaj" },
        chime: { title: "Clopoțel moale", meta: "Sunet · 4s" },
        sticker: { title: "Abțibild de clasă", meta: "Scenă" },
        orchard: { title: "Livadă schițată", meta: "Desen · privat" }
      }
    },
    settings: {
      title: "Setări",
      body: "Utilitarele vin mai târziu. Aici rămâne un spațiu calm și dens, nu o scenă cinematică."
    }
  }
};
