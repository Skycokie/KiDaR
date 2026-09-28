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
      voice: "Voice",
      ar: "AR"
    },
    stepHints: {
      drawing: "Starting paper",
      character: "Lift the shape",
      appearance: "Light and color",
      motion: "Bring it to life",
      decor: "Place it in the world",
      context: "Build the story",
      voice: "Message and audio",
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
    metaDescription: "Continue a world or start a new idea.",
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
      kicker: "Studio",
      titleLine1: "Continue a world",
      titleLine2: "or start a new idea.",
      lead: "Pick a poster to return to the idea, or start a new world from a picture.",
      startWithPhoto: "Start a new idea",
      seeWorlds: "Continue a world →",
      stepsLabel: "How it starts",
      stepPhoto: "Your picture",
      stepWorld: "Your world",
      stepPhone: "On your phone",
      heroLabel: "Picture → AR world"
    },
    gallery: {
      title: "Your worlds",
      lead: "Open a world to continue the idea — motion, decor, voice, figure.",
      startNew: "Start a new idea →",
      loading: "Gathering your worlds…",
      error: "We couldn’t open your worlds right now. Try again.",
      retry: "Try again →",
      emptyTitle: "No worlds yet.",
      emptyBody: "Start a new idea from a picture — it will show up here as a poster.",
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
  },
  creaza: {
    metaTitle: "Create · kidAR",
    metaDescription: "Photograph a drawing, choose the scene, and bring the page to life.",
    brandKicker: "kidAR · Create",
    previewBadge: "Create · 4 steps",
    surpriseName: "Surprise from {date}",
    progressLabel: "Progress: step {current} of {total}",
    steps: {
      preset: "Start",
      foto: "Picture",
      experienta: "Scene",
      confirmare: "World"
    },
    preset: {
      title: "What does the world start with?",
      lead: "Choose a kind of drawing. Then put a picture on the table and give it a scene.",
      cta: "Start the world",
      ctaBusy: "Preparing the surprise…",
      doorsLabel: "Starting point",
      doors: {
        coloring: {
          title: "A colored drawing",
          detail: "Characters, objects, notebook pages — any line that wants to step off the paper."
        },
        story: {
          title: "A story page",
          detail: "Book illustrations and scenes that can become a gate."
        },
        mission: {
          title: "A mission",
          detail: "Clues, keys, and challenges for games and classrooms."
        }
      }
    },
    foto: {
      title: "Put the picture on the table",
      lead: "A clear photo of the paper. No screens, no heavy shadows.",
      dropEmpty: "Place the picture here",
      dropHint: "JPG or PNG · up to 10 MB",
      dropSelected: "Your picture is on the table",
      dropLoading: "Saving the picture…",
      dropDragOver: "Drop the picture here",
      tips: ["Photograph the whole page", "Soft light, no strong flash", "Don’t photograph a screen"],
      cta: "Save the picture and continue",
      ctaBusy: "Saving the picture…",
      back: "Back",
      previewAlt: "Picture preview: {name}",
      smallWarning: "The photo looks very small — the same warning as in the real flow.",
      fixtureBarLabel: "Fixture states (optional)",
      fixturePrefix: "Fixture:",
      removePhoto: "Remove picture",
      fixtureStates: {
        empty: "No picture",
        dragOver: "Drag-over",
        selected: "Picture selected",
        error: "Invalid picture",
        loading: "Saving… (mock)"
      }
    },
    experienta: {
      title: "How should it come to life?",
      lead: "Choose the scene on this page. It is saved to the world only when you press the button below.",
      cta: "Save the scene and continue",
      ctaBusy: "Saving the scene…",
      back: "Back to the picture",
      soon: "Coming soon",
      doors: {
        popout: { title: "Pops off the page", detail: "We lift what matters from the drawing — calm, clear, magical." },
        gallery: { title: "A figure on top", detail: "Choose a character or object that appears on the page." }
      }
    },
    confirmare: {
      title: "The world is ready to personalize",
      lead: "We kept your choice. Continue in Studio to shape the character, or start another one.",
      summaryPreset: "Starting point",
      summaryFoto: "Picture",
      summaryScene: "Scene",
      again: "Start another world",
      atelier: "Open Studio",
      note: "The draft has its start, picture, and scene saved. Next comes Studio — personalizing on stage.",
      notChosen: "Not chosen"
    },
    errors: {
      preset: {
        select: "Choose what the world starts with.",
        auth: "You need to be signed in to start the world.",
        quota: "You’ve used the surprises in the free plan. You can still use Studio for existing projects.",
        generic: "We couldn’t start the world. Try again.",
        ambiguous:
          "We couldn’t confirm whether the world was created. Check your worlds before trying again — an automatic retry could create an extra draft."
      },
      photoInvalid: "We can only use JPG or PNG photos, up to 10 MB.",
      upload: {
        missingProject: "The world isn’t ready yet. Go back and press “Start the world”.",
        missingPhoto: "Choose a JPG or PNG picture first.",
        auth: "You need to be signed in to save the picture.",
        notFound: "This world is no longer available.",
        generic: "We couldn’t save the picture. Try again.",
        network: "We couldn’t save the picture. Check your connection and try again."
      },
      scene: {
        missingProject: "The world isn’t ready yet. Go back and press “Start the world”.",
        invalidScene: "Choose Pop-out to continue. Figure is coming soon.",
        auth: "You need to be signed in to save the scene.",
        notFound: "This world is no longer available.",
        generic: "We couldn’t save the scene. Try again.",
        network: "We couldn’t save the scene. Check your connection and try again."
      }
    }
  }
};
