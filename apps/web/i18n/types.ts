export type Messages = {
  brand: {
    playWith: string;
    studio: string;
    accessibleLabel: string;
  };
  landing: {
    eyebrow: string;
    title: string;
    description: string;
    discoverCta: string;
    studioCta: string;
    originalArtNote: string;
    processTitle: string;
    draw: string;
    drawBody: string;
    photograph: string;
    photographBody: string;
    discover: string;
    discoverBody: string;
    closeTitle: string;
    enterCta: string;
  };
  auth: {
    title: string;
    lead: string;
    emailLabel: string;
    emailPlaceholder: string;
    submit: string;
    submitting: string;
    invalidEmail: string;
    sendError: string;
    sendMailError: string;
    checkEmail: string;
    checkEmailBody: string;
    spamHint: string;
    requestNewLink: string;
    confirmTitle: string;
    confirmBody: string;
    scannerProtection: string;
    enter: string;
    devOnly: string;
    openLink: string;
    studioAccount: string;
  };
  studio: {
    steps: {
      drawing: string;
      character: string;
      appearance: string;
      motion: string;
      decor: string;
      context: string;
      ar: string;
    };
    stepHints: {
      drawing: string;
      character: string;
      appearance: string;
      motion: string;
      decor: string;
      context: string;
      ar: string;
    };
    previewOnly: string;
    demoPreview: string;
    addDrawingFirst: string;
    applyPreview: string;
    resetScene: string;
    arPreparing: string;
    skipToContent: string;
  };
  prompt: {
    label: string;
    heading: string;
    description: string;
    placeholder: string;
    apply: string;
    reset: string;
    fallback: string;
    empty: string;
    resultTitle: string;
    suggestions: readonly [string, string, string, string, string];
  };
  accessibility: {
    skipToContent: string;
    languageSelector: string;
    menu: string;
    close: string;
  };
};
