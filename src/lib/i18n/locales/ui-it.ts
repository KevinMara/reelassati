import { extraItalianUi } from "./ui-it-extra";
import { italianPublicUi } from "./ui-it-public";
import { italianPricingUi } from "./ui-it-pricing";
import { italianGuideUi } from "./ui-it-guides";

/** Interface translations only; never applied to user or generated content. */
const reviewedItalianUi: Record<string, string> = {
  Attention: "Attenzione",
  Stimulation: "Stimolazione",
  "Processing load": "Carico cognitivo",
  Clarity: "Chiarezza",
  "Overall score": "Punteggio complessivo",
  Overall: "Complessivo",
  Hook: "Apertura",
  Core: "Sviluppo",
  Proof: "Prova",
  Payoff: "Risultato",
  CTA: "Invito all'azione",
  Other: "Altro",
  Body: "Corpo",
  "Call to action": "Invito all'azione",
  Evidence: "Evidenze",
  Improvements: "Miglioramenti",
  Strengths: "Punti di forza",
  "What works": "Cosa funziona",
  "What to improve": "Cosa migliorare",
  "Visual evidence": "Evidenze visive",
  "Audio evidence": "Evidenze audio",
  Confidence: "Affidabilità",
  "Source observation": "Osservazione della fonte",
  "Original source": "Video originale",
  "ORIGINAL SOURCE": "VIDEO ORIGINALE",
  Estimate: "Stima",
  ESTIMATE: "STIMA",
  Methodology: "Metodo di analisi",
  Incomplete: "Incompleto",
  Coverage: "Copertura",
  "Not available": "Non disponibile",
  "No data": "Nessun dato",
  Unscored: "Non valutato",
  "Incomplete analysis": "Analisi incompleta",
  "Response at {{time}}": "Risposta a {{time}}",
  "Measured workspace": "Dati dello spazio di lavoro",
  Analytics: "Statistiche",
  "Track your content, publishing activity, and connected audience metrics.":
    "Monitora contenuti, pubblicazioni e metriche del pubblico collegato.",
  "Output momentum": "Ritmo di produzione",
  "Your last": "Gli ultimi",
  days: "giorni",
  "Toggle one metric or compare several. Every point comes from your saved workspace records.":
    "Seleziona una metrica o confrontane diverse. Ogni punto deriva dai dati salvati nello spazio di lavoro.",
  "Analytics time range": "Intervallo delle statistiche",
  "selected output": "risultati selezionati",
  "Chart metrics": "Metriche del grafico",
  "Distribution footprint": "Distribuzione dei contenuti",
  "Posts by platform": "Post per piattaforma",
  "Workspace records only": "Solo dati dello spazio di lavoro",
  Draft: "Bozza",
  Scheduled: "Programmati",
  Publishing: "In pubblicazione",
  Published: "Pubblicati",
  Failed: "Non riusciti",
  "No platform distribution data yet":
    "Nessun dato di distribuzione disponibile",
  "Saving a draft with a connected account will create the first record.":
    "Salva una bozza con un account collegato per creare il primo dato.",
  "Verified output": "Pubblicazioni confermate",
  "Publication history": "Cronologia delle pubblicazioni",
  "Nothing has been recorded as published": "Nessuna pubblicazione registrata",
  "Publishing history will appear after a real distribution action.":
    "La cronologia apparirà dopo la prima pubblicazione.",
  "Open Publisher": "Apri Pubblica",
  "Plan & credits": "Piano e crediti",
  "Your creative fuel.": "L'energia per creare.",
  "One transparent REELassati balance for every AI tool. Plan credits refresh monthly; purchased top-ups roll over.":
    "Un saldo REELassati per tutti gli strumenti AI. I crediti del piano si rinnovano ogni mese; quelli acquistati restano disponibili.",
  Refresh: "Aggiorna",
  "AI access is enabled for this account. Generations use your available credits; no paid subscription is active.":
    "L'accesso AI è abilitato. Le generazioni utilizzano i crediti disponibili; non è attivo un abbonamento a pagamento.",
  "Credit top-ups": "Ricariche di crediti",
  "Extra credits at a lower unit price than any plan. Yours to keep across renewals, with an active subscription.":
    "Crediti aggiuntivi a un prezzo unitario inferiore a quello dei piani. Restano disponibili ai rinnovi, con un abbonamento attivo.",
  credits: "crediti",
  "Best credit value": "Miglior prezzo per credito",
  "USD per 1,000 credits": "USD per 1.000 crediti",
  "Displayed prices exclude tax. Applicable VAT or sales tax is calculated and added at checkout from your billing details.":
    "I prezzi non includono le imposte. L'IVA o le altre imposte applicabili vengono calcolate al pagamento dai dati di fatturazione.",
  "Available now": "Disponibili ora",
  "REELassati credits": "Crediti REELassati",
  "credits deducted for a payment refund or dispute. Your available balance includes this adjustment.":
    "crediti detratti per un rimborso o una contestazione. Il saldo disponibile include questa rettifica.",
  "Plan credits": "Crediti del piano",
  "Rollover top-ups": "Ricariche accumulate",
  "Extra credits stay in your balance.":
    "I crediti aggiuntivi restano nel saldo.",
  "Credit guide": "Guida ai crediti",
  "Voice rates: multilingual voices / existing language-specific voices. Voice is charged for the actual text length, rounded up to whole credits (minimum 1). Transcription is charged per started minute.":
    "Tariffe voce: voci multilingue / voci specifiche per lingua. La voce viene addebitata sulla lunghezza effettiva del testo, arrotondata al credito intero (minimo 1). La trascrizione viene addebitata per minuto iniziato.",
  "Voice launch rate through 19 October 2026, 15:00 UTC. After that, multilingual voice costs 20 credits per 1,000 characters, proportional to text length.":
    "Tariffa di lancio voce fino al 19 ottobre 2026, ore 15:00 UTC. In seguito, la voce multilingue costa 20 crediti ogni 1.000 caratteri, in proporzione alla lunghezza del testo.",
  "What can your credits create?": "Cosa puoi creare con i tuoi crediti?",
  "With your current balance, choose up to one of these:":
    "Con il saldo attuale puoi scegliere una di queste possibilità:",
  "Examples are alternatives, not a combined allowance.":
    "Gli esempi sono alternativi e non si sommano.",
  "Recent credit activity": "Movimenti recenti dei crediti",
  "Failed AI jobs are released automatically and do not consume credits.":
    "Le operazioni AI non riuscite vengono annullate automaticamente e non consumano crediti.",
  "Credit activity will appear here.":
    "I movimenti dei crediti appariranno qui.",
  "Find your creative pace.": "Trova il tuo ritmo creativo.",
  "One plan. Every creation tool. Room to keep going.":
    "Un piano. Tutti gli strumenti. Spazio per continuare a creare.",
  "Billing cycle": "Ciclo di fatturazione",
  "USD / month": "USD / mese",
  "credits every month": "crediti ogni mese",
  "For example: up to": "Ad esempio: fino a",
  "1K images if used only for images.":
    "immagini 1K, se utilizzati solo per le immagini.",
  "Prices exclude tax; applicable taxes are added at checkout. Annual plans receive credits monthly. Plan credits reset; purchased credits roll over.":
    "Le imposte applicabili vengono aggiunte al pagamento. I piani annuali ricevono crediti ogni mese. I crediti del piano si rinnovano; quelli acquistati si accumulano.",
  "Manage plan and invoices": "Gestisci piano e fatture",
  "Your creative activity": "La tua attività creativa",
  "credits used": "crediti utilizzati",
  "Credit usage time range": "Intervallo di utilizzo dei crediti",
  "Last 7 days": "Ultimi 7 giorni",
  "Last 30 days": "Ultimi 30 giorni",
  "Plan and publish": "Pianifica e pubblica",
  "Content Calendar": "Calendario dei contenuti",
  "Your events and publication schedule, together in":
    "Eventi e pubblicazioni insieme in",
  "Compose or schedule": "Scrivi o programma",
  "New event": "Nuovo evento",
  "Filter calendar items": "Filtra il calendario",
  "All calendar items": "Tutti gli elementi",
  "My events": "I miei eventi",
  Publications: "Pubblicazioni",
  "Filter by publication status": "Filtra per stato di pubblicazione",
  "All dated posts": "Tutti i post con una data",
  "Dated drafts": "Bozze con una data",
  "Filter by platform": "Filtra per piattaforma",
  "All platforms": "Tutte le piattaforme",
  "Select any day to plan something there.":
    "Seleziona un giorno per pianificare un'attività.",
  "Previous month": "Mese precedente",
  Today: "Oggi",
  "Next month": "Mese successivo",
  more: "altri",
  "Tip: double-click a day to create an event immediately.":
    "Fai doppio clic su un giorno per creare subito un evento.",
  Add: "Aggiungi",
  "Add your own event or schedule a publication.":
    "Aggiungi un evento o programma una pubblicazione.",
  "Add event": "Aggiungi evento",
  "Open the publication queue": "Apri la coda di pubblicazione",
  "Plan shoots, meetings, deadlines, tasks, or anything else around your content.":
    "Pianifica riprese, incontri, scadenze e attività per i tuoi contenuti.",
  Title: "Titolo",
  "Film product demo": "Registra una demo del prodotto",
  Date: "Data",
  Type: "Tipo",
  "All-day event": "Evento di un giorno intero",
  Starts: "Inizio",
  "Ends (optional)": "Fine (facoltativa)",
  "Notes (optional)": "Note (facoltative)",
  "Location, brief, people involved…": "Luogo, indicazioni, partecipanti…",
  Cancel: "Annulla",
  "Continue preparing →": "Continua la preparazione →",
  "Reusable creative memory": "Memoria creativa riutilizzabile",
  "Brand DNA": "DNA del brand",
  "One truthful source of creative constraints for this workspace. Switch brands above to keep each client’s content separate.":
    "Un riferimento per le regole creative dello spazio di lavoro. Cambia brand in alto per mantenere separati i contenuti dei clienti.",
  "Definition depth": "Livello di definizione",
  Positioning: "Posizionamento",
  "Brand name": "Nome del brand",
  "Your public-facing brand": "Il nome pubblico del tuo brand",
  "Voice rules": "Regole del tono di voce",
  "How the brand speaks, phrases it avoids, energy level, point of view, and proof style":
    "Come parla il brand, espressioni da evitare, energia, punto di vista e tipo di prove",
  "Be concrete enough that an editor can reject an off-brand line.":
    "Sii preciso: chi monta deve poter riconoscere una frase non adatta al brand.",
  "Audience tension": "Esigenze del pubblico",
  "Who this is for, what they already believe, and what problem creates urgency":
    "A chi ti rivolgi, cosa crede già e quale problema rende urgente agire",
  "Visual system": "Identità visiva",
  "Primary color": "Colore principale",
  "Choose primary color": "Scegli il colore principale",
  "Primary color hexadecimal value": "Valore esadecimale del colore principale",
  "Accent color": "Colore di accento",
  "Choose accent color": "Scegli il colore di accento",
  "Accent color hexadecimal value": "Valore esadecimale del colore di accento",
  "Brand typeface": "Carattere del brand",
  "Editing defaults": "Impostazioni di montaggio",
  "Safe-zone inset": "Margine di sicurezza",
  "Voice ducking": "Attenuazione musica durante la voce",
  "Save Brand DNA": "Salva il DNA del brand",
  "Live constraint preview": "Anteprima delle regole",
  "Make every frame earn the next one.":
    "Fai in modo che ogni fotogramma inviti a guardare il successivo.",
  Projects: "Progetti",
  Assets: "File multimediali",
  Scripts: "Script",
  "Weekly momentum": "Ritmo settimanale",
  "Weekly Review": "Riepilogo settimanale",
  "A practical review built only from your saved projects, publishing records, goals and activity.":
    "Un riepilogo pratico dei progetti salvati, delle pubblicazioni, degli obiettivi e delle attività.",
  "Projects touched · 7d": "Progetti aggiornati · 7 giorni",
  "Publication records · 7d": "Pubblicazioni registrate · 7 giorni",
  "Confirmed published · 7d": "Pubblicazioni confermate · 7 giorni",
  "Active goals": "Obiettivi attivi",
  "Your week at a glance": "La tua settimana in sintesi",
  "Next best actions": "Prossime azioni consigliate",
  scheduled: "programmati",
  "Private media system": "Archivio multimediale privato",
  "Content Library": "Libreria dei contenuti",
  "Your uploaded footage, generated media, exports, and saved scripts, ready to reuse across your projects.":
    "Riprese caricate, contenuti generati, esportazioni e script salvati, pronti da riutilizzare nei tuoi progetti.",
  "Choose media to upload": "Scegli i file da caricare",
  "Media storage needs configuration.":
    "L'archiviazione dei file deve essere configurata.",
  "Search library": "Cerca nella libreria",
  "Search by name or type": "Cerca per nome o tipo",
  "Filter library": "Filtra la libreria",
  "Grid view": "Vista a griglia",
  "List view": "Vista a elenco",
  Favorites: "Preferiti",
  "Filter Library by project": "Filtra la libreria per progetto",
  "All projects": "Tutti i progetti",
  "Create a script": "Crea uno script",
  "Use in Edit": "Usa nel montaggio",
  Open: "Apri",
  "Open in Script": "Apri in Script",
  "Read script": "Leggi lo script",
  "Copy with origin record": "Copia con i dati di origine",
  "Opening your studio": "Apertura dello Studio",
  "Editing studio": "Studio di montaggio",
  "Start with footage. Keep control of every cut.":
    "Parti dalle riprese. Controlla ogni taglio.",
  "Build on a real timeline, then use AI for inspectable changes you can accept, reject, and undo.":
    "Lavora su una timeline reale, poi usa l'AI per modifiche che puoi valutare, accettare, rifiutare e annullare.",
  saved: "salvato",
  "Ready for Edit": "Pronto per il montaggio",
  "Choose an existing project below or start a new timeline with this":
    "Scegli un progetto esistente oppure avvia una nuova timeline con questo",
  "already placed.": "già inserito.",
  "Drop video, image, or audio here, or click to choose.":
    "Trascina qui video, immagini o audio, oppure fai clic per selezionarli.",
  Uploading: "Caricamento",
  "Start from a structure": "Parti da una struttura",
  "No irreversible auto-edit": "Modifiche automatiche reversibili",
  "Saved projects": "Progetti salvati",
  clips: "clip",
  "Add here": "Aggiungi qui",
  "Project frame rate": "Fotogrammi al secondo del progetto",
  "Tracks and audio mixer": "Tracce e mixer audio",
  "Total video duration in seconds": "Durata totale del video in secondi",
  "Caption style library": "Libreria degli stili dei sottotitoli",
  "Editable transcript": "Trascrizione modificabile",
  "Words are edit points": "Monta a partire dalle parole",
  "Add transcript line": "Aggiungi una riga alla trascrizione",
  "Captions changed while you had an unsaved draft. Your draft is kept here for comparison.":
    "I sottotitoli sono cambiati mentre avevi una bozza non salvata. La bozza resta qui per il confronto.",
  "Load saved captions": "Carica i sottotitoli salvati",
  "Transcribe active media": "Trascrivi il file attivo",
  to: "a",
  "Type the spoken line": "Scrivi la frase pronunciata",
  Preview: "Anteprima",
  "Split at playhead": "Dividi in corrispondenza del cursore",
  "Split a caption": "Dividi un sottotitolo",
  "Place the playhead at the spoken break, then put the text cursor before the next phrase. Split keeps those words and uses your chosen time; it does not guess word timing.":
    "Posiziona il cursore sulla pausa del parlato, poi il cursore del testo prima della frase successiva. La divisione mantiene le parole e usa il tempo che hai scelto.",
  "Merge next": "Unisci al successivo",
  "Add lines manually or transcribe the selected media when the speech service is connected.":
    "Aggiungi righe manualmente o trascrivi il file selezionato quando il servizio voce è collegato.",
  "Save transcript revision": "Salva la revisione della trascrizione",
  "Back to projects": "Torna ai progetti",
  "Project title": "Titolo del progetto",
  "Dismiss error": "Chiudi l'errore",
  "Search project footage": "Cerca nelle riprese del progetto",
  "Saved graphics and styles": "Grafiche e stili salvati",
  "Drop media into this edit": "Trascina file in questo montaggio",
  Playhead: "Cursore di riproduzione",
  "Preview aspect ratio": "Formato dell'anteprima",
  "Preview zoom": "Zoom dell'anteprima",
  "Zoom is for inspecting your edit. Drag the enlarged preview to pan. Export framing stays unchanged.":
    "Lo zoom serve a controllare il montaggio. Trascina l'anteprima ingrandita per spostarla. L'inquadratura esportata non cambia.",
  Adjust: "Regola",
  Upload: "Carica",
  or: "oppure",
  "Add from library": "Aggiungi dalla libreria",
  "Groups and links": "Gruppi e collegamenti",
  "Select grouped clips:": "Seleziona le clip raggruppate:",
  selection: "selezione",
  "Linked video and audio move and trim together. Unlink to edit them independently.":
    "Video e audio collegati si spostano e si tagliano insieme. Scollegali per modificarli separatamente.",
  "Tracks and mixer": "Tracce e mixer",
  "Beat cuts and zoom": "Tagli sul ritmo e zoom",
  Split: "Dividi",
  "Duplicate selection": "Duplica la selezione",
  Duplicate: "Duplica",
  "Delete selection": "Elimina la selezione",
  Delete: "Elimina",
  "Remove the selected time intervals across all unlocked tracks and close the gaps":
    "Elimina gli intervalli selezionati da tutte le tracce sbloccate e chiudi gli spazi",
  "Ripple delete": "Elimina e chiudi lo spazio",
  Undo: "Annulla modifica",
  Redo: "Ripristina modifica",
  "Timeline zoom": "Zoom della timeline",
  Fit: "Adatta",
  "Keyboard shortcuts (Ctrl/⌘ + /)": "Scorciatoie da tastiera (Ctrl/⌘ + /)",
  Shortcuts: "Scorciatoie",
  "Beat cuts and speech zoom": "Tagli sul ritmo e zoom sul parlato",
  "Measure existing audio and make reversible rhythm edits.":
    "Analizza l'audio esistente e crea modifiche ritmiche reversibili.",
  "Rename, reorder and mix the tracks in this project.":
    "Rinomina, riordina e mixa le tracce del progetto.",
  "Clip settings, canvas and the end of your edit.":
    "Impostazioni della clip, tela e fine del montaggio.",
  "Adjustment preview time": "Tempo di anteprima della regolazione",
  "AI auto-edit": "Montaggio assistito AI",
  "Build a complete edit from your footage and a reference style.":
    "Crea un montaggio completo dalle tue riprese e da uno stile di riferimento.",
  "Product loop": "Miglioramento del prodotto",
  "Feedback & bugs": "Feedback e problemi",
  "Report a problem or propose an improvement. Technical context is captured automatically so reports are easier to act on.":
    "Segnala un problema o proponi un miglioramento. Il contesto tecnico viene raccolto automaticamente per facilitare la risoluzione.",
  Target: "Obiettivo",
  Update: "Aggiorna",
  "Progress system": "Monitora i progressi",
  "Goal Tracker": "Obiettivi",
  "Set measurable targets and update them from verified performance data.":
    "Definisci obiettivi misurabili e aggiornali con dati verificati.",
  "New goal": "Nuovo obiettivo",
  Active: "Attivi",
  Achieved: "Raggiunti",
  "Average progress": "Progresso medio",
  "Create a measurable goal": "Crea un obiettivo misurabile",
  "Goal name": "Nome dell'obiettivo",
  "Reach the first 10K": "Raggiungi i primi 10.000",
  Metric: "Metrica",
  Deadline: "Scadenza",
  Platform: "Piattaforma",
  "Create goal": "Crea obiettivo",
  "No active goals. Set the next measurable win.":
    "Nessun obiettivo attivo. Definisci il prossimo traguardo misurabile.",
  "AI Image Studio": "Studio immagini AI",
  "Create a visual": "Crea un'immagine",
  "Generate campaign images, thumbnails, backgrounds, and supporting visuals. Every result is saved automatically to your connected media library under the name you choose.":
    "Genera immagini per campagne, miniature, sfondi e altri elementi visivi. Ogni risultato viene salvato automaticamente nella libreria con il nome che scegli.",
  "Image generation is temporarily unavailable":
    "La generazione di immagini è temporaneamente non disponibile",
  "Your saved images and uploads remain available in the Library and Edit.":
    "Le immagini salvate e caricate restano disponibili nella Libreria e nel montaggio.",
  "Image name": "Nome dell'immagine",
  "Summer launch — hero image": "Lancio estivo — immagine principale",
  "Describe the image": "Descrivi l'immagine",
  "A high-contrast editorial product shot with...":
    "Una foto editoriale del prodotto ad alto contrasto con…",
  "Aspect ratio": "Formato",
  "I may use this prompt, its brands, and its likenesses.":
    "Posso utilizzare questo prompt, i brand e le persone rappresentate.",
  "The image will depict an identifiable real person.":
    "L'immagine rappresenterà una persona reale identificabile.",
  "I hold documented consent or another verified legal basis.":
    "Dispongo di un consenso documentato o di un'altra base giuridica verificata.",
  "Generating image": "Generazione dell'immagine",
  "Generate image ·": "Genera immagine ·",
  "Credits are returned automatically if generation fails.":
    "I crediti vengono restituiti automaticamente se la generazione non riesce.",
  "Saved to your image library": "Salvata nella libreria delle immagini",
  "Add image to Edit": "Aggiungi l'immagine al montaggio",
  "Download image": "Scarica immagine",
  "Your generated image will appear here": "L'immagine generata apparirà qui",
  "Name it, describe it, choose its format, and generate. The saved result is immediately available inside Edit.":
    "Scegli un nome, descrivi l'immagine, seleziona il formato e genera. Il risultato salvato è subito disponibile nel montaggio.",
  "Recent images": "Immagini recenti",
  "Connected library": "Libreria collegata",
  "Story extractor": "Dalle tue idee alla storia",
  "Interview Me": "Intervistami",
  "Answer a focused editorial interview, then turn your own evidence into one production-ready short-form script.":
    "Rispondi a un'intervista mirata, poi trasforma le tue esperienze in uno script breve pronto per le riprese.",
  "AI writes the final draft only after your guided answers are complete.":
    "L'AI scrive la bozza finale solo dopo che hai completato le risposte guidate.",
  "The guided interview is available. Final script generation requires the server-side AI integration; REELassati will not pretend a local template is an AI result.":
    "L'intervista guidata è disponibile. La generazione dello script finale richiede il collegamento al servizio AI.",
  "What should this short be about?":
    "Di cosa dovrebbe parlare questo video breve?",
  "The lesson I learned after launching too early…":
    "Cosa ho imparato dopo aver lanciato troppo presto…",
  Niche: "Settore",
  "Design, fitness, business…": "Design, fitness, impresa…",
  Destination: "Destinazione",
  "Start the interview": "Avvia l'intervista",
  Question: "Domanda",
  of: "di",
  "Your answer to:": "La tua risposta a:",
  "Answer in your own words. Specific beats polished.":
    "Rispondi con parole tue. Conta la precisione, non la forma perfetta.",
  Back: "Indietro",
  "Generate script": "Genera script",
  "Next question": "Domanda successiva",
  "Writing from your answers…": "Scrittura dalle tue risposte…",
  "One request, then one persisted script—sequentially.":
    "Una richiesta, poi uno script salvato.",
  "Script saved to your workspace": "Script salvato nello spazio di lavoro",
  "Start a new interview": "Avvia una nuova intervista",
  "Distribution control": "Gestione della distribuzione",
  Publisher: "Pubblica",
  "Prepare your next post. Choose its destinations, shape the copy, and set the timing.":
    "Prepara il prossimo post. Scegli le destinazioni, scrivi il testo e imposta l'orario.",
  "Clear draft": "Svuota la bozza",
  "Destinations (": "Destinazioni (",
  "Connect a publishing account →": "Collega un account di pubblicazione →",
  Caption: "Didascalia",
  "Write the final caption in your brand voice…":
    "Scrivi la didascalia nel tono del tuo brand…",
  characters: "caratteri",
  Hashtags: "Hashtag",
  Media: "File multimediali",
  "Text-only publication": "Pubblicazione di solo testo",
  "Audience language": "Lingua del pubblico",
  English: "Inglese",
  Italian: "Italiano",
  "AI content label": "Etichetta dei contenuti AI",
  "Automatic · from content origin": "Automatica · dall'origine del contenuto",
  "Include AI assistance label": "Includi l'etichetta di assistenza AI",
  "Write with AI": "Scrivi con l'AI",
  Optional: "Facoltativo",
  "What is this post about?": "Di cosa parla questo post?",
  "Topic, audience, key points, and the action you want viewers to take…":
    "Argomento, pubblico, punti principali e azione che vuoi suggerire…",
  "Generate selected copy ·": "Genera i testi selezionati ·",
  "Post preview": "Anteprima del post",
  Time: "Ora",
  "Entered in your browser timezone; workspace preference:":
    "Inserita nel fuso orario del browser; preferenza dello spazio di lavoro:",
  "Save draft": "Salva bozza",
  Schedule: "Programma",
  "Publish now": "Pubblica ora",
  "Workspace queue": "Coda dello spazio di lavoro",
  "Delete draft": "Elimina bozza",
  "Final delivery content": "Contenuto finale della pubblicazione",
  "Origin label prepared": "Etichetta di origine pronta",
  "Visible cue included": "Indicazione visibile inclusa",
  "Machine provenance included": "Dati di provenienza inclusi",
  "Delivery checked": "Consegna verificata",
  "Open live post": "Apri il post pubblicato",
  "Open in composer": "Apri nel compositore",
  "No drafts or scheduled posts yet.":
    "Non ci sono ancora bozze o post programmati.",
  "Creator rewards": "Premi per i creator",
  "Refer creators. Earn studio credits.":
    "Invita creator. Guadagna crediti per lo Studio.",
  "Successful referrals": "Inviti completati",
  "Pending referrals": "Inviti in attesa",
  "Available credits": "Crediti disponibili",
  "Referral value earned": "Valore degli inviti completati",
  "Your creator link": "Il tuo link di invito",
  "Share the full link or the short creator code.":
    "Condividi il link completo o il codice breve.",
  "Referral link": "Link di invito",
  Share: "Condividi",
  "Reward history": "Cronologia dei premi",
  "Your first successful referral will appear here.":
    "Il primo invito completato apparirà qui.",
  "Have a creator code?": "Hai un codice creator?",
  "Apply code": "Applica codice",
  "Credits pay for REELassati usage. The dollar amount communicates equivalent product value; it is not cash or a withdrawal balance. Opening a link, creating an account, or using the app never triggers a reward.":
    "I crediti si usano su REELassati. L'importo in dollari indica il valore equivalente nel prodotto: non è denaro prelevabile. Aprire un link, creare un account o usare l'app non genera un premio.",
  "Opening your script workspace…": "Apertura dello spazio Script…",
  "AI Script Engineering": "Scrittura assistita AI",
  "Script Generator": "Generatore di script",
  "Direct the hook, voice, pacing, and platform. Every generated draft is saved to your workspace automatically.":
    "Dirigi apertura, voce, ritmo e piattaforma. Ogni bozza generata viene salvata automaticamente nello spazio di lavoro.",
  "Script generation needs AI setup":
    "La generazione di script richiede la configurazione AI",
  "Script generation is temporarily unavailable. Your prompts stay in the browser until you choose Generate.":
    "La generazione di script è temporaneamente non disponibile. I prompt restano nel browser finché non scegli Genera.",
  "Topic, product, or argument": "Argomento, prodotto o tesi",
  "Example: Why creators should edit for retention before adding effects":
    "Esempio: perché montare per trattenere l'attenzione prima di aggiungere effetti",
  Tone: "Tono",
  "Target length": "Durata desiderata",
  Language: "Lingua",
  "Hook direction": "Direzione dell'apertura",
  "(optional)": "(facoltativo)",
  "Choose a pattern below or write the opening logic yourself.":
    "Scegli una struttura qui sotto o descrivi l'apertura che vuoi.",
  "Generating and saving": "Generazione e salvataggio",
  "Generate script ·": "Genera script ·",
  "Hook patterns": "Strutture di apertura",
  "These are writing structures, not performance guarantees. Edit the wording to match your proof, audience, and offer.":
    "Sono strutture di scrittura, non garanzie di rendimento. Adatta il testo alle tue prove, al pubblico e all'offerta.",
  "Script title": "Titolo dello script",
  "Copy complete script": "Copia lo script completo",
  "Create visuals": "Crea immagini",
  "Make voiceover": "Crea la voce fuori campo",
  "Direct the opening. Generate the draft.":
    "Dirigi l'apertura. Genera la bozza.",
  "The result stays editable and is stored in your content workspace, ready for the editor or Prompt Director.":
    "Il risultato resta modificabile e salvato nello spazio di lavoro, pronto per il montaggio o la generazione video.",
  "Recent drafts": "Bozze recenti",
  "Script creation mode": "Modalità di creazione dello script",
  "Write from a brief": "Scrivi da un brief",
  "Interview me": "Intervistami",
  "Workspace control": "Gestione dello spazio di lavoro",
  Settings: "Impostazioni",
  "Saved studio preferences and live capability checks.":
    "Preferenze salvate dello Studio e disponibilità dei servizi.",
  "Studio profile": "Profilo dello Studio",
  "The owner email comes from the authenticated private site session.":
    "L'email del titolare proviene dall'account autenticato.",
  "Your name": "Il tuo nome",
  "Studio name": "Nome dello Studio",
  "Owner email": "Email del titolare",
  "Interface language": "Lingua dell'interfaccia",
  "Default creation language": "Lingua predefinita dei contenuti",
  "Publishing timezone": "Fuso orario di pubblicazione",
  "Save profile": "Salva profilo",
  "Brand defaults": "Impostazioni del brand",
  "These constraints are reusable across scripts, AI plans, and edits.":
    "Queste regole si applicano a script, piani AI e montaggi.",
  "Specific language, energy, point of view, and phrases to avoid":
    "Linguaggio, energia, punto di vista ed espressioni da evitare",
  Audience: "Pubblico",
  "Who they are, what they believe, and what creates urgency":
    "Chi sono, cosa credono e cosa rende urgente agire",
  Typeface: "Carattere",
  "Caption preset": "Stile dei sottotitoli",
  Kinetic: "Dinamico",
  Editorial: "Editoriale",
  Minimal: "Essenziale",
  "Safe zone": "Area sicura",
  "Audio ducking": "Attenuazione audio",
  "Open the full Brand DNA editor": "Apri l'editor completo del DNA del brand",
  "Save defaults": "Salva impostazioni",
  Appearance: "Aspetto",
  "Theme preference is kept in this browser.":
    "La preferenza del tema viene salvata in questo browser.",
  Light: "Chiaro",
  "Warm paper surfaces and high-contrast controls.":
    "Superfici chiare e controlli ad alto contrasto.",
  Dark: "Scuro",
  "Low-glare editing surfaces for longer sessions.":
    "Superfici scure per sessioni di montaggio più lunghe.",
  "Language and timezone": "Lingua e fuso orario",
  "Edit these under Studio profile so interface and publishing settings stay in one saved record.":
    "Modificali nel profilo dello Studio per mantenere insieme le preferenze dell'interfaccia e della pubblicazione.",
  "Configured capabilities": "Servizi configurati",
  "These checks confirm deployed bindings and keys are present. The first real request verifies each external service.":
    "Questi controlli verificano la configurazione dei servizi. La prima richiesta effettiva conferma il collegamento al servizio esterno.",
  "Open studio status": "Apri lo stato dello Studio",
  "Missing environment configuration": "Configurazione mancante",
  "Manage publishing accounts": "Gestisci gli account di pubblicazione",
  "Distribution layer": "Canali di distribuzione",
  "Social Hub": "Account social",
  "Link real publishing accounts, then use the same verified destinations everywhere in your workspace.":
    "Collega gli account social per utilizzarli come destinazioni in tutto lo spazio di lavoro.",
  "Connected accounts": "Account collegati",
  "Active platforms": "Piattaforme attive",
  "Last account sync": "Ultima sincronizzazione degli account",
  "Connected destinations": "Destinazioni collegate",
  Disconnect: "Scollega",
  "Add a destination": "Aggiungi una destinazione",
  "Load the original social video": "Carica il video social originale",
  "External players can receive device and interaction data. Allow them in privacy choices or open the source directly.":
    "I lettori esterni possono ricevere dati sul dispositivo e sulle interazioni. Abilitali nelle preferenze privacy o apri direttamente la fonte.",
  "Privacy choices": "Preferenze privacy",
  "Open source": "Apri la fonte",
  "Weekly viral intelligence": "Tendenze virali settimanali",
  "Source-linked videos": "Video con fonte collegata",
  Trends: "Tendenze",
  "Weekly picks use reachable direct TikTok and Reels source pages. Public dates and performance appear only when indexed evidence exposes them; unavailable values are never invented.":
    "La selezione settimanale rimanda a pagine TikTok e Reels accessibili. Date e risultati appaiono solo quando sono disponibili nelle fonti indicizzate.",
  "Custom research": "Ricerca personalizzata",
  "Find verified viral organic brand shorts for your exact brief · 8–15 credits":
    "Trova video brevi organici di brand adatti al tuo brief · 8–15 crediti",
  "Custom trend research": "Ricerca personalizzata delle tendenze",
  "credits when completed": "crediti al completamento",
  "Topic, niche, product, or audience":
    "Argomento, settore, prodotto o pubblico",
  "Leave blank for an overall scan": "Lascia vuoto per una ricerca generale",
  "Content type": "Tipo di contenuto",
  "Performance objective": "Obiettivo del contenuto",
  "credits are used only after verified results succeed.":
    "crediti vengono utilizzati solo dopo la verifica dei risultati.",
  "credits available": "crediti disponibili",
  "Retry weekly update": "Riprova l'aggiornamento settimanale",
  "Weekly viral shorts": "Video brevi virali della settimana",
  "Your latest research": "La tua ultima ricerca",
  "Organic brand posts ·": "Post organici dei brand ·",
  "· no paid ads": "· senza annunci a pagamento",
  Updated: "Aggiornato",
  "The first weekly format update is being prepared automatically.":
    "Il primo aggiornamento settimanale è in preparazione automatica.",
  "No current examples have passed verification yet. The next check runs automatically.":
    "Nessun esempio attuale ha ancora superato la verifica. Il prossimo controllo è automatico.",
  "Filter trend evidence by platform": "Filtra le tendenze per piattaforma",
  "Filter trend evidence by lifecycle": "Filtra le tendenze per fase",
  "All lifecycle stages": "Tutte le fasi",
  "Organic promotion ·": "Promozione organica ·",
  "Open original video": "Apri il video originale",
  "Views reported by source": "Visualizzazioni riportate dalla fonte",
  "Likes reported by source": "Mi piace riportati dalla fonte",
  "Comments reported by source": "Commenti riportati dalla fonte",
  "Shares reported by source": "Condivisioni riportate dalla fonte",
  "Observed evidence": "Evidenze osservate",
  "AI hypothesis": "Ipotesi AI",
  "% confidence": "% di affidabilità",
  "Test:": "Test:",
  "Turn into hypothesis": "Trasforma in ipotesi",
  "Start with my idea": "Parti dalla mia idea",
  "Define a controlled test": "Definisci un test controllato",
  "Format idea": "Idea del formato",
  "Example: Result first, process second":
    "Esempio: prima il risultato, poi il processo",
  "Opening line or first frame": "Frase iniziale o primo fotogramma",
  "Write the concrete opening you will test":
    "Scrivi l'apertura concreta da testare",
  "Source, repeated pattern, audience comment, or result you personally observed":
    "Fonte, schema ricorrente, commento del pubblico o risultato che hai osservato",
  "Pass signal": "Criterio di successo",
  "Example: Higher 3-second hold than the current baseline":
    "Esempio: maggiore permanenza a 3 secondi rispetto al riferimento attuale",
  "Target duration": "Durata desiderata",
  seconds: "secondi",
  "Save hypothesis": "Salva ipotesi",
  "Saved experiments": "Esperimenti salvati",
  "Format hypotheses": "Ipotesi di formato",
  "Filter hypotheses by platform": "Filtra le ipotesi per piattaforma",
  "Build the variant": "Crea la variante",
  "Write the script": "Scrivi lo script",
  "No saved hypotheses": "Nessuna ipotesi salvata",
  "Use a source-linked trend above or add your own observation.":
    "Usa una tendenza con fonte qui sopra o aggiungi una tua osservazione.",
  "Your evidence base": "Le tue fonti",
  "Workspace source material": "Materiale dello spazio di lavoro",
  "Use as starting point": "Usa come punto di partenza",
  "No source material yet": "Nessun materiale disponibile",
  "Scripts and edit projects will appear here as additional inputs for future tests.":
    "Script e progetti di montaggio appariranno qui come spunti per i prossimi test.",
  "Edit Intelligence": "Intelligenza di montaggio",
  "Video Analyzer": "Analisi video",
  "Find the moments that earn attention. Review your video, identify hooks and payoffs, and turn the evidence into a sharper short.":
    "Trova i momenti che catturano l'attenzione. Analizza il video, individua aperture e risultati, e usa le evidenze per migliorare il montaggio.",
  "AI analysis is temporarily unavailable":
    "L'analisi AI è temporaneamente non disponibile",
  "You can still upload and organize your source while analysis is unavailable.":
    "Puoi comunque caricare e organizzare il video mentre l'analisi non è disponibile.",
  "Upload or asset": "Carica o scegli un file",
  "Public URL": "URL pubblico",
  "Optimize for": "Ottimizza per",
  "Or select a saved video": "Oppure seleziona un video salvato",
  "No saved video selected": "Nessun video salvato selezionato",
  "Choose a video from this brand’s Library.":
    "Scegli un video dalla Libreria di questo brand.",
  "Public HTTPS video URL": "URL HTTPS pubblico del video",
  "AI edit review": "Revisione AI del montaggio",
  "Your editorial review": "La tua revisione editoriale",
  "Actionable edit plan": "Piano delle modifiche",
  proposed: "proposte",
  "intensity · review before accepting":
    "intensità · verifica prima di accettare",
  "No edit operations were returned. Refine the source or try a different platform target.":
    "L'analisi non ha restituito modifiche. Rivedi il video o prova una piattaforma diversa.",
  "Queue in project": "Invia al progetto",
  "Choose an edit project": "Scegli un progetto di montaggio",
  Queued: "In coda",
  "Queue changes": "Metti in coda le modifiche",
  "Open in Edit": "Apri nel montaggio",
  "Changes enter the editor as proposed operations. Only occurrences of this exact analyzed source are eligible. Source times follow each clip’s trim and speed; locked or ambiguous changes are held for a timeline decision.":
    "Le modifiche entrano nell'editor come proposte e riguardano solo il video analizzato. I tempi rispettano i tagli e la velocità delle clip; le modifiche bloccate o ambigue richiedono una scelta sulla timeline.",
  "Create edit project from this video":
    "Crea un progetto di montaggio da questo video",
  "Bring your short into focus": "Metti a fuoco il tuo video breve",
  "Upload or select a video to review its hook, pacing, captions, sound, and call to action.":
    "Carica o seleziona un video per analizzare apertura, ritmo, sottotitoli, audio e invito all'azione.",
  "AI Video Studio": "Studio video AI",
  "Prompt Director": "Regia del video",
  "Direct a new clip or continue a previous scene while keeping its subject, setting, and visual language consistent.":
    "Dirigi una nuova clip o continua una scena mantenendo coerenti soggetto, ambientazione e linguaggio visivo.",
  "Video generation is not configured":
    "La generazione video non è configurata",
  "Video generation is temporarily unavailable. Prompt design remains available in the meantime.":
    "La generazione video è temporaneamente non disponibile. Puoi continuare a preparare il prompt.",
  "Visual style": "Stile visivo",
  templates: "modelli",
  "Output controls": "Impostazioni del risultato",
  "Video name": "Nome del video",
  "Summer launch — clip 01": "Lancio estivo — clip 01",
  Duration: "Durata",
  "Native audio": "Audio nativo",
  "Clip continuity": "Continuità della clip",
  "Previous clip": "Clip precedente",
  "Continuity Lock reuses the selected clip, its scene direction, reference frames, and generation lineage. Write what happens next below. Consistency is strongly guided, not guaranteed pixel-for-pixel.":
    "Il blocco di continuità riutilizza la clip scelta, la regia della scena, i fotogrammi di riferimento e i dati di generazione. Descrivi qui sotto cosa succede dopo. La coerenza viene guidata, senza garantire una corrispondenza perfetta.",
  "Generate one clip first. Completed clips will appear here as continuity sources.":
    "Genera prima una clip. Le clip completate appariranno qui come fonti di continuità.",
  "Starts a fresh subject, setting, and visual sequence.":
    "Avvia un nuovo soggetto, una nuova ambientazione e sequenza visiva.",
  "Scene direction": "Regia della scena",
  "Be concrete. The selected style adds camera and production language.":
    "Sii preciso. Lo stile scelto aggiunge indicazioni di ripresa e produzione.",
  Subject: "Soggetto",
  "A ceramic artist in her late twenties":
    "Un'artista della ceramica di circa trent'anni",
  Action: "Azione",
  "Glazes a finished cup, then reveals it": "Smalta una tazza, poi la mostra",
  Location: "Luogo",
  "A sunlit working studio": "Un laboratorio illuminato dal sole",
  "Camera, lighting, dialogue and sound":
    "Ripresa, illuminazione, dialogo e audio",
  "Camera movement": "Movimento di camera",
  "Slow push-in, then a macro detail":
    "Avvicinamento lento, poi un dettaglio macro",
  "Mood and light": "Atmosfera e luce",
  "Warm morning light, tactile and calm":
    "Luce calda del mattino, atmosfera materica e tranquilla",
  Dialogue: "Dialogo",
  "The detail that makes every cup different.":
    "Il dettaglio che rende ogni tazza diversa.",
  Sound: "Audio",
  "Brush on clay, room tone, no music":
    "Pennello sull'argilla, suono ambiente, senza musica",
  Avoid: "Da evitare",
  "Extra fingers, warped cup, logos": "Dita in più, tazza deformata, loghi",
  "Your direction mentions": "La tua indicazione menziona",
  "seconds, but output is set to": "secondi, ma il risultato è impostato a",
  "seconds. The output setting wins; align the wording to avoid contradictory motion.":
    "secondi. Prevale l'impostazione del risultato: allinea il testo per evitare movimenti contraddittori.",
  "First frame URL": "URL del primo fotogramma",
  "Last frame URL": "URL dell'ultimo fotogramma",
  "Only public HTTPS image URLs are accepted. Browser blob URLs and local network addresses cannot be used for generation.":
    "Sono ammessi solo URL HTTPS pubblici di immagini. Gli indirizzi locali e gli URL temporanei del browser non possono essere usati.",
  "Compiled prompt": "Prompt completo",
  "· ready to generate": "· pronto per la generazione",
  "Copy compiled prompt": "Copia il prompt completo",
  "Finishing workflow:": "Finitura del montaggio:",
  "Ready to generate": "Pronto per generare",
  "Generation uses REELassati credits inside your workspace.":
    "La generazione utilizza i crediti REELassati del tuo spazio di lavoro.",
  Output: "Risultato",
  Format: "Formato",
  "I may use the prompt, brands, references, faces and voices in this generation.":
    "Posso utilizzare prompt, brand, riferimenti, volti e voci di questa generazione.",
  "The prompt or a reference depicts an identifiable real person or imitates their voice.":
    "Il prompt o un riferimento rappresenta una persona reale identificabile o ne imita la voce.",
  "Starting generation": "Avvio della generazione",
  "Generation in progress": "Generazione in corso",
  "Generate video ·": "Genera video ·",
  "Generating video": "Generazione del video",
  Progress: "Avanzamento",
  "Your video will appear here": "Il tuo video apparirà qui",
  "Set the scene, confirm the rights, and start generation.":
    "Definisci la scena, conferma i diritti e avvia la generazione.",
  "Generated asset": "File generato",
  Saved: "Salvato",
  "Caption track not added yet. Open the asset in Edit to create and review captions before delivery.":
    "Non ci sono ancora sottotitoli. Apri il file nel montaggio per crearli e verificarli prima della pubblicazione.",
  "Add video to Edit": "Aggiungi il video al montaggio",
  "Download video": "Scarica video",
  "Continue this clip": "Continua questa clip",
  "Voice Studio": "Studio voce",
  "Voice to Content": "Dalla voce al contenuto",
  "Upload a real audio asset, transcribe it by asset ID, shape the transcript into a short-form script, or synthesize a production-ready voice track.":
    "Carica un audio, trascrivilo, trasformalo in uno script breve o genera una traccia vocale pronta per il montaggio.",
  "Some voice tools need setup":
    "Alcuni strumenti voce richiedono la configurazione",
  "Available controls stay active; unavailable AI actions are disabled without pretending to process audio.":
    "I controlli disponibili restano attivi; le azioni AI non disponibili sono disabilitate.",
  "Source voice note": "Nota vocale originale",
  "The uploaded workspace asset—not a local blob URL—is sent for transcription. Use Transcribe below to create its text alternative.":
    "La trascrizione utilizza il file caricato nello spazio di lavoro. Seleziona Trascrivi per ottenerne il testo.",
  "Working title": "Titolo provvisorio",
  "Launch idea — raw voice note": "Idea per il lancio — nota vocale",
  "Upload to workspace": "Carica nello spazio di lavoro",
  "Stored as": "Salvato come",
  "or existing asset": "oppure un file esistente",
  "Saved audio": "Audio salvati",
  "No saved audio selected": "Nessun audio salvato selezionato",
  "REELassati AI transcription": "Trascrizione AI REELassati",
  "Transcription language": "Lingua della trascrizione",
  "Transcribe ·": "Trascrivi ·",
  "Speech synthesis": "Sintesi vocale",
  "Render approved copy into a saved audio asset.":
    "Trasforma il testo approvato in un file audio salvato.",
  "Audio name": "Nome dell'audio",
  "Launch voice-over — final": "Voce per il lancio — finale",
  "Copy to speak": "Testo da leggere",
  "Paste final voice-over copy or transcribe a note first.":
    "Incolla il testo della voce fuori campo oppure trascrivi prima una nota.",
  Voice: "Voce",
  "Choose the voice that fits your story. Your generated audio stays in this brand’s Library.":
    "Scegli la voce adatta alla storia. L'audio generato resta nella Libreria di questo brand.",
  "REELassati AI-generated audio": "Audio generato con AI REELassati",
  "I may use this text and voice. If the voice identifies a real person, I have documented consent or another verified legal basis.":
    "Posso utilizzare questo testo e questa voce. Se la voce identifica una persona reale, dispongo di un consenso documentato o di un'altra base giuridica verificata.",
  Synthesizing: "Sintesi in corso",
  "Generate speech ·": "Genera voce ·",
  "Saved to your audio library": "Salvato nella libreria audio",
  "Spoken text:": "Testo pronunciato:",
  "Add audio to Edit": "Aggiungi l'audio al montaggio",
  Transcript: "Trascrizione",
  "Clean the thought before writing": "Chiarisci l'idea prima di scrivere",
  "timestamped segments": "segmenti con riferimento temporale",
  "Transcript edits affect the script brief. The original uploaded audio asset remains unchanged.":
    "Le modifiche alla trascrizione influenzano lo script. L'audio originale caricato resta invariato.",
  "Script platform": "Piattaforma dello script",
  "Writing from transcript": "Scrittura dalla trascrizione",
  "Turn into short-form script": "Trasforma in uno script breve",
  "Your transcript will stay editable": "La trascrizione resta modificabile",
  "Select a stored audio asset or upload a new one. The app waits for the real transcription response before showing content.":
    "Seleziona un audio salvato o caricane uno nuovo per creare una trascrizione modificabile.",
  "Saved script": "Script salvato",
  "Copy generated script": "Copia lo script generato",
  "Start a new voice note": "Inizia una nuova nota vocale",
  "Loading Studio tool": "Caricamento dello strumento",
  Dashboard: "Panoramica",
  "What will you make impossible to scroll past today?":
    "Cosa creerai oggi per fermare lo scorrimento?",
  "actions this week": "azioni questa settimana",
  "Estimate based only on AI-assisted actions recorded in this workspace":
    "Stima basata sulle azioni assistite AI registrate in questo spazio di lavoro",
  "time reclaimed": "tempo recuperato",
  "Estimated only from AI-assisted actions recorded in this workspace.":
    "Stima delle azioni assistite AI registrate in questo spazio di lavoro.",
  "active days": "giorni attivi",
  "Open Studio": "Apri lo Studio",
  "Recent Activity": "Attività recenti",
  "Your activity starts with a real action.":
    "La tua attività inizia dalla prima azione.",
  "Upload footage or create a project to start your activity history.":
    "Carica riprese o crea un progetto per iniziare la cronologia.",
  "Studio setup progress": "Avanzamento della configurazione",
  "Explore trending content": "Esplora i contenuti di tendenza",
  "Production readiness": "Disponibilità degli strumenti",
  "Studio status": "Stato dello Studio",
  "Availability for storage, generation, and connected publishing.":
    "Disponibilità di archiviazione, generazione e pubblicazione.",
  "Workspace footprint": "Contenuti dello spazio di lavoro",
  "projects ·": "progetti ·",
  "assets ·": "file ·",
  "scripts ·": "script ·",
  publications: "pubblicazioni",
  "Some managed services still need setup.":
    "Alcuni servizi richiedono ancora la configurazione.",
  "Close navigation": "Chiudi la navigazione",
  Video: "Video",
  Audio: "Audio",
  "Open navigation": "Apri la navigazione",
  "Recent activity": "Attività recenti",
  "Editing Studio": "Studio di montaggio",
  "Precision Studio": "Studio di precisione",
  "Shape the next cut.": "Dai forma al prossimo taglio.",
  "A reviewable short-form timeline, ready for your footage.":
    "Una timeline per video brevi, pronta per le tue riprese.",
  "Assist this cut": "Assistimi nel montaggio",
  "Untitled short": "Video breve senza titolo",
  "Replay animation": "Ripeti l'animazione",
  "Product feedback": "Feedback sul prodotto",
  "Help shape REELassati": "Aiuta a migliorare REELassati",
  "Found a problem or have an idea? Send it directly to the product queue with the context needed to act on it.":
    "Hai trovato un problema o hai un'idea? Inviala al team con il contesto necessario per intervenire.",
  "SECURE ACCOUNT": "ACCOUNT SICURO",
  "YOUR CREATOR WORKSPACE": "IL TUO SPAZIO CREATIVO",
  "Check your email": "Controlla la tua email",
  "We sent a secure confirmation link to":
    "Abbiamo inviato un link di conferma sicuro a",
  "At least 8 characters": "Almeno 8 caratteri",
  "REELassati Support": "Assistenza REELassati",
  "Safe support": "Assistenza sicura",
  "You can always email": "Puoi sempre scrivere a",
  "Message REELassati Support": "Scrivi all'assistenza REELassati",
  "Send message": "Invia messaggio",
  priority: "priorità",
  "Ticket ready": "Richiesta pronta",
  "The assistant prepared this escalation from your conversation. Review and send it to human support.":
    "L'assistente ha preparato questa richiesta dalla conversazione. Verificala e inviala al team di assistenza.",
  "Create support ticket": "Crea richiesta di assistenza",
  "Ticket created": "Richiesta creata",
  Reference: "Riferimento",
  ". Keep this ID for any follow-up.":
    ". Conserva questo codice per gli aggiornamenti.",
  "Choose a new password": "Scegli una nuova password",
  "Use at least 8 characters. Your new password replaces the old one immediately.":
    "Usa almeno 8 caratteri. La nuova password sostituisce subito quella precedente.",
  "Password updated": "Password aggiornata",
  "Your account is secure. Opening your workspace…":
    "Il tuo account è protetto. Apertura dello spazio di lavoro…",
  "This reset link is missing or expired.":
    "Il link di ripristino è mancante o scaduto.",
  "Request a fresh link to securely choose a new password.":
    "Richiedi un nuovo link per scegliere la password in sicurezza.",
  "Request another link": "Richiedi un altro link",
  "New password": "Nuova password",
  "Confirm new password": "Conferma la nuova password",
  "Repeat your new password": "Ripeti la nuova password",
  "The passwords do not match.": "Le password non corrispondono.",
  "REELassati home": "Pagina iniziale di REELassati",
  "Toggle theme": "Cambia tema",
  "CREATIVE SYSTEM": "SISTEMA CREATIVO",
  "One focused workspace": "Uno spazio per creare con precisione",
  "Edit · review · publish": "Monta · analizza · pubblica",
  "Provenance record sealed": "Registro di provenienza verificato",
  "Origin details": "Dettagli di origine",
  Workflow: "Flusso di lavoro",
  System: "Sistema",
  Created: "Creato",
  Mark: "Marcatura",
  "Inspect record": "Esamina il registro",
  "Opening REELassati Studio": "Apertura di REELassati Studio",
  "Blocking — I cannot continue": "Bloccante — non posso continuare",
  "Major — important workflow affected":
    "Grave — un'attività importante è compromessa",
  "Minor — workaround available": "Minore — esiste una soluzione alternativa",
  "Idea — improvement request": "Idea — proposta di miglioramento",
  "Owner workspace": "Spazio del titolare",
  "Feedback inbox": "Segnalazioni ricevute",
  "Review client reports, set priority, and move work through the product queue.":
    "Esamina le segnalazioni, assegna una priorità e segui i progressi del team.",
  "Submit a report": "Invia una segnalazione",
  New: "Nuove",
  Urgent: "Urgenti",
  Planned: "Pianificate",
  Fixed: "Risolte",
  "Search reports": "Cerca segnalazioni",
  "All statuses": "Tutti gli stati",
  "Bugs + ideas": "Problemi e idee",
  Bugs: "Problemi",
  Ideas: "Idee",
  "No reports match these filters.":
    "Nessuna segnalazione corrisponde ai filtri.",
  Status: "Stato",
  Priority: "Priorità",
  "Select a report to review it.": "Seleziona una segnalazione per esaminarla.",
  Privacy: "Privacy",
  "Your account and data": "Il tuo account e i tuoi dati",
  "Download projects, scripts, settings, and media links across all your brands.":
    "Scarica progetti, script, impostazioni e link ai file di tutti i tuoi brand.",
  "Download my data": "Scarica i miei dati",
  "Request account deletion": "Richiedi l'eliminazione dell'account",
  "This requests removal of your account and all brand workspaces. Support checks subscription cancellation and any records that must be retained. A request does not cancel billing automatically.":
    "Richiedi l'eliminazione dell'account e di tutti gli spazi dei brand. L'assistenza verifica l'annullamento dell'abbonamento e i dati da conservare. La richiesta non interrompe automaticamente la fatturazione.",
  "Manage your subscription": "Gestisci l'abbonamento",
  "Type DELETE MY ACCOUNT": "Digita DELETE MY ACCOUNT",
  "Submit deletion request": "Invia la richiesta di eliminazione",
  "Preview unavailable": "Anteprima non disponibile",
  "Generate music & sound effects with AI":
    "Genera musica ed effetti sonori con l'AI",
  "Audio generation type": "Tipo di generazione audio",
  "Describe generated audio": "Descrivi l'audio da generare",
  "Describe mood, instruments, rhythm, or the sound you need…":
    "Descrivi atmosfera, strumenti, ritmo o il suono che ti serve…",
  Seconds: "Secondi",
  "AI audio duration": "Durata dell'audio AI",
  About: "Circa",
  "credits if the generated effect lasts": "crediti se l'effetto generato dura",
  "s. The generator may produce a longer take. Final cost covers the full generated take, including any tail trimmed to your selected length. Unused reserved credits are returned.":
    "s. Il generatore può produrre una traccia più lunga. Il costo finale copre tutta la traccia, inclusa la coda tagliata alla durata scelta. I crediti prenotati non utilizzati vengono restituiti.",
  "is not available yet. You can use the free sounds below or upload audio to Library.":
    "non è ancora disponibile. Puoi usare i suoni gratuiti qui sotto o caricare un audio nella Libreria.",
  "Let AI build your edit": "Lascia che l'AI prepari il montaggio",
  "Footage review → captions → cut and pacing → supporting shots → editable timeline.":
    "Revisione delle riprese → sottotitoli → tagli e ritmo → scene di supporto → timeline modificabile.",
  "Saved reference direction": "Indicazioni di riferimento salvate",
  "Describe the style and outcome": "Descrivi lo stile e il risultato",
  "Autonomous editing style": "Stile del montaggio assistito",
  "Premium skincare demo. Clean editorial captions, a fast before/after opening, subtle fades, warm colour, and a quiet product close-up at the end.":
    "Demo di un prodotto skincare premium. Sottotitoli editoriali puliti, apertura rapida prima/dopo, dissolvenze delicate, colori caldi e un primo piano finale del prodotto.",
  "Match a reference style or video · optional":
    "Segui uno stile o un video di riferimento · facoltativo",
  "Detect ending from content automatically":
    "Rileva automaticamente la conclusione dal contenuto",
  "Target duration ·": "Durata desiderata ·",
  "AI target duration": "Durata desiderata del montaggio AI",
  "Transcribe and caption footage": "Trascrivi e sottotitola le riprese",
  "Create extra images or videos · optional":
    "Crea immagini o video aggiuntivi · facoltativo",
  "Your own footage is used by default. Allow paid new assets only when you want supporting shots.":
    "Per impostazione predefinita si usano le tue riprese. Consenti contenuti aggiuntivi a pagamento solo se desideri scene di supporto.",
  "New images, up to": "Nuove immagini, fino a",
  "Maximum generated images": "Numero massimo di immagini generate",
  "New 5s videos, up to": "Nuovi video da 5 s, fino a",
  "Maximum generated videos": "Numero massimo di video generati",
  "Up to": "Fino a",
  Review: "Revisiona",
  "· speech timing": "· tempi del parlato",
  "· plan": "· piano",
  "· optional media": "· file facoltativi",
  ". Only requested generations run. Manual editing and local export use no AI credits.":
    ". Vengono eseguite solo le generazioni richieste. Il montaggio manuale e l'esportazione locale non usano crediti AI.",
  "Build my edit · ≤": "Crea il mio montaggio · ≤",
  "Stop remaining steps": "Interrompi i passaggi rimanenti",
  "Review and export my edit": "Revisiona ed esporta il montaggio",
  "Brand workspace": "Spazio del brand",
  "Active brand workspace": "Spazio del brand attivo",
  "brands. Each has its own voice, Library, projects, calendar, and social connections. Plan credits are shared.":
    "brand. Ognuno ha voce, Libreria, progetti, calendario e account social propri. I crediti del piano sono condivisi.",
  "New brand name": "Nome del nuovo brand",
  "Compare brand allowances": "Confronta i limiti dei brand",
  "Customize captions": "Personalizza i sottotitoli",
  "Caption safe area": "Area sicura dei sottotitoli",
  "Size is a percentage of video width. Safe margin keeps captions away from social-player controls. Preview and export use these same settings. Burned-in source captions cannot be restyled here.":
    "La dimensione è una percentuale della larghezza del video. Il margine sicuro evita i controlli delle piattaforme social. Anteprima ed esportazione usano le stesse impostazioni. I sottotitoli già impressi nel video non sono modificabili qui.",
  "Current text:": "Testo attuale:",
  "Caption animation": "Animazione dei sottotitoli",
  "Uses measured word timings from transcription. Imported subtitles or edited lines without word timings display the whole phrase.":
    "Usa i tempi delle parole misurati dalla trascrizione. I sottotitoli importati o le righe senza tempi delle parole mostrano la frase intera.",
  "Caption position": "Posizione dei sottotitoli",
  "Label background": "Sfondo dell'etichetta",
  "Background color": "Colore di sfondo",
  "Caption background": "Sfondo dei sottotitoli",
  "Reset preset": "Ripristina lo stile",
  "Apply style": "Applica stile",
  "Import SRT / VTT": "Importa SRT / VTT",
  "Download SRT": "Scarica SRT",
  "Import subtitle file": "Importa file dei sottotitoli",
  Replace: "Sostituisci",
  "existing captions with": "sottotitoli esistenti con",
  "imported captions?": "sottotitoli importati?",
  "Replace captions": "Sostituisci sottotitoli",
  "Caption style sample": "Esempio dello stile dei sottotitoli",
  "Stereo pan": "Panoramica stereo",
  "Gain envelope": "Inviluppo del volume",
  keys: "punti",
  "Keys use seconds in the original file and multiply Audio gain. They stay attached to that sound when you trim, split, move, or change speed.":
    "I punti usano i secondi del file originale e moltiplicano il volume audio. Restano legati al suono quando tagli, dividi, sposti o cambi velocità.",
  "New key at source second": "Nuovo punto al secondo della fonte",
  "New audio key source second": "Secondo della fonte del nuovo punto audio",
  "Add key": "Aggiungi punto",
  "Use playhead · source": "Usa il cursore · fonte",
  "Source seconds": "Secondi della fonte",
  "Gain ×": "Volume ×",
  "Go to key": "Vai al punto",
  "Remove key": "Rimuovi punto",
  Go: "Vai",
  "No keys: constant gain across the clip.":
    "Nessun punto: volume costante in tutta la clip.",
  "Clear envelope": "Rimuovi inviluppo",
  "Reset pan & envelope": "Ripristina panoramica e inviluppo",
  "Adjustment sections": "Sezioni delle regolazioni",
  "Selected clip": "Clip selezionata",
  "Unlock this clip to change its settings.":
    "Sblocca la clip per modificarne le impostazioni.",
  "Source in and out": "Inizio e fine nella fonte",
  "These are positions in the original file. Trimming changes which part is used; timeline start controls where it appears in your edit. Existing captions on the primary lane follow these changes.":
    "Sono posizioni nel file originale. Il taglio modifica la parte utilizzata; l'inizio sulla timeline determina dove appare nel montaggio. I sottotitoli della traccia principale seguono le modifiche.",
  Framing: "Inquadratura",
  "Browse Looks & transitions in the left tool panel for reusable treatments.":
    "Apri Stili e transizioni nel pannello a sinistra per effetti riutilizzabili.",
  "Detach audio": "Separa audio",
  "Creates an independently editable audio clip with the same timing and mutes the source video's sound. One Undo restores both.":
    "Crea una clip audio modificabile separatamente con gli stessi tempi e disattiva il suono del video originale. Annulla modifica ripristina entrambi.",
  "Set as music under dialogue": "Imposta come musica sotto il dialogo",
  "Entrance & exit": "Entrata e uscita",
  "Clip fades": "Dissolvenze della clip",
  "Fades ease this clip in and out. Video fades also fade its source audio. Overlap clips on separate video lanes for a dissolve. A split preserves the original outer fades.":
    "Le dissolvenze rendono graduali entrata e uscita. Quelle video attenuano anche l'audio originale. Sovrapponi le clip su tracce video separate per una dissolvenza incrociata. La divisione conserva le dissolvenze esterne.",
  "Changes are saved as an undoable revision.":
    "Le modifiche vengono salvate come revisione annullabile.",
  "Apply changes": "Applica modifiche",
  "Select a clip on the timeline to adjust it.":
    "Seleziona una clip sulla timeline per regolarla.",
  "Slip, rolling trim and rate stretch":
    "Scorrimento, regolazione del taglio e variazione della durata",
  "Linked audio follows these edits. Source boundaries and measured captions are preserved.":
    "L'audio collegato segue queste modifiche. I limiti della fonte e i sottotitoli misurati vengono conservati.",
  "Slip source by seconds": "Sposta la fonte di secondi",
  "Slip source offset in seconds": "Scostamento della fonte in secondi",
  "Slip source": "Scorri la fonte",
  "Move cut to": "Sposta il taglio verso",
  "by seconds": "di secondi",
  "Rolling cut offset in seconds": "Scostamento del taglio in secondi",
  "Roll cut": "Sposta il taglio",
  "Fit source span to seconds": "Adatta l'intervallo della fonte a secondi",
  "Rate stretch duration in seconds": "Nuova durata in secondi",
  "Rate stretch": "Adatta durata e velocità",
  "Pick up where you left off": "Riprendi da dove eri rimasto",
  "clips ·": "clip ·",
  "Continue editing": "Continua il montaggio",
  "Your first creation": "La tua prima creazione",
  "What would you like to make?": "Cosa vuoi creare?",
  "Brand or product": "Brand o prodotto",
  "What are you creating content for?": "Per cosa stai creando contenuti?",
  "Who is it for?": "A chi ti rivolgi?",
  "Your audience and what they care about":
    "Il tuo pubblico e ciò che gli interessa",
  "Your brand details carry through to your creation tools.":
    "Le informazioni del brand vengono utilizzate dagli strumenti creativi.",
  "Plan your creative month": "Pianifica il tuo mese creativo",
  "Try a mix of work. The total updates as you go.":
    "Prova una combinazione di attività. Il totale si aggiorna mentre scegli.",
  "An estimate using the settings above. Duration, resolution, audio, and continuation change video costs. Manual editing and MP4 export use no AI credits.":
    "Stima basata sulle impostazioni sopra. Durata, risoluzione, audio e continuazione modificano i costi video. Il montaggio manuale e l'esportazione MP4 non usano crediti AI.",
  "Import a direct video link": "Importa un link diretto a un video",
  "Maximum 256 MB and 2 minutes. Uploading the original is always available.":
    "Massimo 256 MB e 2 minuti. Puoi sempre caricare il file originale.",
  "Direct video URL": "URL diretto del video",
  "I am authorized to download and use this video.":
    "Sono autorizzato a scaricare e utilizzare questo video.",
  "Your editing partner": "Il tuo assistente di montaggio",
  "Chat preferences": "Preferenze della chat",
  "How Reel works": "Come funziona Reel",
  "Optional improvements": "Miglioramenti facoltativi",
  "Approval mode": "Modalità di approvazione",
  "Requested edits and their necessary steps run directly.":
    "Le modifiche richieste e i passaggi necessari vengono eseguiti direttamente.",
  "Credit limit per request": "Limite di crediti per richiesta",
  Save: "Salva",
  "Includes the 5-credit planning step and any paid actions. Approval mode never raises this limit.":
    "Include i 5 crediti per la pianificazione e le azioni a pagamento. La modalità di approvazione non aumenta questo limite.",
  Plan: "Piano",
  Conversation: "Conversazione",
  "Saved suggestions ·": "Suggerimenti salvati ·",
  "Earlier analysis suggestions are still available to review.":
    "I suggerimenti delle analisi precedenti restano disponibili per la revisione.",
  "Apply change": "Applica modifica",
  Reject: "Rifiuta",
  "What are we making?": "Cosa creiamo?",
  "Tell Reel what you want to change. Attach a reference, point to a moment, or start with an idea.":
    "Spiega a Reel cosa vuoi cambiare. Allega un riferimento, indica un momento o parti da un'idea.",
  "Changes appear on your timeline as they finish. You can keep editing them by hand.":
    "Le modifiche appaiono sulla timeline appena completate. Puoi continuare a modificarle manualmente.",
  "Reading your request and project…":
    "Lettura della richiesta e del progetto…",
  selected: "selezionati",
  "Select all / clear": "Seleziona tutto / deseleziona",
  "Remove time range": "Rimuovi intervallo",
  "Plan first": "Pianifica prima",
  "Exit planning mode": "Esci dalla pianificazione",
  "Remove task preset": "Rimuovi il modello di attività",
  "Target:": "Destinazione:",
  "Remove clip from chat context": "Rimuovi la clip dal contesto della chat",
  "Message Reel": "Scrivi a Reel",
  "Attach or choose an editing task":
    "Allega o scegli un'attività di montaggio",
  "Attach reference files": "Allega file di riferimento",
  "Attach a reference link": "Allega un link di riferimento",
  "Start with a task": "Parti da un'attività",
  "Plan before editing": "Pianifica prima del montaggio",
  "Edit around the playhead": "Modifica intorno al cursore",
  "Advanced AI auto-edit": "Montaggio AI avanzato",
  "Reference link": "Link di riferimento",
  "Use a public link. Upload the file if the source requires sign-in.":
    "Usa un link pubblico. Carica il file se la fonte richiede l'accesso.",
  "Attach link": "Allega link",
  "Stop after current action": "Interrompi dopo l'azione corrente",
  "Send to Reel, 5 credits for planning":
    "Invia a Reel, 5 crediti per la pianificazione",
  "Send · 5 credits for planning": "Invia · 5 crediti per la pianificazione",
  "Planning: 5 credits · manual edits: free":
    "Pianificazione: 5 crediti · modifiche manuali: gratuite",
  "Shift + Enter for a new line": "Maiusc + Invio per andare a capo",
  "↵ Send": "↵ Invia",
  "Drop a reference for Reel": "Trascina un riferimento per Reel",
  "Files stay attached to your message.":
    "I file restano allegati al messaggio.",
  Skip: "Salta",
  "Why this step": "Perché questo passaggio",
  "Interrupted work is not automatically submitted again.":
    "Il lavoro interrotto non viene reinviato automaticamente.",
  "Recover saved plan": "Recupera il piano salvato",
  "This plan needs a higher limit": "Questo piano richiede un limite maggiore",
  "credits including planning. Your current limit is":
    "crediti inclusa la pianificazione. Il limite attuale è",
  ". Raising it does not approve optional extras.":
    ". Aumentarlo non approva gli extra facoltativi.",
  "Set limit to": "Imposta il limite a",
  "Your plan is ready to review": "Il piano è pronto per la revisione",
  "steps · up to": "passaggi · fino a",
  "credits including planning. Nothing has been changed. Optional extras follow your approval preference.":
    "crediti inclusa la pianificazione. Nessuna modifica è stata applicata. Gli extra facoltativi seguono la tua preferenza di approvazione.",
  "Apply plan": "Applica piano",
  "Continue remaining steps": "Continua i passaggi rimanenti",
  "Create and manage media": "Crea e gestisci i file multimediali",
  "Media tools": "Strumenti multimediali",
  "Audio tools": "Strumenti audio",
  "Image tools": "Strumenti immagine",
  "Ask Reel for suggestions": "Chiedi suggerimenti a Reel",
  "Motion kits": "Kit di animazione",
  "Preset library": "Libreria dei modelli",
  Customize: "Personalizza",
  "3D pose": "Posa 3D",
  "Loading 3D pose tools…": "Caricamento degli strumenti di posa 3D…",
  "Start blank": "Parti da zero",
  "Duration ·": "Durata ·",
  "Generated video duration": "Durata del video generato",
  "Files to create": "File da creare",
  "Number of generated files": "Numero di file generati",
  Generate: "Genera",
  "This generation service is not available yet. Your existing files remain available in Library.":
    "Questo servizio di generazione non è ancora disponibile. I file esistenti restano disponibili nella Libreria.",
  "Generated files": "File generati",
  "Ready files are saved to Library. Drag them onto the timeline whenever you need them.":
    "I file completati vengono salvati nella Libreria. Trascinali sulla timeline quando ti servono.",
  "Save generation name": "Salva il nome della generazione",
  "Retrieves the existing output · no new generation or credit charge.":
    "Recupera il risultato esistente · nessuna nuova generazione o spesa di crediti.",
  Check: "Verifica",
  "Media library": "Libreria multimediale",
  "Create folder": "Crea cartella",
  "Thumbnail view": "Vista miniature",
  "Parent folder": "Cartella superiore",
  "Folder name": "Nome della cartella",
  "Search files…": "Cerca file…",
  "Media type": "Tipo di file",
  "Sort files": "Ordina i file",
  "Only empty folders can be removed": "Puoi eliminare solo le cartelle vuote",
  "Searching all folders and saved AI observations. Unreviewed footage is matched by filename.":
    "Cerca in tutte le cartelle e nelle osservazioni AI salvate. Le riprese non analizzate vengono cercate per nome.",
  "Click to preview · drag to place on the timeline":
    "Fai clic per l'anteprima · trascina per inserire sulla timeline",
  "Root folder": "Cartella principale",
  "Drop media here, upload files, or open a folder.":
    "Trascina qui i file, caricane altri o apri una cartella.",
  "Free · editable": "Gratuito · modificabile",
  "Search presets…": "Cerca modelli…",
  Selected: "Selezionato",
  "Clip entrance & exit": "Entrata e uscita della clip",
  "Styles apply to the editable captions below. Captions already inside a source video remain part of that video.":
    "Gli stili si applicano ai sottotitoli modificabili qui sotto. Quelli già impressi nel video restano parte del video.",
  "Choose a preset, then edit its text, colors, timing and motion.":
    "Scegli un modello, poi modifica testo, colori, tempi e animazione.",
  "Select a video or image on the timeline to apply a look.":
    "Seleziona un video o un'immagine sulla timeline per applicare uno stile.",
  "Keyboard shortcuts": "Scorciatoie da tastiera",
  "Customize timeline commands. Preferences stay in this browser. Text fields and dialogs keep their normal typing shortcuts. Mod means Ctrl on Windows/Linux and ⌘ on macOS. Recorded shortcuts use physical keys, including on other keyboard layouts.":
    "Personalizza i comandi della timeline. Le preferenze restano in questo browser. Campi di testo e finestre mantengono le scorciatoie normali. Mod indica Ctrl su Windows/Linux e ⌘ su macOS. Le scorciatoie registrate seguono i tasti fisici della tastiera.",
  "Find an action…": "Cerca un'azione…",
  "Search shortcuts": "Cerca scorciatoie",
  "Reset defaults": "Ripristina predefiniti",
  Unassigned: "Non assegnata",
  "Shortcut for": "Scorciatoia per",
  "e.g. Mod+Shift+S": "es. Mod+Maiusc+S",
  Apply: "Applica",
  "Selecting and moving clips": "Seleziona e sposta le clip",
  Hold: "Tieni premuto",
  Shift: "Maiusc",
  "and click to add or remove clips from the selection. Drag a selected clip to move the group. Copy, duplicate and delete work on the selection. Unlock clips before moving or deleting them.":
    "e fai clic per aggiungere o rimuovere clip dalla selezione. Trascina una clip selezionata per spostare il gruppo. Copia, duplica ed elimina agiscono sulla selezione. Sblocca le clip prima di spostarle o eliminarle.",
  "Ripple delete removes the selected time intervals from every unlocked track and closes the gaps. Undo restores the complete edit.":
    "Elimina e chiudi lo spazio rimuove gli intervalli selezionati da tutte le tracce sbloccate. Annulla modifica ripristina il montaggio completo.",
  "Snapping aligns clip edges with nearby clips and the playhead. Hold":
    "L'aggancio allinea i bordi delle clip alle clip vicine e al cursore. Tieni premuto",
  "while dragging for exact placement.":
    "mentre trascini per un posizionamento preciso.",
  "No matching shortcut.": "Nessuna scorciatoia trovata.",
  "Sound library": "Libreria audio",
  "Free sounds & music": "Suoni e musica gratuiti",
  "My audio files": "I miei file audio",
  "Search sounds": "Cerca suoni",
  "Search sounds…": "Cerca suoni…",
  "Sound category": "Categoria audio",
  "Free to use · no AI credits": "Utilizzo gratuito · nessun credito AI",
  "Source & license": "Fonte e licenza",
  Source: "Fonte",
  "Save a free sound, upload audio, or generate a new track.":
    "Salva un suono gratuito, carica un audio o genera una nuova traccia.",
  "3D model pose": "Posa del modello 3D",
  "Import a static GLB, compose a pose, and save a transparent image for your timeline.":
    "Importa un GLB statico, imposta la posa e salva un'immagine trasparente per la timeline.",
  "Model · .glb, up to 25 MB": "Modello · .glb, fino a 25 MB",
  "Rendered GLB pose preview": "Anteprima della posa GLB renderizzata",
  "triangles ·": "triangoli ·",
  "embedded textures": "texture incorporate",
  "Material tint": "Colore del materiale",
  "Reset pose": "Ripristina posa",
  "Pose saved. Drag the image from Library onto a visual timeline track.":
    "Posa salvata. Trascina l'immagine dalla Libreria su una traccia visiva della timeline.",
  "Static 1024 × 1024 image. Embedded PNG/JPEG textures and standard triangle meshes are supported. Export animated, skinned or compressed models as a static, uncompressed GLB first.":
    "Immagine statica 1024 × 1024. Sono supportate texture PNG/JPEG incorporate e mesh triangolari standard. Esporta prima i modelli animati, con scheletro o compressi come GLB statici non compressi.",
  "Editable graphics, with the same animation in preview and export.":
    "Grafiche modificabili con la stessa animazione in anteprima ed esportazione.",
  Graphic: "Grafica",
  "Graphic type": "Tipo di grafica",
  Text: "Testo",
  "Write your title or callout…": "Scrivi il titolo o il richiamo…",
  "3D titles support Latin characters and symbols. Use Text for other scripts.":
    "I titoli 3D supportano caratteri latini e simboli. Usa Testo per altri alfabeti.",
  "Graphic composition": "Composizione grafica",
  "Supporting text": "Testo di supporto",
  "Role, attribution, or a short explanation…":
    "Ruolo, attribuzione o breve spiegazione…",
  "Graphic accent color": "Colore di accento della grafica",
  Color: "Colore",
  "Graphic color": "Colore della grafica",
  "Card color": "Colore della scheda",
  "Graphic card color": "Colore della scheda grafica",
  "3D appearance": "Aspetto 3D",
  "Entrance and exit": "Entrata e uscita",
  "Graphic animation": "Animazione della grafica",
  "Graphic duration": "Durata della grafica",
  "Motion path": "Percorso di movimento",
  "Preview ·": "Anteprima ·",
  "Graphic preview time": "Tempo dell'anteprima grafica",
  "Choose a time, add a keyframe, then set its position, scale and rotation. The graphic moves between your keyframes.":
    "Scegli un tempo, aggiungi un fotogramma chiave e imposta posizione, scala e rotazione. La grafica si muove tra i fotogrammi chiave.",
  "Add keyframe here": "Aggiungi un fotogramma chiave qui",
  "Motion to next keyframe": "Movimento verso il fotogramma chiave successivo",
  "Keyframe easing": "Curva del fotogramma chiave",
  "Applies until": "Si applica fino a",
  "s. Scrub the preview to see the motion.":
    "s. Scorri l'anteprima per vedere il movimento.",
  "Remove selected keyframe": "Rimuovi il fotogramma chiave selezionato",
  "Clear motion path": "Rimuovi il percorso di movimento",
  "Preview file · drag onto the timeline to place it":
    "Anteprima del file · trascina sulla timeline per inserirlo",
  "File name": "Nome del file",
  "Save file name": "Salva il nome del file",
  "Cancel rename": "Annulla la rinomina",
  "Preview your file. Drag its thumbnail onto the timeline at the time you want it to start.":
    "Controlla l'anteprima. Trascina la miniatura sulla timeline nel punto in cui vuoi che inizi.",
  "Free · editable layers": "Gratuito · livelli modificabili",
  "Original animations rendered on your device. Customize, insert, then refine each layer on the timeline.":
    "Animazioni originali renderizzate sul tuo dispositivo. Personalizza, inserisci e perfeziona ogni livello sulla timeline.",
  "Measured percentage": "Percentuale misurata",
  "Logo from Library": "Logo dalla Libreria",
  "Use a transparent PNG or WebP for a logo without a background.":
    "Usa un PNG o WebP trasparente per un logo senza sfondo.",
  "Duration (seconds)": "Durata (secondi)",
  "Add overlapping video footage to track this graphic.":
    "Aggiungi un video sovrapposto per tracciare questa grafica.",
  "Region tracking attaches 2D graphics. Choose a text, callout, or vector shape.":
    "Il tracciamento dell'area collega grafiche 2D. Scegli un testo, un richiamo o una forma vettoriale.",
  "Attach to moving region": "Collega a un'area in movimento",
  "Draw around a distinctive edge, logo, or textured object. Tracking follows its 2D position and keeps your graphic’s initial offset. Review the path before applying it.":
    "Disegna intorno a un bordo riconoscibile, un logo o un oggetto con texture. Il tracciamento segue la posizione 2D e mantiene lo scostamento iniziale della grafica. Verifica il percorso prima di applicarlo.",
  "Tracking source clip": "Clip di origine del tracciamento",
  "Draw tracking region on source footage":
    "Disegna l'area da tracciare sul video originale",
  "Tracking seed frame": "Fotogramma iniziale del tracciamento",
  Region: "Area",
  "Set region with numeric controls": "Imposta l'area con i controlli numerici",
  "Source seconds to track · up to":
    "Secondi della fonte da tracciare · fino a",
  "Analysing decoded frames…": "Analisi dei fotogrammi decodificati…",
  "Track region · free": "Traccia l'area · gratuito",
  "Stops on lost or ambiguous matches. Rotation, scale changes, scene cuts and occlusion may require a shorter interval. Applying replaces the motion path and limits the graphic to the observed interval.":
    "Si interrompe quando perde il riferimento o trova corrispondenze ambigue. Rotazione, scala, tagli di scena e oggetti coperti possono richiedere intervalli più brevi. L'applicazione sostituisce il percorso e limita la grafica all'intervallo osservato.",
  "Review tracked path ·": "Verifica il percorso tracciato ·",
  "Tracked graphic review time": "Tempo di verifica della grafica tracciata",
  "editable keyframes ·": "fotogrammi chiave modificabili ·",
  "s observed": "s osservati",
  "Apply tracked path": "Applica il percorso tracciato",
  "Platform operations": "Gestione della piattaforma",
  "Private to the platform operator.":
    "Riservato al gestore della piattaforma.",
  "Finish payment setup": "Completa la configurazione dei pagamenti",
  "Open Stripe account setup": "Apri la configurazione dell'account Stripe",
  "Library:": "Libreria:",
  "GB stored": "GB archiviati",
  "Weekly trends:": "Tendenze settimanali:",
  "Reconcile these events in Stripe, then resend them":
    "Verifica questi eventi in Stripe, poi inviali di nuovo",
  "Configuration checks do not verify provider balances or live payments. Updated":
    "I controlli di configurazione non verificano i saldi dei fornitori o i pagamenti reali. Aggiornato",
  "Find in this project": "Cerca in questo progetto",
  "Search transcript words, recorded scene observations, and clip names. Visual descriptions are searchable after source analysis exists. Search uses no AI credits. Meaning search compares English descriptions on your device against this existing text evidence.":
    "Cerca nelle trascrizioni, nelle osservazioni delle scene e nei nomi delle clip. Le descrizioni visive sono disponibili dopo l'analisi della fonte. La ricerca non usa crediti AI. La ricerca semantica confronta sul dispositivo le descrizioni in inglese con i testi esistenti.",
  "Exact words": "Parole esatte",
  "Meaning · English": "Significato · inglese",
  "Search project words or descriptions":
    "Cerca parole o descrizioni nel progetto",
  "Try a spoken phrase or “coffee cup”":
    "Prova una frase pronunciata o «tazza di caffè»",
  "The first search loads about 46 MB of local model resources. Text stays on this device. Results show related evidence, not verified visual observations.":
    "La prima ricerca carica circa 46 MB di risorse locali. Il testo resta sul dispositivo. I risultati mostrano evidenze correlate, non osservazioni visive verificate.",
  "Find related moments": "Trova momenti correlati",
  "This search uses the first 256 distinct evidence excerpts. Exact words searches additional evidence.":
    "Questa ricerca usa i primi 256 estratti distinti. Parole esatte cerca anche nelle altre evidenze.",
  "No attributable text evidence is available yet.":
    "Non ci sono ancora evidenze testuali attribuibili.",
  "Results link to the exact source clip and timeline time. Clip-name matches describe file labels.":
    "I risultati rimandano alla clip e al tempo esatti sulla timeline. Le corrispondenze nei nomi delle clip descrivono le etichette dei file.",
  "Meaning match": "Corrispondenza semantica",
  "Picture hidden": "Immagine nascosta",
  "Sound muted": "Audio disattivato",
  "prepared · final checks happen when you publish.":
    "preparato · i controlli finali avvengono alla pubblicazione.",
  "Choose an owned video, upload an original, or import a final video file. Import and measurement use no AI credits. Analysis is a separate action at the measured quote. Reference source timestamps are mapped to your own footage when planning edits.":
    "Scegli un tuo video, carica l'originale o importa un file video. Importazione e misurazione non usano crediti AI. L'analisi è un'azione separata con un preventivo misurato. I tempi del riferimento vengono associati alle tue riprese durante la pianificazione.",
  "Reference video": "Video di riferimento",
  "Reference direct video link": "Link diretto al video di riferimento",
  "Direct imports: up to 256 MB and 2 minutes.":
    "Importazione diretta: fino a 256 MB e 2 minuti.",
  "Import private reference · no AI credits":
    "Importa un riferimento privato · nessun credito AI",
  "Upload reference": "Carica riferimento",
  "I may download this reference and submit it to the AI analysis provider.":
    "Posso scaricare questo riferimento e inviarlo al servizio di analisi AI.",
  "Measure duration · no AI credits": "Misura la durata · nessun credito AI",
  "Measured reference:": "Riferimento misurato:",
  "seconds · analysis costs": "secondi · costo dell'analisi",
  "credits.": "crediti.",
  "Export your video": "Esporta il tuo video",
  "Your device renders your cuts, images, motion graphics, captions and audio. Download the result or save it to your Library.":
    "Il tuo dispositivo renderizza tagli, immagini, animazioni, sottotitoli e audio. Scarica il risultato o salvalo nella Libreria.",
  "Save to": "Salva in",
  "Export destination": "Destinazione dell'esportazione",
  "This project includes AI media. Library saving finalizes its AI source marking before download.":
    "Questo progetto include contenuti AI. Il salvataggio nella Libreria completa la marcatura di origine AI prima del download.",
  Resolution: "Risoluzione",
  "Frame rate": "Fotogrammi al secondo",
  "Export frame rate": "Fotogrammi al secondo dell'esportazione",
  "Export format": "Formato di esportazione",
  "canvas ·": "tela ·",
  "fps. Rendering uses this device’s processor and memory. Keep this page open while exporting. Templates and rendering use no AI credits; Library storage and AI generation have their own allowances.":
    "fps. Il rendering usa processore e memoria del dispositivo. Mantieni aperta questa pagina durante l'esportazione. Modelli e rendering non usano crediti AI; archiviazione e generazione AI hanno limiti separati.",
  "4K needs more memory and time, especially for long timelines or several video layers.":
    "Il 4K richiede più memoria e tempo, soprattutto con timeline lunghe o più livelli video.",
  "The workspace changed. Close this dialog and reopen export in the intended workspace.":
    "Lo spazio di lavoro è cambiato. Chiudi la finestra e riapri l'esportazione nello spazio corretto.",
  "Your video is ready to download. No copy was uploaded to Library.":
    "Il video è pronto da scaricare. Nessuna copia è stata caricata nella Libreria.",
  "Your video is ready": "Il video è pronto",
  "Prepare publication": "Prepara la pubblicazione",
  "Cancel export": "Annulla esportazione",
  Download: "Scarica",
  "Download edit brief instead": "Scarica invece le indicazioni di montaggio",
  "Export engine licenses": "Licenze del motore di esportazione",
  "Uses existing media and measured speech. No AI credits. Apply creates one saved revision; Undo restores the previous edit.":
    "Usa file esistenti e tempi del parlato misurati. Nessun credito AI. Applica crea una revisione salvata; Annulla modifica ripristina il montaggio precedente.",
  "Picture clips to edit": "Clip visive da modificare",
  "Add picture footage first.": "Aggiungi prima delle riprese video.",
  "Beat cuts also split linked audio:":
    "I tagli sul ritmo dividono anche l'audio collegato:",
  ". Independent music and other layers stay in place.":
    ". La musica indipendente e gli altri livelli restano al loro posto.",
  "Beat cuts": "Tagli sul ritmo",
  "Measures percussive onsets from the actual waveform, up to five minutes / 16 MB. Review points before cutting. This does not infer downbeats or rearrange shots.":
    "Misura gli attacchi percussivi dalla forma d'onda reale, fino a cinque minuti / 16 MB. Verifica i punti prima di tagliare. Non individua automaticamente gli accenti musicali e non riordina le scene.",
  "Beat audio source": "Fonte audio del ritmo",
  "Sensitivity ·": "Sensibilità ·",
  "Beat sensitivity": "Sensibilità del ritmo",
  "Use every Nth onset": "Usa un attacco ogni N",
  "Beat interval": "Intervallo degli attacchi",
  "Minimum gap (seconds)": "Distanza minima (secondi)",
  "Minimum beat gap": "Distanza minima tra gli attacchi",
  "No strong onsets were measured in the retained interval. No cut points were invented.":
    "Non sono stati rilevati attacchi forti nell'intervallo selezionato. Nessun punto di taglio è stato aggiunto.",
  "Apply beat cuts": "Applica i tagli sul ritmo",
  "Use wider spacing to stay within 48 cut points.":
    "Aumenta la distanza per restare entro 48 punti di taglio.",
  "Speech autozoom": "Zoom automatico sul parlato",
  "Alternates restrained punch-ins at measured phrase changes. Each picture clip needs a transcript with word timing. Position stays as authored; this does not track a face or camera.":
    "Alterna zoom moderati ai cambi di frase misurati. Ogni clip visiva richiede una trascrizione con tempi delle parole. La posizione resta quella impostata: non traccia volti o camera.",
  "Zoom ·": "Zoom ·",
  "Speech zoom amount": "Intensità dello zoom sul parlato",
  "Replace existing motion": "Sostituisci il movimento esistente",
  "Apply speech zoom": "Applica lo zoom sul parlato",
  "Saved editor styles": "Stili di montaggio salvati",
  "Saved styles": "Stili salvati",
  "· editable": "· modificabile",
  Capture: "Acquisisci",
  "Selected graphic and its full animation":
    "Grafica selezionata e animazione completa",
  "Project caption style": "Stile dei sottotitoli del progetto",
  "Selected clip pose and grade at playhead":
    "Posa e colore della clip selezionata al cursore",
  "Style name": "Nome dello stile",
  "Name this style": "Assegna un nome allo stile",
  "The full graphic animation is saved. Apply it to insert a new editable graphic.":
    "Viene salvata l'animazione grafica completa. Applicala per inserire una nuova grafica modificabile.",
  "Delete a saved style to make room for another.":
    "Elimina uno stile salvato per aggiungerne un altro.",
  "Search saved styles": "Cerca stili salvati",
  "Search saved styles…": "Cerca stili salvati…",
  "Save a graphic, caption style or clip look to reuse it across your projects.":
    "Salva una grafica, uno stile di sottotitoli o un trattamento della clip per riutilizzarlo nei progetti.",
  Brightness: "Luminosità",
  Contrast: "Contrasto",
  "· Color": "· Colore",
  Opacity: "Opacità",
  "Saved scenes": "Scene salvate",
  "Reuse a saved scene": "Riutilizza una scena salvata",
  "Reuse a subject, setting, and style":
    "Riutilizza soggetto, ambientazione e stile",
  "Scene name": "Nome della scena",
  "Name this scene": "Assegna un nome alla scena",
  "Save scene": "Salva scena",
  "Planned script beats": "Passaggi previsti dello script",
  "Planned script timing in seconds, spoken lines, screen text and visual direction":
    "Tempi previsti in secondi, testo parlato, testo sullo schermo e indicazioni visive",
  "Planned time": "Tempo previsto",
  Spoken: "Parlato",
  "On screen": "Sullo schermo",
  Visual: "Visivo",
  "No writing plan is stored with this draft. You can still edit and save its script.":
    "Questa bozza non contiene un piano di scrittura. Puoi comunque modificare e salvare lo script.",
  "Generated writing plan": "Piano di scrittura generato",
  "Writing options": "Opzioni di scrittura",
  "Hooks are ranked for fit with this brief. Beat timing is a plan; recorded speech may differ.":
    "Le aperture sono ordinate per aderenza al brief. I tempi sono indicativi: il parlato registrato può differire.",
  "The spoken script has changed. These generated options remain available; revise the beat plan before using it with the edited narration.":
    "Il testo parlato è cambiato. Le opzioni generate restano disponibili; rivedi il piano prima di usarlo con la narrazione modificata.",
  "10 hooks": "10 aperture",
  "Beat plan": "Piano dei passaggi",
  "Other CTAs": "Altri inviti all'azione",
  "Ranked hook alternatives": "Alternative di apertura ordinate",
  "Screen text and selection reason":
    "Testo sullo schermo e motivo della scelta",
  "Creative selection": "Scelta creativa",
  "Planned seconds, spoken lines and production direction. Review the timings after recording.":
    "Secondi previsti, testo parlato e indicazioni di produzione. Verifica i tempi dopo la registrazione.",
  "Owner connection check": "Controllo dei collegamenti del titolare",
  "Check OpenRouter key authentication and sound service settings. This check creates no media, spends no REELassati credits, and does not verify a generation.":
    "Verifica l'autenticazione della chiave OpenRouter e le impostazioni del servizio audio. Il controllo non crea file, non usa crediti REELassati e non prova una generazione.",
  "AI:": "AI:",
  "Sound effects:": "Effetti sonori:",
  Checked: "Verificato",
  ". Generation not tested.": ". Generazione non testata.",
  "Transition to next shot": "Transizione alla scena successiva",
  "Transition between shots": "Transizione tra le scene",
  "Shot transition duration": "Durata della transizione tra le scene",
  "Uses unused footage around the cut. Speech timing and total edit length stay fixed. Other overlapping video layers must be resolved first.":
    "Usa le riprese non utilizzate intorno al taglio. Tempi del parlato e durata totale restano invariati. Prima risolvi le sovrapposizioni degli altri livelli video.",
  "Apply between shots": "Applica tra le scene",
  "Remove this transition before moving, trimming, splitting or deleting its shots.":
    "Rimuovi la transizione prima di spostare, tagliare, dividere o eliminare le scene collegate.",
  "Remove transition": "Rimuovi transizione",
  "Social performance": "Risultati social",
  "Lifetime results for posts published in the selected period. Reach is summed per post, not deduplicated across people.":
    "Risultati complessivi dei post pubblicati nel periodo scelto. La copertura viene sommata per post, senza distinguere le persone duplicate.",
  "Social performance period": "Periodo dei risultati social",
  "7 days": "7 giorni",
  "30 days": "30 giorni",
  "90 days": "90 giorni",
  "Social metrics by publication date":
    "Metriche social per data di pubblicazione",
  "Connect social accounts": "Collega account social",
  "Top posts by": "Post migliori per",
  Post: "Post",
  "Runs locally in your browser without a provider credit charge.":
    "Funziona localmente nel browser senza addebiti del fornitore.",
  "Source image": "Immagine originale",
  "Choose a Library image": "Scegli un'immagine dalla Libreria",
  "PNG, JPEG or still WebP · up to 20 MB / 4 MP / 4096 px per side.":
    "PNG, JPEG o WebP statico · fino a 20 MB / 4 MP / 4096 px per lato.",
  "Relative depth supports aspect ratios from 1:2 to 2:1, including 9:16 and 16:9.":
    "La profondità relativa supporta formati da 1:2 a 2:1, inclusi 9:16 e 16:9.",
  "Person threshold ·": "Soglia della persona ·",
  "Edge softness ·": "Morbidezza dei bordi ·",
  "Invert light and dark depth": "Inverti profondità chiara e scura",
  "Preparing the updated PNG preview…":
    "Preparazione dell'anteprima PNG aggiornata…",
  "Save PNG to Library": "Salva PNG nella Libreria",
  "Story sections": "Sezioni della storia",
  "Content changed · refresh sections":
    "Contenuto modificato · aggiorna le sezioni",
  "Jump to a story section": "Vai a una sezione della storia",
  "Section name": "Nome della sezione",
  Role: "Ruolo",
  "Story section role": "Ruolo della sezione nella storia",
  "(seconds)": "(secondi)",
  "Remove section marker": "Rimuovi il marcatore della sezione",
  "Close section editing": "Chiudi la modifica della sezione",
  "These markers organize your story. Editing them does not cut or remove footage.":
    "Questi marcatori organizzano la storia. Modificarli non taglia né elimina le riprese.",
  "Open connected media tray": "Apri i file multimediali collegati",
  "Connected media": "File multimediali collegati",
  "Recent uploads and generations, ready for Edit.":
    "Caricamenti e generazioni recenti, pronti per il montaggio.",
  Synced: "Sincronizzato",
  "· use in Edit": "· usa nel montaggio",
  "No media yet": "Nessun file multimediale",
  "Upload or generate something and it will appear here.":
    "Carica o genera un contenuto per vederlo qui.",
  "Full library": "Libreria completa",
  "Open Edit": "Apri il montaggio",
  "Track names and mix settings are saved with the project. Solo sound isolates source audio; solo picture isolates visual layers. Reordering changes layer order within the same track family.":
    "Nomi delle tracce e impostazioni del mixer vengono salvati con il progetto. Solo audio isola l'audio originale; Solo immagine isola i livelli visivi. Il riordino cambia l'ordine dei livelli dello stesso tipo.",
  Gain: "Volume",
  "Solo sound": "Solo audio",
  "Solo picture": "Solo immagine",
  "Add media to create a track.": "Aggiungi un file per creare una traccia.",
  "Drag across this time ruler, adjust the range, then describe the change. Send the selection to Reel.":
    "Trascina sul righello temporale, regola l'intervallo e descrivi la modifica. Invia la selezione a Reel.",
  "Drag to select editing range":
    "Trascina per selezionare l'intervallo di montaggio",
  "Set range with controls": "Imposta l'intervallo con i controlli",
  "Range start": "Inizio dell'intervallo",
  "Prompt range start": "Inizio dell'intervallo della richiesta",
  "Range end": "Fine dell'intervallo",
  "Prompt range end": "Fine dell'intervallo della richiesta",
  "Edit this range": "Modifica questo intervallo",
  "What should change here?": "Cosa vuoi cambiare qui?",
  "Local mode supports color, framing, fades, audio level, captions editable graphics and existing overlays. Timing changes that affect the rest of the edit need the main AI editor.":
    "La modalità locale supporta colore, inquadratura, dissolvenze, volume, sottotitoli, grafiche modificabili e sovrapposizioni esistenti. Le modifiche temporali che coinvolgono il resto del montaggio richiedono l'editor AI principale.",
  "Send to Reel": "Invia a Reel",
  "Align moved clips and trimmed edges with the playhead and other clips.":
    "Allinea le clip spostate e i bordi tagliati al cursore e alle altre clip.",
  "Clip snapping": "Aggancio delle clip",
  "Editing timeline": "Timeline di montaggio",
  "Timeline playhead": "Cursore della timeline",
  "Cut footage from transcript": "Taglia le riprese dalla trascrizione",
  "Cut footage by word": "Taglia le riprese per parola",
  "Restore last transcript cut":
    "Ripristina l'ultimo taglio dalla trascrizione",
  "Select spoken words to remove their measured time from the footage, audio and other unlocked tracks, closing the gaps. No AI credits.":
    "Seleziona le parole pronunciate per eliminare il loro intervallo dalle riprese, dall'audio e dalle altre tracce sbloccate, chiudendo gli spazi. Nessun credito AI.",
  "Word cuts need measured word timings attached to audible video or audio. Captions without them remain editable in the caption controls.":
    "I tagli per parola richiedono tempi misurati associati a video o audio udibili. I sottotitoli senza questi tempi restano modificabili nei controlli dei sottotitoli.",
  "Clear selection": "Deseleziona tutto",
  Transform: "Trasformazione",
  "Transform animation": "Animazione della trasformazione",
  "Position is a percentage of the canvas. Once keyframes exist, changing a value adds or updates a keyframe at the playhead. Trimming and splitting preserve the animation's source timing.":
    "La posizione è una percentuale della tela. Con i fotogrammi chiave attivi, modificare un valore aggiunge o aggiorna il punto al cursore. Tagli e divisioni conservano i tempi originali dell'animazione.",
  Reset: "Ripristina",
  "This clip has 24 keyframes. Select an existing keyframe to adjust its pose, or remove one before adding another.":
    "Questa clip ha 24 fotogrammi chiave. Selezionane uno per modificarne la posa oppure rimuovine uno prima di aggiungerne un altro.",
  "Blend mode": "Metodo di fusione",
  "Keyframes ·": "Fotogrammi chiave ·",
  "Frame crop & mask": "Ritaglio e maschera",
  "Crop hides canvas edges before the transform; media underneath stays visible.":
    "Il ritaglio nasconde i bordi della tela prima della trasformazione; i file sottostanti restano visibili.",
  "Mask shape": "Forma della maschera",
  "Polygon mask points": "Punti della maschera poligonale",
  "Canvas percentages before transforms. Three to twelve points. Intersections use the even-odd fill rule.":
    "Percentuali della tela prima delle trasformazioni. Da tre a dodici punti. Le intersezioni usano la regola di riempimento pari-dispari.",
  Point: "Punto",
  "Add mask point": "Aggiungi un punto alla maschera",
  Triangle: "Triangolo",
  "Corner radius %": "Raggio degli angoli %",
  "Visual transitions": "Transizioni visive",
  "These affect the picture only. To transition between two shots, overlap them on separate video lanes and apply an entrance to the upper clip. Keep the outgoing shot fully visible for a clean dissolve.":
    "Agiscono solo sull'immagine. Per passare tra due scene, sovrapponile su tracce video separate e applica un'entrata alla clip superiore. Mantieni visibile la scena in uscita per una dissolvenza pulita.",
  "Clear transitions": "Rimuovi le transizioni",
  "Voice sample": "Esempio della voce",
  "Retry voice sample": "Riprova l'esempio della voce",
  "Find your voice": "Trova la tua voce",
  "voices ·": "voci ·",
  "native languages": "lingue native",
  "Filter voices by native language": "Filtra le voci per lingua nativa",
  "All languages": "Tutte le lingue",
  "Filter voices by description": "Filtra le voci per descrizione",
  "All styles": "Tutti gli stili",
  "Search narration, warm, Italian…": "Cerca narrazione, calda, italiano…",
  "Search voices": "Cerca voci",
  "Available voices": "Voci disponibili",
  "No voices match. Try another language or style.":
    "Nessuna voce corrisponde. Prova un'altra lingua o stile.",
  "· ElevenLabs voices support multilingual text at a lower credit cost. Choose one, then listen to its sample.":
    "· Le voci ElevenLabs supportano testi multilingue a un costo inferiore in crediti. Scegli una voce e ascolta l'esempio.",
  "Speaks 90+ languages, including Italian, with expressive delivery. Uses the lower voice credit rate.":
    "Parla più di 90 lingue, incluso l'italiano, con espressività. Usa la tariffa voce inferiore.",
  "Download audio": "Scarica audio",
  breadcrumb: "percorso di navigazione",
  More: "Altro",
  "Previous slide": "Diapositiva precedente",
  "Next slide": "Diapositiva successiva",
  Close: "Chiudi",
  pagination: "paginazione",
  "Go to previous page": "Vai alla pagina precedente",
  Previous: "Precedente",
  "Go to next page": "Vai alla pagina successiva",
  Next: "Successivo",
  "More pages": "Altre pagine",
  Sidebar: "Barra laterale",
  "Displays the mobile sidebar.": "Mostra la barra laterale su mobile.",
  "Toggle Sidebar": "Mostra o nascondi la barra laterale",
  Loading: "Caricamento",
  "Select an option": "Seleziona un'opzione",
  "Published posts": "Post pubblicati",
  "Scheduled posts": "Post programmati",
  "Created media": "File creati",
  "Created scripts": "Script creati",
  "Started edits": "Montaggi avviati",
  "Active edits": "Montaggi attivi",
  "Ready assets": "File pronti",
  "Published records": "Pubblicazioni registrate",
  "Keep at least one metric selected":
    "Mantieni selezionata almeno una metrica",
  Hide: "Nascondi",
  Show: "Mostra",
  post: "post",
  posts: "post",
  "Payment confirmed. Your credits are ready—let’s create something.":
    "Pagamento confermato. I crediti sono disponibili: iniziamo a creare.",
  "This checkout expired. You can start a new purchase.":
    "Questa sessione di pagamento è scaduta. Puoi avviare un nuovo acquisto.",
  "Confirming your payment and credits. This page checks automatically; delayed payment methods may take longer.":
    "Conferma del pagamento e dei crediti. La verifica è automatica; alcuni metodi di pagamento richiedono più tempo.",
  "Covers one 15-second 720p video with audio, plus 100 credits.":
    "Include un video da 15 secondi in 720p con audio, più 100 crediti.",
  "Room for two 15-second 720p videos with audio, plus 200 credits.":
    "Include due video da 15 secondi in 720p con audio, più 200 crediti.",
  "Room for five 15-second 720p videos with audio, plus 500 credits.":
    "Include cinque video da 15 secondi in 720p con audio, più 500 crediti.",
  "Opening…": "Apertura…",
  "Purchases opening soon": "Acquisti disponibili a breve",
  "Active plan required": "Serve un piano attivo",
  "Add credits": "Aggiungi crediti",
  " · 2 months free": " · 2 mesi gratuiti",
  "Your first momentum": "Il tuo primo slancio",
  "More room to create": "Più spazio per creare",
  "Your biggest ideas": "Le tue idee più grandi",
  "Current plan": "Piano attuale",
  Recommended: "Consigliato",
  "For one creator finding a consistent rhythm.":
    "Per un creator che cerca un ritmo costante.",
  "For frequent creators running several channels.":
    "Per chi crea spesso e gestisce più canali.",
  "For a larger content output across your channels.":
    "Per una produzione di contenuti più ampia sui tuoi canali.",
  "Billed monthly · cancel renewal anytime":
    "Fatturazione mensile · annulla il rinnovo quando vuoi",
  "Opening secure checkout…": "Apertura del pagamento sicuro…",
  "Manage your plan": "Gestisci il piano",
  Ends: "Termina",
  "Period ends": "Fine del periodo",
  Images: "Immagini",
  "Music & SFX": "Musica ed effetti sonori",
  Analysis: "Analisi",
  Transcription: "Trascrizione",
  Editing: "Montaggio",
  Research: "Ricerca",
  "Loading credit usage…": "Caricamento dell'utilizzo dei crediti…",
  "Usage could not be loaded. Try Refresh.":
    "Impossibile caricare l'utilizzo. Prova Aggiorna.",
  "No credits used in this period. Your first creation will appear here.":
    "Nessun credito utilizzato nel periodo. La prima creazione apparirà qui.",
  "Completed AI actions · UTC dates · failed and pending jobs excluded.":
    "Azioni AI completate · date UTC · operazioni in attesa e non riuscite escluse.",
  Task: "Attività",
  Shoot: "Riprese",
  Meeting: "Incontro",
  "Add a title and date.": "Aggiungi un titolo e una data.",
  "End time must be after start time.":
    "L'orario di fine deve essere successivo all'inizio.",
  "Calendar event deleted": "Evento eliminato dal calendario",
  "Coming up": "In programma",
  "This day is open": "Nessun impegno per questo giorno",
  "Nothing coming up": "Nessun impegno in arrivo",
  "Edit event": "Modifica evento",
  "Add calendar event": "Aggiungi evento al calendario",
  "Saving…": "Salvataggio…",
  "Save changes": "Salva modifiche",
  "All day": "Tutto il giorno",
  "Unsaved Brand DNA changes": "Modifiche al DNA del brand non salvate",
  "Brand DNA is saved": "DNA del brand salvato",
  "The latest workspace data could not be loaded.":
    "Impossibile caricare i dati aggiornati dello spazio di lavoro.",
  Refreshing: "Aggiornamento",
  "Waiting for save": "In attesa del salvataggio",
  "Refresh review": "Aggiorna il riepilogo",
  All: "Tutti",
  Exports: "Esportazioni",
  Image: "Immagine",
  Script: "Script",
  Export: "Esportazione",
  "Asset uploaded": "File caricato",
  "Upload media": "Carica file",
  "Drop files here": "Trascina qui i file",
  "or drop a file here": "oppure trascina qui un file",
  "No matching content": "Nessun contenuto trovato",
  "Your reusable library starts here": "La tua libreria inizia qui",
  "Change the search or filter to reveal more items.":
    "Cambia ricerca o filtro per vedere altri elementi.",
  "Upload real media here, or create a script and it will appear automatically.":
    "Carica file qui oppure crea uno script: apparirà automaticamente.",
  "Remove favorite": "Rimuovi dai preferiti",
  "Add favorite": "Aggiungi ai preferiti",
  "A clean 9:16 timeline with every decision under your control.":
    "Una timeline 9:16 essenziale con ogni scelta sotto il tuo controllo.",
  "Dialogue-first pacing with room for captions and supporting shots.":
    "Ritmo centrato sul dialogo, con spazio per sottotitoli e scene di supporto.",
  "Structure product footage around an opening claim and visual proof.":
    "Organizza le riprese del prodotto intorno a un'affermazione iniziale e a una prova visiva.",
  "Project created": "Progetto creato",
  "Add source video or a transcript to find story sections.":
    "Aggiungi un video o una trascrizione per individuare le sezioni della storia.",
  "This timeline needs more source analysis than one request allows. Analyze the main footage first, then find sections.":
    "Questa timeline richiede più analisi di quante ne consenta una richiesta. Analizza prima le riprese principali, poi cerca le sezioni.",
  "No reliable story sections were found in this footage.":
    "Non sono state individuate sezioni affidabili in queste riprese.",
  "The footage changed while sections were being found. Refresh sections for the current edit.":
    "Le riprese sono cambiate durante la ricerca. Aggiorna le sezioni per il montaggio attuale.",
  "Select a clip to nudge.": "Seleziona una clip da spostare.",
  "Select a video or image to apply this look.":
    "Seleziona un video o un'immagine per applicare questo stile.",
  "Move the playhead inside the edit before inserting a saved graphic.":
    "Sposta il cursore all'interno del montaggio prima di inserire una grafica salvata.",
  "Correct the caption time ranges before saving.":
    "Correggi gli intervalli dei sottotitoli prima di salvare.",
  "Captions changed while you were editing. Load the saved captions before applying another revision.":
    "I sottotitoli sono cambiati durante la modifica. Carica quelli salvati prima di applicare un'altra revisione.",
  project: "progetto",
  projects: "progetti",
  "Adding…": "Aggiunta…",
  "New edit with media": "Nuovo montaggio con questi file",
  "Drop files to start the edit": "Trascina i file per iniziare il montaggio",
  "Upload footage to a new edit": "Carica riprese in un nuovo montaggio",
  "Video duration": "Durata del video",
  "Set end": "Imposta la fine",
  "Fit to content": "Adatta al contenuto",
  "Select a video or image on the timeline.":
    "Seleziona un video o un'immagine sulla timeline.",
  "The source or graphic changed during tracking. Track the current version again.":
    "La fonte o la grafica è cambiata durante il tracciamento. Traccia di nuovo la versione attuale.",
  "Keep captions from different source clips separate.":
    "Mantieni separati i sottotitoli delle diverse clip di origine.",
  Saving: "Salvataggio",
  "Save failed": "Salvataggio non riuscito",
  "Export video": "Esporta video",
  "Timeline preview": "Anteprima della timeline",
  "Pause timeline": "Metti in pausa la timeline",
  "Play timeline": "Riproduci la timeline",
  "9:16 Portrait": "9:16 Verticale",
  "16:9 Landscape": "16:9 Orizzontale",
  "1:1 Square": "1:1 Quadrato",
  On: "Attivo",
  Off: "Disattivato",
  "These shortcuts work for this session, but this browser could not save them.":
    "Le scorciatoie funzionano per questa sessione, ma il browser non ha potuto salvarle.",
  Followers: "Follower",
  "Engagement rate": "Tasso di interazione",
  Views: "Visualizzazioni",
  "Enter a target greater than zero.":
    "Inserisci un obiettivo maggiore di zero.",
  "Goal created": "Obiettivo creato",
  "Progress must be zero or a positive number.":
    "Il progresso deve essere zero o un numero positivo.",
  " · all platforms": " · tutte le piattaforme",
  "Image generated": "Immagine generata",
  "AI generation is temporarily unavailable. Your interview answers remain on this screen so you can try again later.":
    "La generazione AI è temporaneamente non disponibile. Le risposte restano in questa schermata per riprovare più tardi.",
  "Interview script generated": "Script dell'intervista generato",
  "Clipboard access was blocked. Select the script and copy it manually.":
    "Accesso agli appunti bloccato. Seleziona lo script e copialo manualmente.",
  Copied: "Copiato",
  Copy: "Copia",
  "Edit draft": "Modifica bozza",
  "New publication": "Nuova pubblicazione",
  "Italian disclosure": "Informativa in italiano",
  "English disclosure": "Informativa in inglese",
  "Disclosure language not recorded": "Lingua dell'informativa non registrata",
  "No destination": "Nessuna destinazione",
  "Copying was blocked by the browser. Select the value and copy it manually.":
    "Copia bloccata dal browser. Seleziona il valore e copialo manualmente.",
  "The share panel could not open. Copy the referral link instead.":
    "Impossibile aprire il pannello di condivisione. Copia il link di invito.",
  "Earn 500 credits—$5.00 of REELassati product value—when a referred creator successfully buys a paid plan. Link visits and sign-ups do not count.":
    "Guadagna 500 crediti, equivalenti a 5,00 $ su REELassati, quando un creator invitato acquista un piano. Visite al link e registrazioni non contano.",
  "Share a creator link and keep referrals attached. Rewards activate after paid-plan billing and signed purchase verification are connected.":
    "Condividi il link e conserva gli inviti collegati. I premi si attivano dopo il collegamento della fatturazione e della verifica degli acquisti.",
  "Paid-plan purchases verified by the billing system.":
    "Acquisti di piani verificati dal sistema di fatturazione.",
  "Claims are saved; qualification remains locked until billing is connected.":
    "Gli inviti sono salvati; l'idoneità resta bloccata finché la fatturazione non è collegata.",
  Pending: "In attesa",
  "Attach it once. The reward unlocks only after your first successful paid-plan purchase.":
    "Collegalo una volta. Il premio si sblocca solo dopo il primo acquisto di un piano.",
  "Attach it once. It remains pending until signed billing verification is available.":
    "Collegalo una volta. Resta in attesa finché la verifica degli acquisti non è disponibile.",
  "Your account or brand changed. Start again in the intended workspace.":
    "L'account o il brand è cambiato. Ricomincia nello spazio di lavoro desiderato.",
  "The destination workspace changed before saving this script.":
    "Lo spazio di destinazione è cambiato prima del salvataggio dello script.",
  "Clipboard access is blocked. Select the script text and copy it manually.":
    "Accesso agli appunti bloccato. Seleziona il testo dello script e copialo manualmente.",
  Edited: "Modificato",
  "Saving edits": "Salvataggio delle modifiche",
  "Save edits": "Salva modifiche",
  Capabilities: "Servizi",
  "Workspace database": "Database dello spazio di lavoro",
  "Private media storage": "Archivio multimediale privato",
  "Writing and edit intelligence": "Scrittura e montaggio assistiti",
  "Voice generation": "Generazione vocale",
  "Video generation": "Generazione video",
  "Unsaved profile changes": "Modifiche al profilo non salvate",
  "Profile is saved": "Profilo salvato",
  Configured: "Configurato",
  "Setup needed": "Da configurare",
  Syncing: "Sincronizzazione",
  "Sync accounts": "Sincronizza gli account",
  "Publishing connection is ready": "Collegamento alla pubblicazione pronto",
  "Publishing setup is incomplete":
    "Configurazione della pubblicazione incompleta",
  "Account data below comes from the connected publishing service. Follower and growth analytics are not invented or estimated here.":
    "I dati degli account provengono dal servizio di pubblicazione collegato. Le statistiche di crescita e dei follower appaiono solo se disponibili.",
  "Publishing connections are temporarily unavailable until the managed service is ready.":
    "I collegamenti di pubblicazione sono temporaneamente non disponibili finché il servizio non è pronto.",
  "Not synced yet": "Non ancora sincronizzato",
  Connected: "Collegato",
  "OAuth connection": "Collegamento OAuth",
  "Already linked": "Già collegato",
  Connect: "Collega",
  "All short-form sources": "Tutte le fonti di video brevi",
  "All short-form styles": "Tutti gli stili di video brevi",
  "Creator-led": "Con creator in scena",
  "Product / demo": "Prodotto / demo",
  Educational: "Educativo",
  Faceless: "Senza volto in scena",
  "Overall performance": "Risultati complessivi",
  Reach: "Copertura",
  Engagement: "Interazioni",
  Retention: "Permanenza",
  Conversion: "Conversioni",
  "Format hypothesis saved": "Ipotesi di formato salvata",
  "New hypothesis": "Nuova ipotesi",
  "Researching sources…": "Ricerca nelle fonti…",
  "previous verified edition": "edizione precedente verificata",
  "current-week evidence": "evidenze della settimana attuale",
  Preparing: "In preparazione",
  "Awaiting verified picks": "In attesa della selezione verificata",
  "Previous edition": "Edizione precedente",
  "Updated weekly": "Aggiornato ogni settimana",
  "Credit research": "Ricerca con crediti",
  "Latest verified brand shorts": "Ultimi video dei brand verificati",
  "This week’s hyperviral brand shorts":
    "Video dei brand più virali della settimana",
  "A new edition is awaiting verification.":
    "Una nuova edizione è in attesa di verifica.",
  "Weekly update in preparation": "Aggiornamento settimanale in preparazione",
  "Your next idea can start here": "La tua prossima idea può partire da qui",
  "No matching evidence": "Nessuna evidenza trovata",
  "REELassati updates this feed internally; no action or credits are required from you.":
    "REELassati aggiorna questa selezione automaticamente, senza azioni o crediti richiesti.",
  "Verified weekly picks are not available yet. Keep creating from your own idea while the next automatic check runs.":
    "La selezione settimanale verificata non è ancora disponibile. Continua a creare dalle tue idee durante il prossimo controllo automatico.",
  "Change the filters or run custom research. REELassati will show fewer results rather than fill the feed with stale, paid, generic, or unverified content.":
    "Cambia i filtri o avvia una ricerca personalizzata. Vengono mostrati solo i risultati verificati e adatti alla selezione.",
  "The workspace changed before the imported video could be saved.":
    "Lo spazio di lavoro è cambiato prima del salvataggio del video importato.",
  "Select a video before running analysis.":
    "Seleziona un video prima di avviare l'analisi.",
  "The video review is incomplete. Please refresh before analyzing again.":
    "La revisione del video è incompleta. Aggiorna prima di analizzare di nuovo.",
  "The analysis workspace changed before saving its activity.":
    "Lo spazio dell'analisi è cambiato prima del salvataggio dell'attività.",
  "The analyzed source is no longer in this workspace.":
    "La fonte analizzata non è più in questo spazio di lavoro.",
  "The selected project is no longer available.":
    "Il progetto selezionato non è più disponibile.",
  "Drop it here": "Trascinalo qui",
  "Drop video here, or click · stored privately":
    "Trascina qui il video o fai clic · archiviazione privata",
  "Upload storage is not configured":
    "L'archiviazione dei caricamenti non è configurata",
  "Uploading source": "Caricamento della fonte",
  "Prepare video · no credits": "Prepara il video · nessun credito",
  "Reels, TikTok, Shorts": "Reels, TikTok, Shorts",
  "Landscape video": "Video orizzontale",
  "Square feed": "Contenuto quadrato",
  "Clipboard access is blocked. Select the prompt preview and copy it manually.":
    "Accesso agli appunti bloccato. Seleziona il prompt e copialo manualmente.",
  "Requested with the video": "Richiesto con il video",
  "Silent output requested": "Video senza audio richiesto",
  "New scene": "Nuova scena",
  "Continue a clip": "Continua una clip",
  "Hide reference frames": "Nascondi i fotogrammi di riferimento",
  "Add reference frames": "Aggiungi fotogrammi di riferimento",
  "Continuity Lock enabled": "Blocco di continuità attivo",
  "New clip": "Nuova clip",
  audio: "audio",
  silent: "senza audio",
  "Continuing the selected clip": "Continuazione della clip selezionata",
  "Creating a new clip": "Creazione di una nuova clip",
  "The recording duration could not be read. Choose a playable audio file.":
    "Impossibile leggere la durata della registrazione. Scegli un file audio riproducibile.",
  "Choose an audio file first.": "Scegli prima un file audio.",
  "Upload storage is not configured.":
    "L'archiviazione dei caricamenti non è configurata.",
  "No speech was found in this recording.":
    "Non è stato trovato parlato nella registrazione.",
  "Clipboard access is blocked. Select the script and copy it manually.":
    "Accesso agli appunti bloccato. Seleziona lo script e copialo manualmente.",
  "Drop audio here, or click · MP3, WAV, M4A":
    "Trascina qui l'audio o fai clic · MP3, WAV, M4A",
  Transcribing: "Trascrizione in corso",
  high: "alta",
  medium: "media",
  low: "bassa",
  "Short-form intelligence": "Intelligenza per i video brevi",
  "Your video, moment by moment": "Il tuo video, momento per momento",
  "Evidence complete": "Evidenze complete",
  "Incomplete report": "Analisi incompleta",
  "Editorial score": "Punteggio editoriale",
  "Overall score unavailable": "Punteggio complessivo non disponibile",
  "Full coverage and all four signals are required.":
    "Sono necessarie la copertura completa e tutte e quattro le metriche.",
  "Reason to keep watching": "Motivo per continuare a guardare",
  "Movement, edits and sound": "Movimento, montaggio e audio",
  "Competing information": "Informazioni in competizione",
  "Message and story coherence": "Coerenza del messaggio e della storia",
  "Current moment": "Momento attuale",
  "Source coverage": "Copertura del video",
  "Evidence confidence": "Affidabilità delle evidenze",
  Unavailable: "Non disponibile",
  Unclassified: "Non classificato",
  "Not detected": "Non rilevato",
  "Story structure": "Struttura della storia",
  "Signal timeline": "Andamento delle metriche",
  "Source time": "Tempo nel video originale",
  "Review below": "Revisiona sotto la soglia",
  "Review moments": "Momenti da rivedere",
  "No low-attention intervals at this threshold.":
    "Nessun intervallo con attenzione inferiore a questa soglia.",
  "{{count}} moments to review": "{{count}} momenti da rivedere",
  "Improve next": "Cosa migliorare",
  "Why it matters": "Perché conta",
  "Section evidence": "Evidenze della sezione",
  "Jump to moment": "Vai al momento",
  "Previous moment": "Momento precedente",
  "Next moment": "Momento successivo",
  "Pause video": "Metti in pausa il video",
  "Play video": "Riproduci il video",
  "Mute video": "Disattiva l'audio del video",
  "Unmute video": "Attiva l'audio del video",
  "Fullscreen video": "Video a schermo intero",
  "Playback position": "Posizione di riproduzione",
  "Playback could not start. Reload the source and try again.":
    "Impossibile avviare la riproduzione. Ricarica la fonte e riprova.",
  "The source preview could not load. Refresh the Library link.":
    "Impossibile caricare l'anteprima. Aggiorna il link della Libreria.",
  "Fullscreen is unavailable in this browser.":
    "Lo schermo intero non è disponibile in questo browser.",
  "Analysis data is incomplete. Run a new full-video analysis to populate all signals and story sections.":
    "I dati dell'analisi sono incompleti. Avvia una nuova analisi dell'intero video per ottenere tutte le metriche e le sezioni della storia.",
  "No supported observation was returned.":
    "Non è stata restituita un'osservazione supportata da evidenze.",
  "No classified story sections were returned.":
    "Non sono state restituite sezioni della storia classificate.",
  "No evidence covers this moment.": "Nessuna evidenza copre questo momento.",
  "vs previous moment": "rispetto al momento precedente",
  "How this score is calculated": "Come viene calcolato il punteggio",
  "Scores follow a fixed editorial rubric. They are not measured audience or neural responses.":
    "I punteggi seguono una griglia editoriale fissa. Non misurano le risposte del pubblico o l'attività neurale.",
  "Overall = 45% attention + 35% clarity + 20% processing ease. Processing ease = 100 − processing load. Stimulation describes intensity and is not rewarded automatically.":
    "Complessivo = 45% attenzione + 35% chiarezza + 20% facilità di elaborazione. Facilità di elaborazione = 100 − carico cognitivo. La stimolazione descrive l'intensità e non viene premiata automaticamente.",
  "The provider controls internal frame sampling.":
    "Il fornitore gestisce il campionamento interno dei fotogrammi.",
  "Complete source video and available audio":
    "Video originale completo e audio disponibile",
  "Full-duration video copy · {{fps}} fps":
    "Copia del video di durata completa · {{fps}} fps",
  "Research context": "Riferimenti di ricerca",
  "Limited-capacity model of message processing":
    "Modello a capacità limitata di elaborazione dei messaggi",
  "This rubric has not been calibrated as an audience or neural predictor.":
    "Questa griglia non è stata calibrata per prevedere le risposte del pubblico o l'attività neurale.",
  "Analysis playback position": "Posizione di riproduzione dell'analisi",
  "Editorial signals by source time":
    "Metriche editoriali nel tempo del video originale",
  "Seek to {{time}}": "Vai a {{time}}",
  "Select {{section}} section": "Seleziona la sezione {{section}}",
  "{{count}} observed moments": "{{count}} momenti osservati",
  Present: "Presente",
  Absent: "Assente",
  Uncertain: "Incerto",
  "Section not assessed": "Sezione non valutata",
  "Complete report": "Analisi completa",
  "Estimated editorial signals": "Metriche editoriali stimate",
  Observation: "Osservazione",
  "Processing ease": "Facilità di elaborazione",
  "Average across the video": "Media nell'intero video",
  "No complete signal timeline is available for this report.":
    "L'analisi non contiene un andamento completo delle metriche.",
  "Keep the original": "Mantieni l'originale",
  "Suggested changes": "Modifiche suggerite",
  "Edit suggestions do not represent rendered footage.":
    "Le modifiche suggerite non sono un video già renderizzato.",
  "Show all moments": "Mostra tutti i momenti",
  "Show selected moment": "Mostra il momento selezionato",
  Pause: "Pausa",
  Play: "Riproduci",
  "Unmute audio": "Attiva audio",
  "Mute audio": "Disattiva audio",
  "Audio download is unavailable. Reload its Library link and try again.":
    "Download audio non disponibile. Ricarica il link della Libreria e riprova.",
  "Audio could not load. Reload the source to try again.":
    "Impossibile caricare l'audio. Ricarica la fonte per riprovare.",
  "Playback could not start. Try again.":
    "Impossibile avviare la riproduzione. Riprova.",
  "A complete audiovisual review is being updated. Your credits stay available.":
    "La revisione audiovisiva completa è in aggiornamento. I tuoi crediti restano disponibili.",
  "Choose a video file": "Scegli un file video",
  "Preparing source…": "Preparazione della fonte…",
  "Analyzing edit": "Analisi del montaggio",
  "Analyze video · {{credits}} credits":
    "Analizza il video · {{credits}} crediti",
  "{{count}} recommendations": "{{count}} suggerimenti",
  recommendations: "suggerimenti",
  "The recommendations above require an editorial decision; no automatic timeline operation is proposed.":
    "I suggerimenti sopra richiedono una scelta editoriale; non è proposta alcuna operazione automatica sulla timeline.",
  Analyze: "Analizza",
  "Generate media": "Genera contenuti",
  Edit: "Monta",
  Publish: "Pubblica",
  Workspace: "Spazio di lavoro",
  Clients: "Clienti",
  Calendar: "Calendario",
  "Weekly coach": "Riepilogo settimanale",
  Library: "Libreria",
  Billing: "Piano e crediti",
  Goals: "Obiettivi",
  Guide: "Guida",
  Notifications: "Notifiche",
  "Exit Studio": "Esci dallo Studio",
  "Audio preview": "Anteprima audio",
  "Seek {{label}}": "Sposta la riproduzione di {{label}}",
  "Play {{label}}": "Riproduci {{label}}",
  "Pause {{label}}": "Metti in pausa {{label}}",
  "Audio download failed.": "Download audio non riuscito.",
  Remove: "Rimuovi",
  Search: "Cerca",
  "Source ready · {{seconds}} seconds. Review the measured credit quote, then press Analyze video.":
    "Fonte pronta · {{seconds}} secondi. Verifica il preventivo dei crediti, poi premi Analizza il video.",
  "{{megabytes}} MB · uploads when analysis starts":
    "{{megabytes}} MB · caricamento all'avvio dell'analisi",
  "1. Open…\\n2. Select…\\n3. Click…":
    "1. Apri…\\n2. Seleziona…\\n3. Fai clic…",
  "Hook →": "Apertura →",
  "Generation started. Your audio will appear in Generated files and Library.":
    "Generazione avviata. L'audio apparirà nei File generati e nella Libreria.",
  "Instrumental music": "Musica strumentale",
  "Sound effect": "Effetto sonoro",
  "Please wait…": "Attendi…",
  "Get credit quote": "Calcola i crediti",
  "Music generation": "Generazione musicale",
  "Sound-effect generation": "Generazione di effetti sonori",
  "Your account or brand changed before the edit started. Reopen the intended workspace.":
    "L'account o il brand è cambiato prima dell'avvio del montaggio. Riapri lo spazio desiderato.",
  "A supporting video failed. Completed assets are saved; retry from your Library.":
    "Un video di supporto non è riuscito. I file completati sono salvati; riprova dalla Libreria.",
  "The video is still generating. It will remain available in your Library; your timeline is unchanged.":
    "Il video è ancora in generazione. Resterà disponibile nella Libreria; la timeline non è cambiata.",
  "Your timeline changed during the edit. AI media is saved; run again on the current version.":
    "La timeline è cambiata durante il montaggio. I file AI sono salvati; riprova sulla versione attuale.",
  "Before autonomous edit": "Prima del montaggio assistito",
  "Autonomous edit": "Montaggio assistito",
  "The reference workspace changed. Reopen the intended project.":
    "Lo spazio del riferimento è cambiato. Riapri il progetto desiderato.",
  "The reference project changed before saving.":
    "Il progetto di riferimento è cambiato prima del salvataggio.",
  "Brand workspaces could not load.":
    "Impossibile caricare gli spazi dei brand.",
  "Creating…": "Creazione…",
  "Add brand": "Aggiungi brand",
  "Pause style sample": "Metti in pausa l'esempio dello stile",
  "Play style sample": "Riproduci l'esempio dello stile",
  "Whole phrase": "Frase intera",
  "Highlight spoken word": "Evidenzia la parola pronunciata",
  "Reveal words as spoken": "Mostra le parole durante il parlato",
  "One word at a time": "Una parola alla volta",
  "Pulse with speech": "Pulsa con il parlato",
  "Pop each spoken word": "Fai apparire ogni parola pronunciata",
  "Raise each spoken word": "Solleva ogni parola pronunciata",
  "Fade each spoken word": "Dissolvenza per ogni parola pronunciata",
  "Type each spoken word": "Scrivi ogni parola pronunciata",
  "Lower frame": "Parte inferiore",
  "Upper frame": "Parte superiore",
  "Choose a subtitle file smaller than 2 MB.":
    "Scegli un file di sottotitoli inferiore a 2 MB.",
  Center: "Centro",
  left: "sinistra",
  right: "destra",
  "Key inside this clip": "Punto all'interno della clip",
  "Retained key outside this clip's current trim":
    "Punto conservato fuori dal taglio attuale della clip",
  Unlock: "Sblocca",
  Lock: "Blocca",
  "Fit whole shot": "Adatta l'intera ripresa",
  "Fill frame": "Riempi il fotogramma",
  Unmute: "Attiva audio",
  Mute: "Disattiva audio",
  "Saving your brand…": "Salvataggio del brand…",
  "Start with a script": "Parti da uno script",
  "Images · 1K": "Immagini · 1K",
  "Voice · 1,000 characters": "Voce · 1.000 caratteri",
  "Video · 5s, 720p, no audio": "Video · 5 s, 720p, senza audio",
  "Research · one platform": "Ricerca · una piattaforma",
  "Studio + top-ups": "Studio + ricariche",
  "Importing…": "Importazione…",
  "Save private video · no AI credits":
    "Salva video privato · nessun credito AI",
  "Add captions": "Aggiungi sottotitoli",
  "Create a graphic": "Crea una grafica",
  "Match a reference": "Segui un riferimento",
  "Shape the story": "Dai forma alla storia",
  "Let the current files finish uploading before adding more.":
    "Attendi il completamento dei caricamenti prima di aggiungere altri file.",
  "Attach up to 8 references per message. Remove one to make room.":
    "Allega fino a 8 riferimenti per messaggio. Rimuovine uno per fare spazio.",
  "Enter a complete public https:// reference link.":
    "Inserisci un link di riferimento pubblico completo che inizi con https://.",
  "Shorten text references to 16,000 characters each and 40,000 total before sending.":
    "Riduci i riferimenti testuali a 16.000 caratteri ciascuno e 40.000 in totale prima di inviare.",
  "Ask before extras": "Chiedi prima degli extra",
  "Approve extras automatically": "Approva gli extra automaticamente",
  "You choose whether to include additional suggestions.":
    "Scegli tu se includere i suggerimenti aggiuntivi.",
  "Reel can include extra improvements within your credit limit.":
    "Reel può includere miglioramenti aggiuntivi entro il limite di crediti.",
  " · Plan first": " · Pianifica prima",
  "Include selected · skip rest": "Includi selezionati · salta gli altri",
  "Skip selected · include rest": "Salta selezionati · includi gli altri",
  "Partly completed · review the steps above":
    "Parzialmente completato · verifica i passaggi sopra",
  "Needs attention · review the steps above":
    "Richiede attenzione · verifica i passaggi sopra",
  Finished: "Completato",
  "No changes made": "Nessuna modifica applicata",
  "Describe the result. Reel will make a plan for you to review…":
    "Descrivi il risultato. Reel preparerà un piano da valutare…",
  "Ask Reel to edit your video…": "Chiedi a Reel di montare il video…",
  "ask first": "chiedi prima",
  "automatically approved": "approvato automaticamente",
  "Auto extras": "Extra automatici",
  "No AI credits": "Nessun credito AI",
  "Included · queued": "Incluso · in coda",
  "Retry free sound": "Riprova il suono gratuito",
  voiceover: "voce fuori campo",
  "sound effect": "effetto sonoro",
  "saved captions": "sottotitoli salvati",
  "saved plan": "piano salvato",
  "apply plan": "applica piano",
  continue: "continua",
  "The selected project changed. Save the pose again.":
    "Il progetto selezionato è cambiato. Salva di nuovo la posa.",
  "The account or brand changed. Save the pose again in the intended workspace.":
    "L'account o il brand è cambiato. Salva di nuovo la posa nello spazio desiderato.",
  "The workspace or project changed. Save the pose again.":
    "Lo spazio o il progetto è cambiato. Salva di nuovo la posa.",
  Voiceover: "Voce fuori campo",
  "Person cutout": "Scontorno della persona",
  "Image depth": "Profondità dell'immagine",
  "Voiceover script": "Script della voce fuori campo",
  "Voiceover text": "Testo della voce fuori campo",
  "Generation prompt": "Prompt di generazione",
  "Write the exact words you want spoken…":
    "Scrivi le parole esatte da pronunciare…",
  "Describe the subject, setting, lighting, and style…":
    "Descrivi soggetto, ambientazione, illuminazione e stile…",
  "Show recent files": "Mostra i file recenti",
  "This file is no longer in Library.": "Il file non è più nella Libreria.",
  "Waiting for provider output. You can keep creating or check saved results.":
    "In attesa del risultato del fornitore. Puoi continuare a creare o controllare i risultati salvati.",
  "Recovering video…": "Recupero del video…",
  "Recover video": "Recupera video",
  "The Library workspace changed before uploading.":
    "Lo spazio della Libreria è cambiato prima del caricamento.",
  "The Library workspace changed before saving the upload.":
    "Lo spazio della Libreria è cambiato prima del salvataggio del caricamento.",
  "The Library workspace changed before saving the measured duration.":
    "Lo spazio della Libreria è cambiato prima del salvataggio della durata misurata.",
  "Uploaded to Library. Drag a thumbnail onto the timeline to place it.":
    "Caricato nella Libreria. Trascina una miniatura sulla timeline per inserirla.",
  "The Library workspace changed before saving the imported video.":
    "Lo spazio della Libreria è cambiato prima del salvataggio del video importato.",
  file: "file",
  files: "file",
  "Shortcuts changed for this session. Your browser could not save the preference.":
    "Scorciatoie modificate per questa sessione. Il browser non ha potuto salvare la preferenza.",
  "Stop recording": "Interrompi registrazione",
  Record: "Registra",
  "Press the new key combination. Esc stops recording; Tab moves focus.":
    "Premi la nuova combinazione di tasti. Esc interrompe la registrazione; Tab sposta il focus.",
  "Click Record or type a chord. Enter Escape to assign Esc. Remove every shortcut to disable an action.":
    "Fai clic su Registra o digita una combinazione. Digita Escape per assegnare Esc. Rimuovi tutte le scorciatoie per disabilitare un'azione.",
  "This preview could not load.": "Impossibile caricare l'anteprima.",
  "This preview could not play. Try again.":
    "Impossibile riprodurre l'anteprima. Riprova.",
  "The sound file could not be downloaded.":
    "Impossibile scaricare il file audio.",
  "All categories": "Tutte le categorie",
  "Saved to Library": "Salvato nella Libreria",
  "Save to Library": "Salva nella Libreria",
  "Choose a self-contained .glb file no larger than 25 MB.":
    "Scegli un file .glb autonomo non superiore a 25 MB.",
  Turn: "Rotazione orizzontale",
  Tilt: "Inclinazione",
  Roll: "Rotazione laterale",
  Exposure: "Esposizione",
  "Loading embedded geometry and textures…":
    "Caricamento di geometria e texture incorporate…",
  "Choose a model to preview its pose.":
    "Scegli un modello per vedere la posa in anteprima.",
  "Saving pose…": "Salvataggio della posa…",
  "Pose saved": "Posa salvata",
  "Save pose to Library": "Salva la posa nella Libreria",
  "Graphic preview": "Anteprima della grafica",
  "Write the words for your graphic before adding it.":
    "Scrivi il testo della grafica prima di aggiungerla.",
  "Pause motion preview": "Metti in pausa l'anteprima dell'animazione",
  "Play motion preview": "Riproduci l'anteprima dell'animazione",
  "Plain title / label": "Titolo / etichetta semplice",
  "Name + role with accent bar": "Nome e ruolo con barra colorata",
  "Chapter with top rule": "Capitolo con linea superiore",
  "Quote + attribution": "Citazione e attribuzione",
  "Statistic + explanation": "Statistica e spiegazione",
  "Timed progress indicator": "Indicatore di avanzamento temporale",
  "Object size": "Dimensione dell'oggetto",
  "Text size": "Dimensione del testo",
  "Rocking cycles": "Cicli di oscillazione",
  Revolutions: "Giri",
  "Save graphic": "Salva grafica",
  "Add at playhead": "Aggiungi al cursore",
  "Steady speed": "Velocità costante",
  "Start slowly": "Partenza lenta",
  "Land softly": "Arrivo graduale",
  "Smooth start and finish": "Partenza e arrivo graduali",
  "Hold, then jump": "Mantieni, poi passa",
  "Pause preview": "Metti in pausa l'anteprima",
  "Play preview": "Riproduci l'anteprima",
  "Added at the playhead. Select the layers to refine them; Undo removes the whole kit.":
    "Aggiunto al cursore. Seleziona i livelli per perfezionarli; Annulla modifica rimuove l'intero kit.",
  "Result label": "Etichetta del risultato",
  "Main text": "Testo principale",
  "Wordmark only": "Solo logo testuale",
  "Add kit at playhead": "Aggiungi il kit al cursore",
  "The source preview could not be loaded.":
    "Impossibile caricare l'anteprima della fonte.",
  "Operations could not load.": "Impossibile caricare le operazioni.",
  "Needs activation": "Da attivare",
  Ready: "Pronto",
  "Needs setup": "Da configurare",
  "Awaiting first successful update":
    "In attesa del primo aggiornamento riuscito",
  " · Latest refresh failed; previous feed preserved.":
    " · Ultimo aggiornamento non riuscito; selezione precedente conservata.",
  moment: "momento",
  moments: "momenti",
  " (showing the first 50)": " (primi 50 risultati)",
  "No matching source evidence. Try words from a caption or a shorter description.":
    "Nessuna evidenza trovata nella fonte. Prova parole dei sottotitoli o una descrizione più breve.",
  Account: "Account",
  "The destination workspace changed. Start the import again.":
    "Lo spazio di destinazione è cambiato. Avvia di nuovo l'importazione.",
  "The reference was removed.": "Il riferimento è stato rimosso.",
  "Learn from a reference hook or script":
    "Prendi spunto da un'apertura o uno script di riferimento",
  "Match a reference style or video":
    "Segui uno stile o un video di riferimento",
  "Import or upload a reference": "Importa o carica un riferimento",
  "Deselect all": "Deseleziona tutto",
  "Select all": "Seleziona tutto",
  "Measure a reference before analysis":
    "Misura un riferimento prima dell'analisi",
  "The account, brand or project changed. Reopen export in the intended workspace.":
    "L'account, il brand o il progetto è cambiato. Riapri l'esportazione nello spazio desiderato.",
  "Download only · no Library upload":
    "Solo download · nessun caricamento nella Libreria",
  "Library · save and publish later": "Libreria · salva e pubblica dopo",
  "720p · faster export": "720p · esportazione più rapida",
  "1080p · more detail": "1080p · più dettagli",
  "4K · maximum detail": "4K · massimo dettaglio",
  "Exporting…": "Esportazione…",
  "Retry saving to Library": "Riprova il salvataggio nella Libreria",
  "The timeline changed. Measure or review it again before applying.":
    "La timeline è cambiata. Misura o verifica di nuovo prima di applicare.",
  " · Locked": " · Bloccato",
  "Working…": "Elaborazione…",
  "Measure source audio": "Misura l'audio originale",
  "Timeline changed. Measure again.": "Timeline modificata. Misura di nuovo.",
  "Save style": "Salva stile",
  "Select an editable graphic to capture its text, shape and motion.":
    "Seleziona una grafica modificabile per acquisire testo, forma e movimento.",
  "Select a video or image and move the playhead inside it to capture the current pose and grade.":
    "Seleziona un video o un'immagine e sposta il cursore al suo interno per acquisire posa e colore attuali.",
  "Select an unlocked video or image to apply this look.":
    "Seleziona un video o un'immagine sbloccati per applicare questo stile.",
  "Applying…": "Applicazione…",
  Insert: "Inserisci",
  "Current call to action": "Invito all'azione attuale",
  "Use this call to action": "Usa questo invito all'azione",
  "Current opening": "Apertura attuale",
  "Use this opening": "Usa questa apertura",
  "The service check could not complete. Sign in as the studio owner and retry.":
    "Impossibile completare il controllo. Accedi come titolare dello Studio e riprova.",
  "Checking connections…": "Verifica dei collegamenti…",
  "Check connections": "Verifica collegamenti",
  "Settings present": "Impostazioni presenti",
  "Select an outgoing video shot that meets another video at its end.":
    "Seleziona una scena video che confini con un'altra alla sua fine.",
  "Performance could not load. Try syncing again.":
    "Impossibile caricare i risultati. Prova a sincronizzare di nuovo.",
  "Syncing…": "Sincronizzazione…",
  "Sync results": "Sincronizza i risultati",
  "Connect your accounts and sync to see real results. Missing data is not counted as zero.":
    "Collega gli account e sincronizza per vedere i risultati. I dati mancanti non vengono considerati zero.",
  " Showing up to 1,000 recent posts.":
    " Visualizzati fino a 1.000 post recenti.",
  "Use a PNG, JPEG or WebP image up to 20 MB.":
    "Usa un'immagine PNG, JPEG o WebP fino a 20 MB.",
  "Your account or brand changed. Start again with the current Library image.":
    "L'account o il brand è cambiato. Ricomincia con l'immagine attuale della Libreria.",
  "Separate a person from a still image and keep the background transparent. Hair and fine edges may need a different threshold.":
    "Separa una persona da un'immagine e mantieni lo sfondo trasparente. Capelli e bordi sottili possono richiedere una soglia diversa.",
  "Estimate a grayscale depth map from one still image. Brighter areas usually appear closer; this is relative depth, without real distances or a reconstructed 3D scene.":
    "Stima una mappa di profondità in scala di grigi da un'immagine. Le aree più chiare appaiono solitamente più vicine: è profondità relativa, senza distanze reali o ricostruzione 3D.",
  "Preview person cutout": "Anteprima dello scontorno della persona",
  "Preview relative depth": "Anteprima della profondità relativa",
  "Still-image person segmentation; full-video matting and rotoscoping are not supported.":
    "Segmentazione di persone nelle immagini; scontorno dell'intero video e rotoscoping non sono supportati.",
  "Still-image relative depth; metric depth and tracked 3D reconstruction are not supported.":
    "Profondità relativa delle immagini; profondità metrica e ricostruzione 3D tracciata non sono supportate.",
  "Finding sections…": "Ricerca delle sezioni…",
  "Refresh sections": "Aggiorna le sezioni",
  " · Edited by you": " · Modificato da te",
  "Find the hook, main idea and payoff in your footage.":
    "Trova apertura, idea principale e risultato nelle tue riprese.",
  "Add footage, then find its story sections. These markers help you navigate without cutting the video.":
    "Aggiungi riprese, poi individua le sezioni della storia. I marcatori ti aiutano a navigare senza tagliare il video.",
  "Use a name and a valid range within the video, without overlapping another section.":
    "Usa un nome e un intervallo valido nel video, senza sovrapporre un'altra sezione.",
  Start: "Inizio",
  End: "Fine",
  "Waveform unavailable": "Forma d'onda non disponibile",
  "Filmstrip unavailable": "Miniature dei fotogrammi non disponibili",
  "No media at this time": "Nessun file in questo punto",
  "Add footage from your Library or upload it below":
    "Aggiungi riprese dalla Libreria o caricale qui sotto",
  "Close range prompt": "Chiudi la richiesta sull'intervallo",
  "Edit a time range with AI": "Modifica un intervallo con l'AI",
  on: "attivo",
  off: "disattivato",
  "video or images": "video o immagini",
  Deselect: "Deseleziona",
  Select: "Seleziona",
  word: "parola",
  words: "parole",
  "Select words to cut": "Seleziona le parole da tagliare",
  "Cut selected words": "Taglia le parole selezionate",
  "Remove keyframe": "Rimuovi fotogramma chiave",
  Linear: "Lineare",
  "Smooth in and out": "Entrata e uscita graduali",
  Accelerate: "Accelera",
  Decelerate: "Decelera",
  "Hold until next keyframe": "Mantieni fino al fotogramma chiave successivo",
  "No mask": "Nessuna maschera",
  Ellipse: "Ellisse",
  "Rounded frame": "Cornice arrotondata",
  "Editable polygon": "Poligono modificabile",
  "Listen to": "Ascolta",
  "Preparing sample…": "Preparazione dell'esempio…",
  "Pause sample": "Metti in pausa l'esempio",
  "Listen to sample": "Ascolta l'esempio",
  "This sample could not play. Try loading it again.":
    "Impossibile riprodurre l'esempio. Prova a caricarlo di nuovo.",
  voice: "voce",
  voices: "voci",
  "Projects updated in the last 7 days: {{count}}":
    "Progetti aggiornati negli ultimi 7 giorni: {{count}}",
  "Publication records: {{created}} · confirmed published: {{published}}":
    "Pubblicazioni registrate: {{created}} · pubblicazioni confermate: {{published}}",
  "Workspace actions recorded: {{count}}":
    "Azioni registrate nello spazio di lavoro: {{count}}",
  "Connected publishing destinations: {{count}}":
    "Destinazioni di pubblicazione collegate: {{count}}",
  "Start one editing project and define the intended platform before generating variants.":
    "Avvia un progetto di montaggio e scegli la piattaforma prima di generare varianti.",
  "Review or export one of your open edits before starting another. Open edits: {{count}}":
    "Revisiona o esporta uno dei montaggi aperti prima di iniziarne un altro. Montaggi aperti: {{count}}",
  "Schedule, publish, or delete your saved publication drafts. Drafts: {{count}}":
    "Programma, pubblica o elimina le bozze salvate. Bozze: {{count}}",
  "Connect a verified destination in Social Hub before building a publishing cadence.":
    "Collega una destinazione in Account social prima di definire il ritmo di pubblicazione.",
  "Choose one finished asset and schedule a publication; nothing has been published this week.":
    "Scegli un contenuto completato e programma una pubblicazione: questa settimana non è stato ancora pubblicato nulla.",
  "Create one measurable goal so next week’s review can compare progress against a declared target.":
    "Crea un obiettivo misurabile per confrontare i progressi nel riepilogo della prossima settimana.",
  "Prioritize “{{goal}}”; it is at {{percent}}% of target.":
    "Dai priorità a «{{goal}}»: è al {{percent}}% dell'obiettivo.",
  "The workflow is moving. Keep the next cycle narrow: one edit, one review, one measured publication.":
    "Il lavoro procede. Concentrati sul prossimo ciclo: un montaggio, una revisione, una pubblicazione misurata.",
  "The workspace review could not be refreshed.":
    "Impossibile aggiornare il riepilogo dello spazio di lavoro.",
  "Connected publishing": "Pubblicazione collegata",
  "Editing projects": "Progetti di montaggio",
  "Media assets": "File multimediali",
  "Media storage": "Archivio multimediale",
  Storytelling: "Narrazione",
  "Open plan and credits": "Apri piano e crediti",
  Credits: "Crediti",
  "Saving workspace…": "Salvataggio dello spazio di lavoro…",
  "Changes need attention": "Le modifiche richiedono attenzione",
  "Everything saved": "Tutto salvato",
  open: "apri",
  "resolve setup": "completa la configurazione",
  "Open workspace": "Apri lo spazio di lavoro",
  "Resolve setup": "Completa la configurazione",
  "Expand navigation": "Espandi la navigazione",
  "Collapse navigation": "Comprimi la navigazione",
  Create: "Crea",
  "Use dark theme": "Attiva il tema scuro",
  "Use light theme": "Attiva il tema chiaro",
  "Sending…": "Invio…",
  "Creating account…": "Creazione dell'account…",
  "Updating…": "Aggiornamento…",
  "Update password": "Aggiorna password",
  "Signing in…": "Accesso…",
  "Human support has been notified by email.":
    "Il team di assistenza è stato avvisato via email.",
  "Example: Video export stops at 80%":
    "Esempio: l'esportazione video si ferma all'80%",
  "Example: Add reusable caption presets":
    "Esempio: aggiungere stili di sottotitoli riutilizzabili",
  energetic: "energico",
  professional: "professionale",
  casual: "informale",
  dramatic: "drammatico",
  educational: "educativo",
  funny: "divertente",
  inspirational: "ispirazionale",
  "Contrarian reset": "Ribalta una convinzione",
  "Specific result": "Risultato concreto",
  "Costly mistake": "Errore da evitare",
  "Open loop": "Curiosità da risolvere",
  "Before / after": "Prima / dopo",
  "Proof first": "Prima la prova",
  "Challenge an assumption, then earn attention with a specific alternative.":
    "Metti in discussione una convinzione, poi cattura l'attenzione con un'alternativa concreta.",
  "Lead with an outcome the viewer can understand immediately.":
    "Parti da un risultato che lo spettatore può capire subito.",
  "Make the risk concrete without manufacturing urgency.":
    "Rendi concreto il rischio senza creare urgenza artificiale.",
  "Promise a useful payoff and give the viewer a reason to stay.":
    "Prometti un risultato utile e dai allo spettatore un motivo per restare.",
  "Build the opening around a visible transformation.":
    "Costruisci l'apertura intorno a una trasformazione visibile.",
  "Show evidence before explaining the process.":
    "Mostra la prova prima di spiegare il processo.",
};

export const italianUi: Record<string, string> = {
  ...reviewedItalianUi,
  ...italianPublicUi,
  ...italianPricingUi,
  ...italianGuideUi,
  ...extraItalianUi,
};
