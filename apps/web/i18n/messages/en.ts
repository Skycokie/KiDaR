import type { Messages } from "../types";

export const en: Messages = {
  brand: {
    playWith: "PLAY WITH",
    studio: "STUDIO",
    accessibleLabel: "kidAR — Play With Studio"
  },
  landing: {
    eyebrow: "PLAY WITH",
    title: "Your drawing comes to life.",
    description: "Turn a drawing into a figure you can discover in your world.",
    discoverCta: "Discover kidAR",
    studioCta: "Enter Studio",
    originalArtNote: "Original illustrations created for kidAR.",
    processTitle: "From a drawing, into a new world.",
    draw: "Draw",
    drawBody: "Create a character in your own style.",
    photograph: "Photograph",
    photographBody: "Keep the drawing clear, complete, and well lit.",
    discover: "Discover",
    discoverBody: "Look at the figure and explore it in your space.",
    closeTitle: "A small idea can become a big world.",
    enterCta: "Enter kidAR",
    revealFound3d: "Show the found object in 3D",
    spinDetective: "Lift and spin the yellow detective",
    returnToPhoto: "Send the object back into the picture"
  },
  auth: {
    title: "Enter kidAR",
    lead: "You only need an email address. No password.",
    emailLabel: "Email",
    emailPlaceholder: "name@example.com",
    submit: "Send sign-in link",
    submitting: "Sending…",
    invalidEmail: "Enter a valid email address.",
    sendError: "We couldn’t send the link. Check the address and try again.",
    sendMailError: "We couldn’t send the email. Check the address and try again.",
    checkEmail: "Check your email",
    checkEmailBody: "We sent you a sign-in link. Open the email and press the button to continue.",
    spamHint: "If you don’t see the message, check Spam or ask for a new link.",
    requestNewLink: "Request a new link",
    confirmTitle: "Confirm sign-in to kidAR",
    confirmBody: "Press the button to enter kidAR.",
    scannerProtection: "This confirmation stops email scanners from using the link before you do.",
    enter: "Enter kidAR",
    devOnly: "Only on this computer:",
    openLink: "open the sign-in link",
    studioAccount: "I already have a Studio account",
    confirmPageTitle: "Confirm sign-in",
    retryTitle: "Sign in again",
    linkMissing: "The sign-in link is missing or incomplete.",
    expiredTitle: "Link expired",
    linkUsedBeforeEnter: "This link was already used or has expired. Ask for a new one and press",
    linkUsedAfterEnter: "only once, from the most recent email.",
    sessionFailed: "We couldn’t start your session. Ask for a new link and try again.",
    unknownError: "Unknown error"
  },
  studio: {
    steps: {
      drawing: "Drawing",
      character: "Character",
      appearance: "Look",
      motion: "Motion",
      decor: "Decor",
      context: "Context",
      ar: "AR"
    },
    stepHints: {
      drawing: "Starting paper",
      character: "Lift the shape",
      appearance: "Light and color",
      motion: "Bring it to life",
      decor: "Place it in the world",
      context: "Build the story",
      ar: "Local preview"
    },
    previewOnly: "Local preview",
    demoPreview: "Demo preview",
    addDrawingFirst: "Add a drawing first to explore the scene.",
    applyPreview: "Apply to preview",
    resetScene: "Reset scene",
    arPreparing: "AR in preparation",
    skipToContent: "Skip to content"
  },
  prompt: {
    label: "Your idea for the figure",
    heading: "Tell the AI what you imagine",
    description: "Write an idea, and the preview changes here in Studio.",
    placeholder: "For example: I want my character to float among the stars.",
    apply: "Apply to preview",
    reset: "Reset idea",
    fallback: "You can then choose motion, decor, and colors in Studio.",
    empty: "Write an idea for the preview first.",
    resultTitle: "Chosen for the preview",
    suggestions: [
      "Float among the stars",
      "Dance in a garden",
      "Jump beside a colorful house",
      "Stay calm under a cloud",
      "Be in a world with balloons"
    ]
  },
  accessibility: {
    skipToContent: "Skip to content",
    languageSelector: "Language",
    menu: "Menu",
    close: "Close"
  },
  worlds: {
    metaDescription: "Your worlds — an editorial studio for AR surprises made from drawings.",
    noscript: "Turn on JavaScript to use Studio.",
    nav: {
      main: "Main",
      mobile: "Mobile",
      worlds: "Worlds",
      library: "Library",
      create: "Create",
      profile: "Profile"
    },
    atelier: {
      kicker: "Atelier",
      titleLine1: "Any picture can",
      titleLine2: "become a world.",
      lead: "Add a picture, choose what comes to life, and see it in AR.",
      startWithPhoto: "Start with a picture",
      seeWorlds: "See your worlds →",
      stepsLabel: "How it starts",
      stepPhoto: "Your picture",
      stepWorld: "Your world",
      stepPhone: "On your phone",
      heroLabel: "Picture → AR world"
    },
    gallery: {
      title: "Your worlds",
      lead: "Not a list of files — posters and covers made from your pictures.",
      startNew: "Start a new world →",
      loading: "Gathering your worlds…",
      error: "We couldn’t open your worlds right now. Try again.",
      retry: "Try again →",
      emptyTitle: "No worlds yet.",
      emptyBody: "Start with a picture — it will show up here as a poster, not a file.",
      quote: "“The picture becomes a gate.”",
      untitled: "Untitled world",
      updatedToday: "updated today",
      updatedYesterday: "updated yesterday",
      updatedOn: "updated {date}",
      status: { draft: "In progress", ready: "Ready", published: "Published" },
      fixtures: {
        aurora: { title: "Aurora", line: "A pencil dragon steps out of the night." },
        garden: { title: "The hidden garden", line: "The illustrated page opens like a gate." },
        kite: { title: "Paper kite", line: "An afternoon drawing, not finished yet." }
      }
    },
    create: {
      kicker: "Create",
      title: "What does the world start with?",
      lead: "Four big doors. Only one is open for now.",
      available: "Available now",
      soon: "Coming soon",
      continueHint: "Continue in the existing creation flow.",
      choices: {
        drawing: { title: "A drawing", detail: "We start from a page, a sketch, or an illustration." },
        photo: { title: "A photo", detail: "A picture from the table or an album, turned into a gate." },
        character: { title: "A character", detail: "Choose who steps out of the page — from the library or from an idea." },
        idea: { title: "An idea", detail: "Words that will take shape once the AI is ready." }
      },
      promptLabel: "Imagine what comes out of the picture…",
      promptPlaceholder: "A paper fox with watercolor ears…",
      promptNote: "Coming soon. No generation yet, no chat, no false promises."
    },
    library: {
      kicker: "Library",
      title: "Your library",
      lead: "Drawings, characters, sounds, and worlds waiting to come to life.",
      filtersLabel: "Library filters",
      filters: { all: "All", drawing: "Drawings", character: "Characters", sound: "Sounds", scene: "Scenes" },
      assets: {
        whale: { title: "The sky whale", meta: "Drawing · private" },
        fox: { title: "The forest fox", meta: "Character" },
        dragon: { title: "Paper dragon", meta: "Character" },
        chime: { title: "Soft chime", meta: "Sound · 4s" },
        sticker: { title: "Class sticker", meta: "Scene" },
        orchard: { title: "Sketched orchard", meta: "Drawing · private" }
      }
    },
    settings: {
      title: "Settings",
      body: "Tools come later. This stays a calm, focused space, not a cinematic stage."
    }
  }
};
