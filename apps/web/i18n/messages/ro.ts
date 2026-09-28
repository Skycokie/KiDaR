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
      voice: "Vocea",
      ar: "AR"
    },
    stepHints: {
      drawing: "Hârtia de start",
      character: "Ridică forma",
      appearance: "Lumină și culoare",
      motion: "Dă viață",
      decor: "Așază în lume",
      context: "Construiește povestea",
      voice: "Mesaj și audio",
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
    metaDescription: "Continuă o lume sau începe o idee nouă.",
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
      kicker: "Studio",
      titleLine1: "Continuă o lume",
      titleLine2: "sau începe o idee nouă.",
      lead: "Alege un afiș ca să revii la idee, sau pornește o lume nouă dintr-o poză.",
      startWithPhoto: "Începe o idee nouă",
      seeWorlds: "Continuă o lume →",
      stepsLabel: "Cum începe",
      stepPhoto: "Poza ta",
      stepWorld: "Lumea ta",
      stepPhone: "Pe telefonul tău",
      heroLabel: "Poză → Lume AR"
    },
    gallery: {
      title: "Lumile tale",
      lead: "Apasă o lume ca să continui ideea — mișcare, decor, voce, figurină.",
      startNew: "Începe o idee nouă →",
      loading: "Îți adunăm lumile…",
      error: "Nu am putut deschide lumile tale acum. Reîncearcă.",
      retry: "Reîncearcă →",
      emptyTitle: "Nicio lume încă.",
      emptyBody: "Începe o idee nouă dintr-o poză — aici va apărea ca un afiș.",
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
  },
  creaza: {
    metaTitle: "Creează · kidAR",
    metaDescription: "Fotografiază un desen, alege scena, și fă pagina să prindă viață.",
    brandKicker: "kidAR · Creează",
    previewBadge: "Creează · 4 pași",
    surpriseName: "Surpriza din {date}",
    progressLabel: "Progres: pasul {current} din {total}",
    steps: {
      preset: "Pornire",
      foto: "Poză",
      experienta: "Scenă",
      confirmare: "Lume"
    },
    preset: {
      title: "Cu ce începe lumea?",
      lead: "Alegi un tip de desen. Apoi aduci o poză pe masă și îi dai o scenă.",
      cta: "Începe lumea",
      ctaBusy: "Pregătim surpriza…",
      doorsLabel: "Punct de pornire",
      doors: {
        coloring: {
          title: "Un desen colorat",
          detail: "Personaje, obiecte, pagini din caiet — orice linie care vrea să iasă din hârtie."
        },
        story: {
          title: "O pagină de poveste",
          detail: "Ilustrații din cărți și scene care pot deveni o poartă."
        },
        mission: {
          title: "O misiune",
          detail: "Indicii, chei și provocări pentru jocuri și clase."
        }
      }
    },
    foto: {
      title: "Așază poza pe masă",
      lead: "O fotografie clară a hârtiei. Fără ecrane, fără umbre grele.",
      dropEmpty: "Așază poza aici",
      dropHint: "JPG sau PNG · până la 10 MB",
      dropSelected: "Poza ta e pe masă",
      dropLoading: "Salvăm poza…",
      dropDragOver: "Trage poza aici",
      tips: ["Fotografiați pagina întreagă", "Lumină blândă, fără flash puternic", "Nu fotografiați un ecran"],
      cta: "Salvează poza și continuă",
      ctaBusy: "Salvăm poza…",
      back: "Înapoi",
      previewAlt: "Previzualizare poză: {name}",
      smallWarning: "Fotografia pare foarte mică — același avertisment ca în fluxul real.",
      fixtureBarLabel: "Stări fixture (opțional)",
      fixturePrefix: "Fixture:",
      removePhoto: "Elimină poza",
      fixtureStates: {
        empty: "Fără poză",
        dragOver: "Drag-over",
        selected: "Poză selectată",
        error: "Poză invalidă",
        loading: "Se salvează… (mock)"
      }
    },
    experienta: {
      title: "Cum vrei să prindă viață?",
      lead: "Alege scena pe această pagină. Se salvează pe lume doar când apeși butonul de mai jos.",
      cta: "Salvează scena și continuă",
      ctaBusy: "Salvăm scena…",
      back: "Înapoi la poză",
      soon: "În curând",
      doors: {
        popout: { title: "Iese din pagină", detail: "Ridicăm ce e important din desen — calm, clar, magic." },
        gallery: { title: "O figurină deasupra", detail: "Alegi un personaj sau un obiect care apare pe pagină." }
      }
    },
    confirmare: {
      title: "Lumea e gata de personalizat",
      lead: "Am păstrat alegerea ta. Continuă în Studio ca să dai formă personajului, sau începe alta.",
      summaryPreset: "Punct de pornire",
      summaryFoto: "Poză",
      summaryScene: "Scenă",
      again: "Începe altă lume",
      atelier: "Deschide Studio",
      note: "Draft-ul are începutul, poza și scena salvate. Următorul pas e Studio — personalizare pe scenă.",
      notChosen: "Neales"
    },
    errors: {
      preset: {
        select: "Alege cu ce începe lumea.",
        auth: "Trebuie să fii autentificat ca să începi lumea.",
        quota: "Ai folosit surprizele din planul gratuit. Poți folosi Studio pentru proiectele existente.",
        generic: "Nu am putut începe lumea. Încearcă din nou.",
        ambiguous:
          "Nu am putut confirma dacă lumea a fost creată. Verifică galeria lumilor înainte să încerci din nou — un retry automat ar putea crea un draft în plus."
      },
      photoInvalid: "Putem folosi doar fotografii JPG sau PNG, până la 10 MB.",
      upload: {
        missingProject: "Lumea nu este pregătită încă. Întoarce-te și apasă „Începe lumea”.",
        missingPhoto: "Alege mai întâi o poză JPG sau PNG.",
        auth: "Trebuie să fii autentificat ca să salvezi poza.",
        notFound: "Lumea nu mai este disponibilă.",
        generic: "Nu am putut salva poza. Încearcă din nou.",
        network: "Nu am putut salva poza. Verifică conexiunea și încearcă din nou."
      },
      scene: {
        missingProject: "Lumea nu este pregătită încă. Întoarce-te și apasă „Începe lumea”.",
        invalidScene: "Alege Popout ca să continui. Figurină vine în curând.",
        auth: "Trebuie să fii autentificat ca să salvezi scena.",
        notFound: "Lumea nu mai este disponibilă.",
        generic: "Nu am putut salva scena. Încearcă din nou.",
        network: "Nu am putut salva scena. Verifică conexiunea și încearcă din nou."
      }
    }
  }
};
