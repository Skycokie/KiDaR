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
    discoverCta: "Descoperă kiDAR",
    studioCta: "Intră în Studio",
    originalArtNote: "Ilustrații originale create pentru kiDAR.",
    processTitle: "Din desen, într-o lume nouă.",
    draw: "Desenează",
    drawBody: "Creează un personaj în stilul tău.",
    photograph: "Fotografiază",
    photographBody: "Păstrează desenul clar, întreg și bine luminat.",
    discover: "Descoperă",
    discoverBody: "Privește figurina și exploreaz-o în spațiul tău.",
    closeTitle: "O idee mică poate deveni o lume mare.",
    enterCta: "Intră în kiDAR"
  },
  auth: {
    title: "Intră în kiDAR",
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
    confirmTitle: "Confirmă intrarea în kiDAR",
    confirmBody: "Apasă butonul pentru a intra în kiDAR.",
    scannerProtection: "Confirmarea oprește scanerele de email să consume legătura înaintea ta.",
    enter: "Intră în kiDAR",
    devOnly: "Doar pe acest computer:",
    openLink: "deschide legătura de intrare",
    studioAccount: "Am deja un cont Studio"
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
  }
};
