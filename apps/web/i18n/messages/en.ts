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
    discoverCta: "Discover kiDAR",
    studioCta: "Enter Studio",
    originalArtNote: "Original illustrations created for kiDAR.",
    processTitle: "From a drawing, into a new world.",
    draw: "Draw",
    drawBody: "Create a character in your own style.",
    photograph: "Photograph",
    photographBody: "Keep the drawing clear, complete, and well lit.",
    discover: "Discover",
    discoverBody: "Look at the figure and explore it in your space.",
    closeTitle: "A small idea can become a big world.",
    enterCta: "Enter kiDAR"
  },
  auth: {
    title: "Enter kiDAR",
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
    confirmTitle: "Confirm sign-in to kiDAR",
    confirmBody: "Press the button to enter kiDAR.",
    scannerProtection: "This confirmation stops email scanners from using the link before you do.",
    enter: "Enter kiDAR",
    devOnly: "Only on this computer:",
    openLink: "open the sign-in link",
    studioAccount: "I already have a Studio account"
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
  }
};
