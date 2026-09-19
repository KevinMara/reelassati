export type GuideLanguage = "en" | "it";
type GuideText = Record<GuideLanguage, string>;

export interface PageGuideSection {
  title: GuideText;
  body: GuideText;
}

export interface PageGuide {
  title: GuideText;
  description: GuideText;
  sections: PageGuideSection[];
  shortcuts?: Array<{ keys: string; action: GuideText }>;
}

const text = (en: string, it: string): GuideText => ({ en, it });
const section = (
  enTitle: string,
  itTitle: string,
  enBody: string,
  itBody: string
): PageGuideSection => ({
  title: text(enTitle, itTitle),
  body: text(enBody, itBody),
});

const interview: PageGuide = {
  title: text("Interview me", "Intervistami"),
  description: text(
    "Turn your own experience into a script through a guided conversation.",
    "Trasforma la tua esperienza in uno script con una conversazione guidata."
  ),
  sections: [
    section(
      "Set the subject",
      "Scegli l’argomento",
      "Describe the idea, audience, and outcome. Concrete experiences give the interview more useful material than broad claims.",
      "Descrivi idea, pubblico e obiettivo. Le esperienze concrete danno all’intervista più materiale utile delle affermazioni generiche."
    ),
    section(
      "Answer the follow-ups",
      "Rispondi alle domande",
      "Answer each question in your own words. Include examples, turning points, and what changed for you.",
      "Rispondi con parole tue. Includi esempi, momenti decisivi e cosa è cambiato per te."
    ),
    section(
      "Shape the draft",
      "Rivedi la bozza",
      "Review the generated hook, body, and ending. Check factual claims, then save the script or continue refining it.",
      "Rivedi apertura, corpo e finale. Verifica i fatti, poi salva lo script o continua a migliorarlo."
    ),
  ],
};

const feedback: PageGuide = {
  title: text("Feedback & bugs", "Feedback e problemi"),
  description: text(
    "Send a reproducible issue or a focused product suggestion.",
    "Invia un problema riproducibile o un suggerimento concreto."
  ),
  sections: [
    section(
      "Describe the outcome",
      "Descrivi il risultato",
      "Say which page you used, what you expected, and what actually happened. Include the action that triggered the issue.",
      "Indica la pagina, cosa ti aspettavi e cosa è successo. Includi l’azione che ha causato il problema."
    ),
    section(
      "Add useful context",
      "Aggiungi il contesto",
      "Include the project or file name and any error message. Keep passwords and API keys out of the report.",
      "Includi il nome del progetto o del file e l’eventuale messaggio di errore. Non inserire password o chiavi API."
    ),
    section(
      "Send one clear request",
      "Invia una richiesta chiara",
      "For a suggestion, describe the task you are trying to finish and how the change would help. Review the form before sending.",
      "Per un suggerimento, descrivi il lavoro che vuoi completare e come ti aiuterebbe la modifica. Rivedi il modulo prima di inviarlo."
    ),
  ],
};

const guides: Record<string, PageGuide> = {
  "/dashboard": {
    title: text("Your studio", "Il tuo studio"),
    description: text(
      "Start a project, continue recent work, or check what needs attention.",
      "Inizia un progetto, riprendi il lavoro o controlla cosa richiede attenzione."
    ),
    sections: [
      section(
        "Choose your brand",
        "Scegli il brand",
        "Use the brand switcher in the sidebar before working. Brand DNA holds the audience, voice, and visual direction for that brand.",
        "Usa il selettore del brand nella barra laterale prima di iniziare. Brand DNA contiene pubblico, tono e direzione visiva del brand."
      ),
      section(
        "Start with a task",
        "Parti da un obiettivo",
        "Use the quick actions to write a script, create media, analyze footage, or open the editing studio. The sidebar keeps these tools available.",
        "Usa le azioni rapide per scrivere, generare media, analizzare un video o aprire l’editor. Gli strumenti restano disponibili nella barra laterale."
      ),
      section(
        "Pick up where you left off",
        "Riprendi da dove eri",
        "Recent activity links back to your work. The top bar opens your media and credit balance; each page has its own Guide.",
        "L’attività recente ti riporta al tuo lavoro. Dalla barra superiore apri media e saldo crediti; ogni pagina ha la propria Guida."
      ),
    ],
  },
  "/dashboard/edit": {
    title: text("Editing studio", "Studio di montaggio"),
    description: text(
      "Your media on the left, preview in the center, Reel on the right, and the timeline below.",
      "Media a sinistra, anteprima al centro, Reel a destra e timeline in basso."
    ),
    sections: [
      section(
        "Start with your files",
        "Inizia dai tuoi file",
        "Open or create a project. Upload into Library, then drag a file to the exact time where it should begin. Preview, rename, sort, or organize files in folders before placing them.",
        "Apri o crea un progetto. Carica nella Libreria e trascina il file nel punto della timeline in cui deve iniziare. Puoi vedere l’anteprima, rinominare, ordinare o organizzare i file in cartelle."
      ),
      section(
        "Create without losing your place",
        "Crea senza interrompere il lavoro",
        "The left tools hold Video, Image, Audio, Captions, and Graphics. Generated media appear as individual files with their own status; drag the finished result onto the timeline when you need it.",
        "A sinistra trovi Video, Immagini, Audio, Sottotitoli e Grafica. I media generati diventano file separati, ciascuno con il proprio stato; trascina il risultato pronto nella timeline quando ti serve."
      ),
      section(
        "Edit the selected clip",
        "Modifica la clip selezionata",
        "Click a clip to select it and move the playhead. Use its adjustments to refine it, drag its edges to trim, and use Split or Duplicate for another version. Higher numbered video tracks appear in front of lower ones.",
        "Clicca una clip per selezionarla e spostare la testina. Usa le sue regolazioni, trascina i bordi per accorciarla e usa Dividi o Duplica per un’altra versione. Le tracce video con numero maggiore appaiono davanti a quelle inferiori."
      ),
      section(
        "Direct Reel in plain language",
        "Dirigi Reel con parole tue",
        "Tell Reel the result you want, such as “Add captions and a title for the first three seconds.” Use + or drop a reference into the chat for context. You can name a time range in your request.",
        "Descrivi a Reel il risultato, ad esempio “Aggiungi sottotitoli e un titolo nei primi tre secondi”. Usa + o trascina un riferimento nella chat per aggiungere contesto. Puoi indicare un intervallo di tempo nella richiesta."
      ),
      section(
        "Choose how extras are handled",
        "Scegli come gestire le aggiunte",
        "Ask-first mode requests approval for optional additions beyond your brief. Auto mode allows those extras. Requested work and its necessary steps do not need repeated approval; paid actions still use the displayed credit limits.",
        "La modalità con conferma chiede il permesso per aggiunte facoltative oltre la richiesta. La modalità automatica le consente. Il lavoro richiesto e i passaggi necessari non richiedono conferme ripetute; le azioni a pagamento rispettano i limiti di crediti mostrati."
      ),
      section(
        "Refine, review, and export",
        "Rifinisci, rivedi ed esporta",
        "Play the whole edit, check caption timing and audio, and adjust project format and duration before export. Undo and Redo recover editing changes. Export creates a video file; it does not publish to your social accounts.",
        "Riproduci tutto il montaggio, controlla tempi dei sottotitoli e audio, poi regola formato e durata del progetto prima dell’esportazione. Annulla e Ripeti recuperano le modifiche. Esporta crea un file video; non pubblica sui social."
      ),
    ],
    shortcuts: [
      { keys: "Space", action: text("Play / pause", "Riproduci / pausa") },
      {
        keys: "S",
        action: text(
          "Split selected clip at playhead",
          "Dividi la clip selezionata alla testina"
        ),
      },
      {
        keys: "Delete / ⌫",
        action: text("Delete selected clip", "Elimina la clip selezionata"),
      },
      {
        keys: "Ctrl / ⌘ + C",
        action: text("Copy selected clip", "Copia la clip selezionata"),
      },
      {
        keys: "Ctrl / ⌘ + X",
        action: text("Cut selected clip", "Taglia la clip selezionata"),
      },
      {
        keys: "Ctrl / ⌘ + V",
        action: text("Paste at playhead", "Incolla alla testina"),
      },
      {
        keys: "Ctrl / ⌘ + D",
        action: text("Duplicate selected clip", "Duplica la clip selezionata"),
      },
      { keys: "Ctrl / ⌘ + Z", action: text("Undo", "Annulla") },
      {
        keys: "Ctrl / ⌘ + Shift + Z",
        action: text("Redo (also Ctrl + Y)", "Ripeti (anche Ctrl + Y)"),
      },
      {
        keys: "← / →",
        action: text(
          "Move playhead by 1/30 second",
          "Sposta la testina di 1/30 di secondo"
        ),
      },
      {
        keys: "Shift + ← / →",
        action: text(
          "Move playhead by one second",
          "Sposta la testina di un secondo"
        ),
      },
    ],
  },
  "/dashboard/trends": {
    title: text("Trends", "Tendenze"),
    description: text(
      "Research formats and sources, then turn evidence into a testable idea.",
      "Studia formati e fonti, poi trasforma le evidenze in un’idea da provare."
    ),
    sections: [
      section(
        "Define the research",
        "Definisci la ricerca",
        "Choose a platform and describe your niche, audience, or question. Narrow briefs return more relevant material than “what is viral?” alone.",
        "Scegli una piattaforma e descrivi nicchia, pubblico o domanda. Un obiettivo preciso produce materiale più pertinente di un generico “cosa è virale?”."
      ),
      section(
        "Inspect the source",
        "Controlla la fonte",
        "Open a result and review its source link, date, and available evidence. A hypothesis is a proposed test, not proof that a format will perform.",
        "Apri un risultato e controlla link, data ed evidenze disponibili. Un’ipotesi è un test proposto, non la prova che un formato funzionerà."
      ),
      section(
        "Build a controlled test",
        "Prepara un test controllato",
        "Save the useful format and define one change to test, such as the opening or pacing. Use workspace source material to connect the idea to your own content.",
        "Salva il formato utile e definisci una sola modifica da provare, come apertura o ritmo. Usa il materiale dello studio per collegare l’idea ai tuoi contenuti."
      ),
    ],
  },
  "/dashboard/script": {
    title: text("Script Generator", "Generatore di script"),
    description: text(
      "Build a clear hook, useful middle, and ending that fits your audience.",
      "Costruisci un’apertura chiara, un corpo utile e un finale adatto al pubblico."
    ),
    sections: [
      section(
        "Choose your starting point",
        "Scegli da dove partire",
        "Write from a brief for a defined idea, or choose Interview me to develop it through questions. Set the audience, goal, and intended length.",
        "Parti da un brief per un’idea definita oppure scegli Intervistami per svilupparla con domande. Imposta pubblico, obiettivo e durata."
      ),
      section(
        "Give the draft substance",
        "Dai sostanza alla bozza",
        "Include your specific example, evidence, and intended takeaway. Describe the tone you want and any facts or promises the script must avoid.",
        "Includi un esempio concreto, le prove e il messaggio da lasciare. Descrivi il tono desiderato e fatti o promesse da evitare."
      ),
      section(
        "Review and reuse",
        "Rivedi e riutilizza",
        "Read the script aloud to check the pacing. Edit claims and wording, then save it for your next recording or editing project. Recent drafts keep previous work within reach.",
        "Leggi lo script ad alta voce per controllare il ritmo. Rivedi fatti e parole, poi salvalo per registrazione o montaggio. Le bozze recenti mantengono il lavoro a portata di mano."
      ),
    ],
  },
  "/dashboard/video": {
    title: text("Prompt Director", "Prompt Director"),
    description: text(
      "Generate a directed shot with a clear subject, action, and camera plan.",
      "Genera una ripresa con soggetto, azione e camera ben definiti."
    ),
    sections: [
      section(
        "Describe the shot",
        "Descrivi la ripresa",
        "Name the subject, setting, action, and visual style. For a timed sequence, say what should happen first and what changes next.",
        "Indica soggetto, ambiente, azione e stile visivo. Per una sequenza temporizzata, spiega cosa succede prima e cosa cambia dopo."
      ),
      section(
        "Set output and continuity",
        "Imposta risultato e continuità",
        "Check the available format, duration, and audio controls. Where a reference or continuity control is offered, use it to keep the next shot consistent.",
        "Controlla formato, durata e audio disponibili. Quando sono presenti riferimenti o controlli di continuità, usali per rendere coerente la ripresa successiva."
      ),
      section(
        "Follow the generation",
        "Segui la generazione",
        "Review the credit cost before starting. Check the job status and the finished clip before using it; a generated file can be reused from Library.",
        "Rivedi il costo in crediti prima di iniziare. Controlla lo stato e il video pronto prima di usarlo; il file generato è riutilizzabile dalla Libreria."
      ),
    ],
  },
  "/dashboard/image": {
    title: text("Create a visual", "Crea un’immagine"),
    description: text(
      "Create an image for a scene, cover, campaign, or visual reference.",
      "Crea un’immagine per una scena, copertina, campagna o riferimento visivo."
    ),
    sections: [
      section(
        "Describe the composition",
        "Descrivi la composizione",
        "Specify the subject, framing, background, lighting, and style. Include exact words only when the image needs text.",
        "Specifica soggetto, inquadratura, sfondo, luce e stile. Includi parole esatte solo se servono nell’immagine."
      ),
      section(
        "Choose the output",
        "Scegli il risultato",
        "Set the image format for where it will be used. Review the displayed credit cost and any available reference settings before generating.",
        "Imposta il formato in base all’uso previsto. Rivedi il costo in crediti e le eventuali impostazioni di riferimento prima di generare."
      ),
      section(
        "Inspect and save",
        "Controlla e salva",
        "Check details, text, and composition in the result. Find recent images here or reuse the saved file from Library in an edit.",
        "Controlla dettagli, testo e composizione nel risultato. Ritrova qui le immagini recenti o usa il file salvato nella Libreria per un montaggio."
      ),
    ],
  },
  "/dashboard/voice": {
    title: text("Voice to Content", "Dalla voce al contenuto"),
    description: text(
      "Transcribe a voice note, shape it into a script, or generate a spoken track.",
      "Trascrivi una nota vocale, trasformala in script o genera una traccia parlata."
    ),
    sections: [
      section(
        "Bring a recording",
        "Aggiungi una registrazione",
        "Upload an audio file or choose a saved source. Transcribe it, then review names and wording before using the text.",
        "Carica un file audio o scegli una fonte salvata. Trascrivilo, poi controlla nomi e parole prima di usare il testo."
      ),
      section(
        "Shape the message",
        "Definisci il messaggio",
        "Use the transcript as material for a short-form script. Give the script a clear audience and outcome rather than keeping every spoken detour.",
        "Usa la trascrizione come materiale per uno script breve. Definisci pubblico e obiettivo invece di conservare ogni digressione del parlato."
      ),
      section(
        "Choose a voice by listening",
        "Scegli la voce ascoltandola",
        "In speech synthesis, filter voices and languages, read their tags, and play a sample. Generate from the final text after reviewing the credit cost, then use the audio file in your edit.",
        "Nella sintesi vocale filtra voci e lingue, leggi le descrizioni e ascolta un esempio. Genera dal testo finale dopo aver controllato il costo, poi usa il file audio nel montaggio."
      ),
    ],
  },
  "/dashboard/analyze": {
    title: text("Video Analyzer", "Analisi video"),
    description: text(
      "Understand the footage and turn time-specific findings into an edit plan.",
      "Comprendi il video e trasforma le osservazioni temporali in un piano di montaggio."
    ),
    sections: [
      section(
        "Choose the source",
        "Scegli la fonte",
        "Select a workspace video, upload footage, or use a supported public video link. If a link cannot be read, upload the file you can access.",
        "Seleziona un video dello studio, caricalo o usa un link pubblico supportato. Se il link non è leggibile, carica il file a cui hai accesso."
      ),
      section(
        "Ask a focused question",
        "Fai una domanda precisa",
        "Describe the audience and what you want to improve: hook, clarity, pace, or another editing goal. Review the displayed cost before analysis.",
        "Descrivi il pubblico e cosa migliorare: apertura, chiarezza, ritmo o un altro obiettivo. Controlla il costo mostrato prima dell’analisi."
      ),
      section(
        "Review before applying",
        "Rivedi prima di applicare",
        "Read the evidence and time ranges behind the suggestions. Queue useful changes in a project, then review the result in the editor.",
        "Leggi evidenze e intervalli temporali dietro i suggerimenti. Porta le modifiche utili in un progetto, poi rivedi il risultato nell’editor."
      ),
    ],
  },
  "/dashboard/library": {
    title: text("Content Library", "Libreria contenuti"),
    description: text(
      "Find and organize footage, generated files, exports, and saved scripts.",
      "Trova e organizza riprese, file generati, esportazioni e script salvati."
    ),
    sections: [
      section(
        "Find the right file",
        "Trova il file giusto",
        "Use search and type filters to narrow the library. Preview the asset to check its content before reusing it.",
        "Usa ricerca e filtri per tipo per restringere la libreria. Visualizza l’anteprima prima di riutilizzare il file."
      ),
      section(
        "Keep files recognizable",
        "Rendi i file riconoscibili",
        "Give files descriptive names and use the available folders and favorites. Keep source footage distinct from final exports.",
        "Dai ai file nomi descrittivi e usa cartelle e preferiti disponibili. Distingui le riprese originali dalle esportazioni finali."
      ),
      section(
        "Use a file in your workflow",
        "Usa un file nel lavoro",
        "Open the editor and drag the file from its Library panel to a specific time. Use a finished export when preparing a publication.",
        "Apri l’editor e trascina il file dal pannello Libreria in un punto preciso. Usa un’esportazione pronta quando prepari una pubblicazione."
      ),
    ],
  },
  "/dashboard/publish": {
    title: text("Publisher", "Pubblicazione"),
    description: text(
      "Prepare, review, and send a post to your connected accounts.",
      "Prepara, rivedi e invia un post ai tuoi account collegati."
    ),
    sections: [
      section(
        "Choose the destination",
        "Scegli la destinazione",
        "Select the connected accounts that should receive the post. Connect or repair an account in Social Hub if it is unavailable.",
        "Seleziona gli account collegati che devono ricevere il post. Collega o ripristina un account nel Social Hub se non è disponibile."
      ),
      section(
        "Prepare the post",
        "Prepara il post",
        "Choose a finished asset, write the caption and hashtags, and review the platform preview. Complete the release questions shown for that content.",
        "Scegli un file finale, scrivi testo e hashtag e controlla l’anteprima della piattaforma. Completa le domande di pubblicazione mostrate per il contenuto."
      ),
      section(
        "Save, schedule, or publish",
        "Salva, programma o pubblica",
        "Save a draft while refining the post. For scheduling, check the date, time, and timezone. Follow the returned status; a scheduled or submitted post is not yet proof of publication.",
        "Salva una bozza mentre rifinisci il post. Per programmarlo, controlla data, ora e fuso orario. Segui lo stato restituito: un post programmato o inviato non è ancora una pubblicazione confermata."
      ),
    ],
  },
  "/dashboard/analytics": {
    title: text("Analytics", "Statistiche"),
    description: text(
      "Review available performance evidence and publication history.",
      "Consulta i dati disponibili sulle prestazioni e lo storico delle pubblicazioni."
    ),
    sections: [
      section(
        "Choose the scope",
        "Scegli l’ambito",
        "Use the available account and period controls to compare the same scope. Check when the information was last synced.",
        "Usa i controlli per account e periodo per confrontare lo stesso ambito. Controlla quando i dati sono stati sincronizzati."
      ),
      section(
        "Read missing data correctly",
        "Interpreta i dati mancanti",
        "Audience or engagement metrics appear only when the connection provides them. An unavailable value is not a measured zero.",
        "I dati di pubblico e interazione compaiono solo quando forniti dal collegamento. Un valore non disponibile non equivale a uno zero misurato."
      ),
      section(
        "Turn evidence into a next step",
        "Trasforma i dati in un’azione",
        "Compare posts and publication history, then choose one improvement for the next piece. Use Goals or Weekly Review to keep that action visible.",
        "Confronta post e storico, poi scegli un miglioramento per il contenuto successivo. Usa Obiettivi o Revisione settimanale per mantenerlo visibile."
      ),
    ],
  },
  "/dashboard/clients": {
    title: text("Brand DNA", "Brand DNA"),
    description: text(
      "Keep each brand’s audience, voice, visual identity, and editing defaults together.",
      "Riunisci pubblico, tono, identità visiva e impostazioni di montaggio di ogni brand."
    ),
    sections: [
      section(
        "Choose the brand",
        "Scegli il brand",
        "Open the brand you want to edit or create a new one. Confirm the active brand before changing its defaults.",
        "Apri il brand da modificare o creane uno. Controlla il brand attivo prima di cambiarne le impostazioni."
      ),
      section(
        "Describe what makes it specific",
        "Descrivi ciò che lo distingue",
        "Fill in positioning, audience, and voice using concrete examples. Add the colors, visual references, and editing preferences that should stay consistent.",
        "Compila posizionamento, pubblico e tono con esempi concreti. Aggiungi colori, riferimenti visivi e preferenze di montaggio da mantenere coerenti."
      ),
      section(
        "Save and use the context",
        "Salva e usa il contesto",
        "Save the changes, then select that brand before writing or creating. Project-specific instructions can still refine the result.",
        "Salva le modifiche e seleziona il brand prima di scrivere o creare. Le istruzioni del singolo progetto possono ancora precisare il risultato."
      ),
    ],
  },
  "/dashboard/calendar": {
    title: text("Content Calendar", "Calendario contenuti"),
    description: text(
      "See dated posts and plan the work around them.",
      "Visualizza i post datati e pianifica il lavoro necessario."
    ),
    sections: [
      section(
        "Find the date",
        "Trova la data",
        "Move between months or return to today. Select a day to see its items; filters separate your events from publications.",
        "Spostati tra i mesi o torna a oggi. Seleziona un giorno per vederne gli elementi; i filtri separano eventi e pubblicazioni."
      ),
      section(
        "Plan a work session",
        "Pianifica il lavoro",
        "Add an event with its title, date, and details. Edit or remove your event from its card when the plan changes.",
        "Aggiungi un evento con titolo, data e dettagli. Modifica o rimuovi l’evento dalla scheda quando cambia il piano."
      ),
      section(
        "Manage the actual post",
        "Gestisci il post effettivo",
        "Open a publication in Publisher to change its draft or schedule. A calendar event plans work; it does not publish a post. Check the displayed workspace timezone.",
        "Apri una pubblicazione in Publisher per modificarne bozza o programmazione. Un evento pianifica il lavoro; non pubblica un post. Controlla il fuso orario dello studio."
      ),
    ],
  },
  "/dashboard/social": {
    title: text("Social Hub", "Social Hub"),
    description: text(
      "Connect the accounts your studio will use for publishing and available metrics.",
      "Collega gli account da usare per pubblicazione e statistiche disponibili."
    ),
    sections: [
      section(
        "Connect an account",
        "Collega un account",
        "Choose the platform and complete its authorization flow. Check the account name when you return to the studio.",
        "Scegli la piattaforma e completa l’autorizzazione. Controlla il nome dell’account al ritorno nello studio."
      ),
      section(
        "Check connection status",
        "Controlla il collegamento",
        "Review each account’s status and reconnect when requested. Available platforms and account limits are shown in the interface.",
        "Controlla lo stato degli account e ricollegali quando richiesto. Piattaforme disponibili e limiti sono mostrati nell’interfaccia."
      ),
      section(
        "Use connected accounts",
        "Usa gli account collegati",
        "Go to Publisher to select destinations for a post. Disconnect an account only when you no longer want the studio to use that connection.",
        "Vai in Publisher per scegliere le destinazioni di un post. Scollega un account quando non vuoi più usare quel collegamento nello studio."
      ),
    ],
  },
  "/dashboard/settings": {
    title: text("Settings", "Impostazioni"),
    description: text(
      "Manage your profile, brand defaults, appearance, and available capabilities.",
      "Gestisci profilo, impostazioni del brand, aspetto e funzioni disponibili."
    ),
    sections: [
      section(
        "Set studio preferences",
        "Imposta le preferenze",
        "In Studio profile, review your details and timezone. Save changes before leaving the section.",
        "Nel profilo dello studio controlla i dati e il fuso orario. Salva le modifiche prima di lasciare la sezione."
      ),
      section(
        "Keep brand and appearance separate",
        "Distingui brand e aspetto",
        "Brand DNA controls creative defaults. Appearance changes how the studio looks for you, including the light or dark theme.",
        "Brand DNA regola le impostazioni creative. Aspetto cambia la visualizzazione dello studio, incluso il tema chiaro o scuro."
      ),
      section(
        "Check tool availability",
        "Controlla le funzioni",
        "Capabilities shows which services are connected. If a tool is unavailable, use the status information when asking support for help.",
        "Funzioni mostra quali servizi sono collegati. Se uno strumento non è disponibile, usa le informazioni di stato quando chiedi assistenza."
      ),
    ],
  },
  "/dashboard/goals": {
    title: text("Goal Tracker", "Obiettivi"),
    description: text(
      "Turn a content ambition into a measurable target and track progress.",
      "Trasforma un obiettivo di contenuto in un traguardo misurabile e segui i progressi."
    ),
    sections: [
      section(
        "Create a measurable goal",
        "Crea un obiettivo misurabile",
        "Choose a clear metric, target, and deadline. A concrete goal such as finishing four edits is easier to act on than “grow faster”.",
        "Scegli una metrica, un traguardo e una scadenza chiari. Un obiettivo come completare quattro montaggi è più concreto di “crescere più in fretta”."
      ),
      section(
        "Keep progress current",
        "Aggiorna i progressi",
        "Review the current value and update it with real results. Edit a goal when its scope changes rather than leaving an outdated target.",
        "Controlla il valore attuale e aggiornalo con risultati reali. Modifica l’obiettivo quando cambia l’ambito, invece di lasciare un traguardo superato."
      ),
      section(
        "Review the next action",
        "Scegli la prossima azione",
        "Use your active goals alongside Weekly Review to decide what to finish next.",
        "Usa gli obiettivi attivi insieme alla Revisione settimanale per decidere cosa completare dopo."
      ),
    ],
  },
  "/dashboard/coaching": {
    title: text("Weekly Review", "Revisione settimanale"),
    description: text(
      "Review recent studio activity and choose the next useful action.",
      "Rivedi l’attività recente dello studio e scegli la prossima azione utile."
    ),
    sections: [
      section(
        "Refresh the evidence",
        "Aggiorna le evidenze",
        "Refresh the review to use the latest workspace activity. The review covers projects, drafts, publications, and active goals.",
        "Aggiorna la revisione per usare l’attività più recente. La revisione considera progetti, bozze, pubblicazioni e obiettivi attivi."
      ),
      section(
        "Read the recommendation in context",
        "Leggi il consiglio nel contesto",
        "Open the evidence behind the next steps. Activity counts describe work done in the studio; they do not replace social performance metrics.",
        "Controlla le evidenze dietro le prossime azioni. I conteggi descrivono il lavoro nello studio; non sostituiscono le prestazioni social."
      ),
      section(
        "Finish one useful step",
        "Completa un passaggio utile",
        "Choose a specific action, such as finishing an edit or preparing a draft, then follow the relevant tool link.",
        "Scegli un’azione specifica, come finire un montaggio o preparare una bozza, e apri lo strumento relativo."
      ),
    ],
  },
  "/dashboard/referral": {
    title: text("Refer & Earn", "Invita e guadagna"),
    description: text(
      "Share your creator link and follow verified referral rewards.",
      "Condividi il link creator e segui i premi degli inviti verificati."
    ),
    sections: [
      section(
        "Share the right link",
        "Condividi il link giusto",
        "Copy your personal creator link or use the share control. Keep the referral code in the link so the signup can be attributed.",
        "Copia il link creator personale o usa Condividi. Mantieni il codice nel link per attribuire correttamente la registrazione."
      ),
      section(
        "Read the reward status",
        "Leggi lo stato del premio",
        "Check the displayed qualification rules and reward history. A signup and a verified reward are different stages.",
        "Controlla le condizioni mostrate e lo storico dei premi. Registrazione e premio verificato sono fasi diverse."
      ),
      section(
        "Apply a creator code",
        "Applica un codice creator",
        "If you received a code, enter it in the claim section and read the confirmation or eligibility message.",
        "Se hai ricevuto un codice, inseriscilo nell’apposita sezione e leggi il messaggio di conferma o di idoneità."
      ),
    ],
  },
  "/dashboard/billing": {
    title: text("Plan & credits", "Piano e crediti"),
    description: text(
      "Review your plan, available credits, usage, and checkout options.",
      "Controlla piano, crediti disponibili, utilizzo e opzioni di acquisto."
    ),
    sections: [
      section(
        "Understand the balance",
        "Comprendi il saldo",
        "Check available credits and recent credit activity. The credit guide explains the actions you can run; paid generation shows its cost before it starts.",
        "Controlla i crediti disponibili e l’attività recente. La guida ai crediti spiega le azioni; la generazione a pagamento mostra il costo prima di iniziare."
      ),
      section(
        "Choose a plan or top-up",
        "Scegli un piano o una ricarica",
        "Compare the displayed credits, connected-account limits, and billing period. Choose the option you need, then review the final checkout amount and terms.",
        "Confronta crediti, limiti degli account collegati e periodo di fatturazione. Scegli l’opzione e controlla importo finale e condizioni al pagamento."
      ),
      section(
        "Manage an existing subscription",
        "Gestisci l’abbonamento",
        "Use the billing-management control for the options available to your subscription. If checkout does not open, read the on-page error or contact support with the selected plan.",
        "Usa il controllo di gestione per le opzioni disponibili nel tuo abbonamento. Se il pagamento non si apre, leggi l’errore o contatta l’assistenza indicando il piano scelto."
      ),
    ],
  },
  "/dashboard/feedback": feedback,
  "/dashboard/status": {
    title: text("Studio status", "Stato dello studio"),
    description: text(
      "Check the services and workspace information behind the tools you use.",
      "Controlla servizi e informazioni dello studio che fanno funzionare i tuoi strumenti."
    ),
    sections: [
      section(
        "Read the capability cards",
        "Leggi le schede delle funzioni",
        "Check database, media storage, AI, and publishing availability. A configured service may still return a specific error for an individual request.",
        "Controlla disponibilità di database, archivio media, AI e pubblicazione. Un servizio configurato può comunque restituire un errore per una singola richiesta."
      ),
      section(
        "Inspect your workspace",
        "Controlla lo studio",
        "The workspace footprint summarizes stored work and connected resources. Use it to understand what is already present.",
        "Il riepilogo dello studio mostra il lavoro salvato e le risorse collegate. Usalo per capire cosa è già presente."
      ),
      section(
        "Get focused help",
        "Chiedi aiuto in modo preciso",
        "When reporting an issue, include the failing action and its error alongside the relevant status. Review the AI information available here when learning how the tools behave.",
        "Quando segnali un problema, includi azione, errore e stato pertinente. Consulta le informazioni sull’AI presenti qui per capire come funzionano gli strumenti."
      ),
    ],
  },
  "/": {
    title: text("Explore REELassati", "Scopri REELassati"),
    description: text(
      "Find the workflow you need, then open your studio.",
      "Trova il percorso di lavoro che ti serve e apri lo studio."
    ),
    sections: [
      section(
        "Explore the tools",
        "Scopri gli strumenti",
        "Browse the feature sections to see how writing, media creation, editing, and publishing fit together.",
        "Esplora le sezioni per capire come si collegano scrittura, creazione media, montaggio e pubblicazione."
      ),
      section(
        "See a concrete example",
        "Guarda un esempio",
        "Walkthroughs show example workflows. Presets provide a starting direction that you can adapt to your own subject.",
        "Gli esempi mostrano percorsi di lavoro. I preset offrono una direzione iniziale adattabile al tuo soggetto."
      ),
      section(
        "Open your studio",
        "Apri lo studio",
        "Sign in or create an account to work with your own files. Pricing explains the plans; Contact opens support.",
        "Accedi o crea un account per lavorare sui tuoi file. Prezzi spiega i piani; Contatti apre l’assistenza."
      ),
    ],
  },
  "/pricing": {
    title: text("Pricing", "Prezzi"),
    description: text(
      "Compare plans and review the final terms in checkout.",
      "Confronta i piani e controlla le condizioni finali al pagamento."
    ),
    sections: [
      section(
        "Choose the billing period",
        "Scegli il periodo",
        "Switch between monthly and annual pricing before comparing. Check the total, included credits, and connected-account limit for each plan.",
        "Scegli tra mensile e annuale prima di confrontare. Controlla totale, crediti inclusi e limite di account collegati di ogni piano."
      ),
      section(
        "Continue to checkout",
        "Continua al pagamento",
        "Choose a plan. If you are signed out, finish sign-in or signup with that plan selected, then review checkout before paying.",
        "Scegli un piano. Se non hai effettuato l’accesso, completa accesso o registrazione mantenendo il piano scelto, poi controlla il pagamento."
      ),
      section(
        "Manage your plan later",
        "Gestisci il piano in seguito",
        "Your studio’s Plan & credits page holds balance, usage, top-ups, and the available subscription-management controls.",
        "La pagina Piano e crediti nello studio contiene saldo, utilizzo, ricariche e controlli di gestione disponibili."
      ),
    ],
  },
  "/contact": {
    title: text("Contact & support", "Contatti e assistenza"),
    description: text(
      "Get help with a specific task or send an issue for human review.",
      "Ricevi aiuto per un’attività specifica o invia un problema per una revisione umana."
    ),
    sections: [
      section(
        "Describe the problem",
        "Descrivi il problema",
        "Tell the support assistant what you are trying to do, which page you used, and the exact error. It can answer product questions and help prepare the next step.",
        "Spiega all’assistente cosa vuoi fare, la pagina usata e l’errore esatto. Può rispondere sul prodotto e aiutare a preparare il passo successivo."
      ),
      section(
        "Use the suggested replies",
        "Usa le risposte suggerite",
        "Choose a relevant follow-up or write your own message. Keep the conversation focused on one issue for a clearer result.",
        "Scegli una risposta pertinente o scrivi un messaggio. Mantieni la conversazione su un problema per ottenere un risultato più chiaro."
      ),
      section(
        "Review a support ticket",
        "Rivedi la richiesta di assistenza",
        "If a ticket is prepared, review its subject, description, and contact details before sending it. A prepared ticket is sent only after you submit it.",
        "Se viene preparata una richiesta, controlla oggetto, descrizione e contatti prima di inviarla. Una richiesta preparata viene inviata solo quando la confermi."
      ),
    ],
  },
  "/feedback": feedback,
  "/showcase": {
    title: text("Walkthroughs", "Esempi guidati"),
    description: text(
      "Explore examples and inspect the direction behind each one.",
      "Esplora gli esempi e osserva la direzione creativa di ciascuno."
    ),
    sections: [
      section(
        "Filter the examples",
        "Filtra gli esempi",
        "Choose a category relevant to the content you want to make.",
        "Scegli una categoria pertinente al contenuto che vuoi creare."
      ),
      section(
        "Open a walkthrough",
        "Apri un esempio",
        "Select a card to inspect its visual, prompt, and edit objective. Use those details to understand the choices behind the example.",
        "Seleziona una scheda per vedere immagine, prompt e obiettivo del montaggio. Usa questi dettagli per capire le scelte dell’esempio."
      ),
      section(
        "Adapt the direction",
        "Adatta la direzione",
        "Carry useful ideas into your own brief with your subject, message, and references. Check the result against your actual source material.",
        "Porta le idee utili nel tuo brief con soggetto, messaggio e riferimenti tuoi. Confronta il risultato con il materiale che possiedi."
      ),
    ],
  },
  "/templates": {
    title: text("Presets", "Preset"),
    description: text(
      "Choose a starting style and adapt its brief to your project.",
      "Scegli uno stile iniziale e adatta il brief al tuo progetto."
    ),
    sections: [
      section(
        "Find a starting point",
        "Trova un punto di partenza",
        "Search or filter by category, such as product, cinematic, social, or educational.",
        "Cerca o filtra per categoria, ad esempio prodotto, cinematografico, social o educativo."
      ),
      section(
        "Inspect the preset",
        "Controlla il preset",
        "Open a preset to read its direction and editable prompt. A preset supplies structure; your subject and source files make the result specific.",
        "Apri un preset per leggerne direzione e prompt modificabile. Il preset fornisce una struttura; soggetto e file rendono il risultato specifico."
      ),
      section(
        "Customize before using",
        "Personalizza prima di usare",
        "Replace generic details with your audience, message, and desired format, then continue with the available creation action.",
        "Sostituisci i dettagli generici con pubblico, messaggio e formato desiderato, poi continua con l’azione di creazione disponibile."
      ),
    ],
  },
  "/provenance": {
    title: text("Check provenance", "Verifica la provenienza"),
    description: text(
      "Look for verifiable REELassati origin information in text or a file.",
      "Cerca informazioni verificabili sull’origine REELassati di un testo o file."
    ),
    sections: [
      section(
        "Choose text or file",
        "Scegli testo o file",
        "Use the matching tab, then paste the text or select the original file you want to check.",
        "Usa la scheda adatta e incolla il testo oppure seleziona il file originale da controllare."
      ),
      section(
        "Read the exact result",
        "Leggi il risultato preciso",
        "Review the reported match method and available record. Recorded origin, an embedded mark, and a verified file match provide different evidence.",
        "Leggi il metodo di corrispondenza e il record disponibile. Origine registrata, marcatura incorporata e corrispondenza del file offrono evidenze diverse."
      ),
      section(
        "Understand an absent match",
        "Comprendi l’assenza di corrispondenza",
        "No match does not prove human authorship. Editing or re-encoding a file can also change its verifiable information.",
        "L’assenza di corrispondenza non prova che il contenuto sia umano. Modifiche o ricodifica possono cambiare le informazioni verificabili del file."
      ),
    ],
  },
  "/ai-transparency": {
    title: text("AI transparency", "Trasparenza sull’AI"),
    description: text(
      "Understand where AI is used and how to review its output.",
      "Comprendi dove viene usata l’AI e come rivedere i risultati."
    ),
    sections: [
      section(
        "Review the systems",
        "Consulta i sistemi",
        "The register describes the AI functions offered by the platform and their intended use.",
        "Il registro descrive le funzioni AI della piattaforma e l’uso previsto."
      ),
      section(
        "Understand the workflow",
        "Comprendi il percorso",
        "Read how your inputs are processed and which controls you keep when creating and reviewing content.",
        "Leggi come vengono elaborati gli input e quali controlli mantieni nella creazione e revisione."
      ),
      section(
        "Follow the source links",
        "Consulta le fonti",
        "Use the linked policies and official sources for more detail, and Contact for a question about a specific workflow.",
        "Usa informative e fonti ufficiali collegate per approfondire, e Contatti per domande su un percorso specifico."
      ),
    ],
  },
  "/responsible-use": {
    title: text("Responsible use", "Uso responsabile"),
    description: text(
      "Review the product’s content rules and practical review steps.",
      "Consulta le regole sui contenuti e i passaggi pratici di revisione."
    ),
    sections: [
      section(
        "Read the scope",
        "Leggi l’ambito",
        "Start with the allowed uses and stated boundaries for the content you intend to create.",
        "Inizia dagli usi consentiti e dai limiti indicati per il contenuto che vuoi creare."
      ),
      section(
        "Apply the workflow",
        "Applica il percorso",
        "Use the creation and review steps on this page before distributing the finished content.",
        "Segui i passaggi di creazione e revisione della pagina prima di distribuire il contenuto finale."
      ),
      section(
        "Report a concern",
        "Segnala un problema",
        "Use the reporting or contact links for a specific issue and provide enough context to identify the content.",
        "Usa i collegamenti di segnalazione o contatto per un problema specifico e aggiungi il contesto per identificare il contenuto."
      ),
    ],
  },
  "/auth/login": {
    title: text("Sign in", "Accedi"),
    description: text(
      "Return to the account that holds your projects and credits.",
      "Torna all’account che contiene progetti e crediti."
    ),
    sections: [
      section(
        "Use your existing account",
        "Usa l’account esistente",
        "Sign in with the email and password or the supported sign-in method you used before.",
        "Accedi con email e password o con il metodo supportato che hai usato in precedenza."
      ),
      section(
        "Recover access if needed",
        "Recupera l’accesso",
        "Use Forgot password to request a reset for an email-and-password account. Follow the message sent to that email address.",
        "Usa Password dimenticata per richiedere il ripristino di un account con email e password. Segui il messaggio inviato all’indirizzo."
      ),
      section(
        "Continue your task",
        "Continua il lavoro",
        "After sign-in, return to your studio. If you arrived from a plan choice, review the checkout that follows.",
        "Dopo l’accesso, torna allo studio. Se arrivi dalla scelta di un piano, controlla il pagamento successivo."
      ),
    ],
  },
  "/auth/signup": {
    title: text("Create an account", "Crea un account"),
    description: text(
      "Set up access to your own studio.",
      "Configura l’accesso al tuo studio."
    ),
    sections: [
      section(
        "Choose your sign-in method",
        "Scegli come accedere",
        "Use an available sign-in provider or complete the name, email, and password fields. Use an email address you can access.",
        "Usa un provider disponibile oppure compila nome, email e password. Usa un indirizzo email a cui puoi accedere."
      ),
      section(
        "Review the account terms",
        "Rivedi le condizioni",
        "Read the linked terms and privacy information before accepting and creating the account.",
        "Leggi condizioni e informativa sulla privacy collegate prima di accettare e creare l’account."
      ),
      section(
        "Follow the next step",
        "Segui il passaggio successivo",
        "Complete any verification shown after signup. If you already have an account, use Sign in to keep your existing work together.",
        "Completa le eventuali verifiche mostrate dopo la registrazione. Se hai già un account, usa Accedi per mantenere il lavoro nello stesso studio."
      ),
    ],
  },
  "/auth/forgot-password": {
    title: text("Reset your password", "Reimposta la password"),
    description: text(
      "Request a reset link for your existing account.",
      "Richiedi un link per reimpostare la password del tuo account."
    ),
    sections: [
      section(
        "Enter the account email",
        "Inserisci l’email dell’account",
        "Use the email address associated with your account and submit the request.",
        "Usa l’indirizzo email associato all’account e invia la richiesta."
      ),
      section(
        "Open the reset email",
        "Apri l’email di ripristino",
        "Check your inbox and spam folder. Open the reset link in the email to choose a new password.",
        "Controlla posta in arrivo e spam. Apri il link nell’email per scegliere una nuova password."
      ),
      section(
        "Return to sign-in",
        "Torna all’accesso",
        "If you used a social sign-in provider, use that provider’s access flow. Contact support if the account remains inaccessible.",
        "Se usavi un provider social, usa il suo percorso di accesso. Contatta l’assistenza se l’account resta inaccessibile."
      ),
    ],
  },
  "/auth/update-password": {
    title: text("Choose a new password", "Scegli una nuova password"),
    description: text(
      "Complete the password reset opened from your email link.",
      "Completa il ripristino aperto dal link ricevuto via email."
    ),
    sections: [
      section(
        "Use the reset link",
        "Usa il link di ripristino",
        "This form needs a valid reset session. If the page reports an expired or invalid link, request another reset.",
        "Il modulo richiede una sessione di ripristino valida. Se il link risulta scaduto o non valido, richiedine un altro."
      ),
      section(
        "Confirm the new password",
        "Conferma la nuova password",
        "Enter the same new password in both fields and follow the requirements displayed by the form.",
        "Inserisci la stessa nuova password nei due campi e segui i requisiti del modulo."
      ),
      section(
        "Finish the update",
        "Completa l’aggiornamento",
        "Submit once and follow the confirmation to return to your account.",
        "Invia una volta e segui la conferma per tornare all’account."
      ),
    ],
  },
  "/auth/oauth-success": {
    title: text("Completing sign-in", "Completamento dell’accesso"),
    description: text(
      "The studio is finishing the provider’s sign-in response.",
      "Lo studio sta completando la risposta del provider di accesso."
    ),
    sections: [
      section(
        "Wait for the redirect",
        "Attendi il reindirizzamento",
        "Allow the sign-in step to finish. Your next page opens when the session is ready.",
        "Attendi il completamento dell’accesso. La pagina successiva si apre quando la sessione è pronta."
      ),
      section(
        "Use the reported error",
        "Usa l’errore mostrato",
        "If the page reports a failure, return to Sign in and try the same account method again. Include the error when contacting support.",
        "Se compare un errore, torna ad Accedi e riprova con lo stesso metodo dell’account. Includi l’errore quando contatti l’assistenza."
      ),
    ],
  },
  "/entry": {
    title: text("Studio introduction", "Introduzione allo studio"),
    description: text(
      "Preview the studio’s introductory experience.",
      "Guarda un’anteprima dell’introduzione allo studio."
    ),
    sections: [
      section(
        "Explore the presentation",
        "Esplora la presentazione",
        "This page demonstrates the introduction and visual layout. Use the replay control to see the introduction again.",
        "Questa pagina mostra l’introduzione e l’aspetto dello studio. Usa il controllo di riproduzione per rivederla."
      ),
      section(
        "Open the working studio",
        "Apri lo studio operativo",
        "Go to Dashboard after sign-in to create and edit real projects.",
        "Dopo l’accesso, vai alla Dashboard per creare e modificare progetti reali."
      ),
    ],
  },
};

const policyPages: Array<[string, GuideText, GuideText]> = [
  [
    "/privacy",
    text("Privacy policy", "Informativa sulla privacy"),
    text(
      "Read how personal information is handled and which requests you can make.",
      "Leggi come vengono gestiti i dati personali e quali richieste puoi fare."
    ),
  ],
  [
    "/terms",
    text("Terms of service", "Condizioni di servizio"),
    text(
      "Review the terms that apply to your account and use of the service.",
      "Consulta le condizioni applicabili all’account e all’uso del servizio."
    ),
  ],
  [
    "/cookies",
    text("Cookie policy", "Informativa sui cookie"),
    text(
      "Understand necessary and optional technologies and your preference controls.",
      "Comprendi le tecnologie necessarie e facoltative e i controlli delle preferenze."
    ),
  ],
  [
    "/refunds",
    text("Refund policy", "Politica sui rimborsi"),
    text(
      "Read the applicable purchase and refund information before making a request.",
      "Leggi le informazioni su acquisti e rimborsi prima di inviare una richiesta."
    ),
  ],
  [
    "/accessibility",
    text("Accessibility", "Accessibilità"),
    text(
      "Read the accessibility statement and how to report a barrier.",
      "Consulta la dichiarazione di accessibilità e come segnalare un ostacolo."
    ),
  ],
  [
    "/legal",
    text("Legal notice", "Informazioni legali"),
    text(
      "Find the operator information and official contact details published here.",
      "Trova le informazioni sul gestore e i contatti ufficiali pubblicati qui."
    ),
  ],
];

for (const [path, title, description] of policyPages) {
  guides[path] = {
    title,
    description,
    sections: [
      section(
        "Read the current text",
        "Leggi il testo attuale",
        "Review the relevant sections and the date shown on this page. Follow linked documents when you need the full context.",
        "Consulta le sezioni pertinenti e la data indicata. Apri i documenti collegati quando serve il contesto completo."
      ),
      section(
        "Ask a specific question",
        "Fai una domanda specifica",
        "Use the contact details in the document for a request. Include the section or account issue your question concerns.",
        "Usa i contatti nel documento per una richiesta. Indica la sezione o il problema dell’account a cui si riferisce."
      ),
    ],
  };
}

export function getPageGuide(
  pathname: string,
  search = ""
): PageGuide | undefined {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (
    path === "/dashboard/interview" ||
    (path === "/dashboard/script" &&
      new URLSearchParams(search).get("mode") === "interview")
  ) {
    return interview;
  }
  return guides[path === "/support" ? "/contact" : path];
}
