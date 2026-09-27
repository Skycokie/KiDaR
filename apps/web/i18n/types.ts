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
    revealFound3d: string;
    spinDetective: string;
    returnToPhoto: string;
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
    confirmPageTitle: string;
    retryTitle: string;
    linkMissing: string;
    expiredTitle: string;
    linkUsedBeforeEnter: string;
    linkUsedAfterEnter: string;
    sessionFailed: string;
    unknownError: string;
  };
  studio: {
    steps: {
      drawing: string;
      character: string;
      appearance: string;
      motion: string;
      decor: string;
      context: string;
      voice: string;
      ar: string;
    };
    stepHints: {
      drawing: string;
      character: string;
      appearance: string;
      motion: string;
      decor: string;
      context: string;
      voice: string;
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
  worlds: {
    metaDescription: string;
    noscript: string;
    nav: {
      main: string;
      mobile: string;
      worlds: string;
      library: string;
      create: string;
      profile: string;
    };
    atelier: {
      kicker: string;
      titleLine1: string;
      titleLine2: string;
      lead: string;
      startWithPhoto: string;
      seeWorlds: string;
      stepsLabel: string;
      stepPhoto: string;
      stepWorld: string;
      stepPhone: string;
      heroLabel: string;
    };
    gallery: {
      title: string;
      lead: string;
      startNew: string;
      loading: string;
      error: string;
      retry: string;
      emptyTitle: string;
      emptyBody: string;
      quote: string;
      untitled: string;
      updatedToday: string;
      updatedYesterday: string;
      /** `{date}` is replaced with a short localized date. */
      updatedOn: string;
      status: { draft: string; ready: string; published: string };
      fixtures: {
        aurora: { title: string; line: string };
        garden: { title: string; line: string };
        kite: { title: string; line: string };
      };
    };
    create: {
      kicker: string;
      title: string;
      lead: string;
      available: string;
      soon: string;
      continueHint: string;
      choices: {
        drawing: { title: string; detail: string };
        photo: { title: string; detail: string };
        character: { title: string; detail: string };
        idea: { title: string; detail: string };
      };
      promptLabel: string;
      promptPlaceholder: string;
      promptNote: string;
    };
    library: {
      kicker: string;
      title: string;
      lead: string;
      filtersLabel: string;
      filters: { all: string; drawing: string; character: string; sound: string; scene: string };
      assets: {
        whale: { title: string; meta: string };
        fox: { title: string; meta: string };
        dragon: { title: string; meta: string };
        chime: { title: string; meta: string };
        sticker: { title: string; meta: string };
        orchard: { title: string; meta: string };
      };
    };
    settings: { title: string; body: string };
  };
  creaza: {
    metaTitle: string;
    metaDescription: string;
    brandKicker: string;
    previewBadge: string;
    /** `{date}` is replaced with a long localized date. */
    surpriseName: string;
    /** `{current}` and `{total}` are replaced with step numbers. */
    progressLabel: string;
    steps: {
      preset: string;
      foto: string;
      experienta: string;
      confirmare: string;
    };
    preset: {
      title: string;
      lead: string;
      cta: string;
      ctaBusy: string;
      doorsLabel: string;
      doors: {
        coloring: { title: string; detail: string };
        story: { title: string; detail: string };
        mission: { title: string; detail: string };
      };
    };
    foto: {
      title: string;
      lead: string;
      dropEmpty: string;
      dropHint: string;
      dropSelected: string;
      dropLoading: string;
      dropDragOver: string;
      tips: readonly [string, string, string];
      cta: string;
      ctaBusy: string;
      back: string;
      /** `{name}` is replaced with the file name. */
      previewAlt: string;
      smallWarning: string;
      fixtureBarLabel: string;
      fixturePrefix: string;
      removePhoto: string;
      fixtureStates: { empty: string; dragOver: string; selected: string; error: string; loading: string };
    };
    experienta: {
      title: string;
      lead: string;
      cta: string;
      ctaBusy: string;
      back: string;
      soon: string;
      doors: {
        popout: { title: string; detail: string };
        gallery: { title: string; detail: string };
      };
    };
    confirmare: {
      title: string;
      lead: string;
      summaryPreset: string;
      summaryFoto: string;
      summaryScene: string;
      again: string;
      atelier: string;
      note: string;
      notChosen: string;
    };
    errors: {
      preset: { select: string; auth: string; quota: string; generic: string; ambiguous: string };
      photoInvalid: string;
      upload: {
        missingProject: string;
        missingPhoto: string;
        auth: string;
        notFound: string;
        generic: string;
        network: string;
      };
      scene: {
        missingProject: string;
        invalidScene: string;
        auth: string;
        notFound: string;
        generic: string;
        network: string;
      };
    };
  };
};
