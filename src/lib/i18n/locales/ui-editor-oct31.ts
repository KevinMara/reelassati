import type { InterfaceLanguage } from "@contracts/interface-language";

const keys = [
  "AI edits your footage using your reference, style or direction.",
  "Automatic",
  "Direct video file · MP4, MOV or WebM · up to 256 MB / 2 min",
  "Exit fullscreen",
  "Filters",
  "Footage",
  "Import reference",
  "Match a style",
  "No style",
  "Some source media is unavailable. The saved design is preserved.",
  "Specs",
  "Style",
  "Your instructions",
];
const rows: Partial<Record<InterfaceLanguage, string>> = {
  it: "L'AI monta le riprese seguendo il tuo riferimento, stile o indicazioni.|Automatico|File video diretto · MP4, MOV o WebM · fino a 256 MB / 2 min|Esci da schermo intero|Filtri|Riprese|Importa riferimento|Abbina uno stile|Nessuno stile|Alcuni file sorgente non sono disponibili. Il design salvato è conservato.|Specifiche|Stile|Le tue istruzioni",
  es: "La IA edita tus tomas siguiendo tu referencia, estilo o indicaciones.|Automático|Archivo de vídeo directo · MP4, MOV o WebM · hasta 256 MB / 2 min|Salir de pantalla completa|Filtros|Tomas|Importar referencia|Aplicar un estilo|Sin estilo|Algunos medios originales no están disponibles. El diseño guardado se conserva.|Ajustes|Estilo|Tus instrucciones",
  fr: "L’IA monte vos images selon votre référence, style ou consignes.|Automatique|Fichier vidéo direct · MP4, MOV ou WebM · jusqu’à 256 Mo / 2 min|Quitter le plein écran|Filtres|Séquences|Importer la référence|Appliquer un style|Aucun style|Certains médias sources sont indisponibles. Le design enregistré est conservé.|Réglages|Style|Vos consignes",
  de: "KI bearbeitet dein Material nach deiner Referenz, deinem Stil oder deinen Vorgaben.|Automatisch|Direkte Videodatei · MP4, MOV oder WebM · bis 256 MB / 2 Min.|Vollbild verlassen|Filter|Aufnahmen|Referenz importieren|Stil übernehmen|Kein Stil|Einige Quelldateien sind nicht verfügbar. Das gespeicherte Design bleibt erhalten.|Einstellungen|Stil|Deine Vorgaben",
  pt: "A IA edita as suas filmagens seguindo a referência, o estilo ou as instruções.|Automático|Ficheiro de vídeo direto · MP4, MOV ou WebM · até 256 MB / 2 min|Sair do ecrã inteiro|Filtros|Filmagens|Importar referência|Aplicar um estilo|Sem estilo|Alguns ficheiros de origem estão indisponíveis. O design guardado é preservado.|Definições|Estilo|As suas instruções",
  nl: "AI monteert je beelden volgens je referentie, stijl of aanwijzingen.|Automatisch|Direct videobestand · MP4, MOV of WebM · tot 256 MB / 2 min|Volledig scherm verlaten|Filters|Beelden|Referentie importeren|Stijl toepassen|Geen stijl|Sommige bronmedia zijn niet beschikbaar. Het opgeslagen ontwerp blijft behouden.|Instellingen|Stijl|Je instructies",
  pl: "AI montuje materiał według wzorca, stylu lub wskazówek.|Automatycznie|Bezpośredni plik wideo · MP4, MOV lub WebM · do 256 MB / 2 min|Wyjdź z pełnego ekranu|Filtry|Materiał|Importuj wzorzec|Zastosuj styl|Bez stylu|Niektóre pliki źródłowe są niedostępne. Zapisany projekt wyglądu pozostaje zachowany.|Ustawienia|Styl|Twoje instrukcje",
  ro: "AI montează filmările după referința, stilul sau indicațiile tale.|Automat|Fișier video direct · MP4, MOV sau WebM · până la 256 MB / 2 min|Ieși din ecran complet|Filtre|Filmări|Importă referința|Aplică un stil|Fără stil|Unele fișiere sursă nu sunt disponibile. Designul salvat se păstrează.|Setări|Stil|Instrucțiunile tale",
  tr: "Yapay zekâ çekimlerini referansına, stiline veya talimatlarına göre düzenler.|Otomatik|Doğrudan video dosyası · MP4, MOV veya WebM · en fazla 256 MB / 2 dk|Tam ekrandan çık|Filtreler|Çekimler|Referans içe aktar|Stil uygula|Stil yok|Bazı kaynak medya dosyaları kullanılamıyor. Kaydedilen tasarım korunur.|Ayarlar|Stil|Talimatların",
  uk: "ШІ монтує матеріал за вашим референсом, стилем або вказівками.|Автоматично|Прямий відеофайл · MP4, MOV або WebM · до 256 МБ / 2 хв|Вийти з повного екрана|Фільтри|Відеоматеріал|Імпортувати референс|Застосувати стиль|Без стилю|Деякі вихідні медіафайли недоступні. Збережений дизайн залишається.|Налаштування|Стиль|Ваші вказівки",
  ru: "ИИ монтирует материал по вашему референсу, стилю или указаниям.|Автоматически|Прямой видеофайл · MP4, MOV или WebM · до 256 МБ / 2 мин|Выйти из полного экрана|Фильтры|Видеоматериал|Импортировать референс|Применить стиль|Без стиля|Некоторые исходные медиафайлы недоступны. Сохранённый дизайн остаётся.|Настройки|Стиль|Ваши указания",
  ar: "يحرّر الذكاء الاصطناعي لقطاتك وفق المرجع أو الأسلوب أو تعليماتك.|تلقائي|ملف فيديو مباشر · MP4 أو MOV أو WebM · حتى 256 ميغابايت / دقيقتين|إنهاء ملء الشاشة|عوامل التصفية|اللقطات|استيراد المرجع|تطبيق أسلوب|بلا أسلوب|بعض ملفات المصدر غير متاحة. يبقى التصميم المحفوظ محفوظًا.|الإعدادات|الأسلوب|تعليماتك",
  hi: "AI आपके संदर्भ, शैली या निर्देशों के अनुसार फुटेज संपादित करता है।|स्वचालित|सीधी वीडियो फ़ाइल · MP4, MOV या WebM · अधिकतम 256 MB / 2 मिनट|पूर्ण स्क्रीन से बाहर निकलें|फ़िल्टर|फुटेज|संदर्भ आयात करें|शैली लागू करें|कोई शैली नहीं|कुछ स्रोत मीडिया उपलब्ध नहीं हैं। सहेजा गया डिज़ाइन सुरक्षित है।|सेटिंग|शैली|आपके निर्देश",
  ja: "AIが参照動画、スタイル、指示に沿って素材を自動編集します。|自動|動画ファイルの直接リンク · MP4、MOV、WebM · 最大256 MB / 2分|全画面表示を終了|フィルター|映像素材|参照をインポート|スタイルを適用|スタイルなし|一部の元メディアが利用できません。保存済みデザインは保持されています。|設定|スタイル|あなたの指示",
  ko: "AI가 참조 영상, 스타일 또는 지시에 따라 영상을 편집합니다.|자동|직접 동영상 파일 · MP4, MOV 또는 WebM · 최대 256 MB / 2분|전체 화면 종료|필터|영상 소스|참조 가져오기|스타일 적용|스타일 없음|일부 원본 미디어를 사용할 수 없습니다. 저장된 디자인은 유지됩니다.|설정|스타일|내 지시 사항",
  zh: "AI 按照参考、风格或指示自动剪辑你的素材。|自动|直接视频文件 · MP4、MOV 或 WebM · 最大 256 MB / 2 分钟|退出全屏|筛选|素材|导入参考|应用风格|无风格|部分源媒体不可用，已保存的设计仍然保留。|设置|风格|你的指示",
  vi: "AI biên tập cảnh quay theo video tham khảo, phong cách hoặc chỉ dẫn của bạn.|Tự động|Tệp video trực tiếp · MP4, MOV hoặc WebM · tối đa 256 MB / 2 phút|Thoát toàn màn hình|Bộ lọc|Cảnh quay|Nhập tham khảo|Áp dụng phong cách|Không có phong cách|Một số tệp nguồn không khả dụng. Thiết kế đã lưu vẫn được giữ nguyên.|Thiết lập|Phong cách|Chỉ dẫn của bạn",
  da: "AI klipper dine optagelser efter din reference, stil eller instruktioner.|Automatisk|Direkte videofil · MP4, MOV eller WebM · op til 256 MB / 2 min.|Afslut fuld skærm|Filtre|Optagelser|Importer reference|Anvend en stil|Ingen stil|Nogle kildefiler er utilgængelige. Det gemte design bevares.|Indstillinger|Stil|Dine instruktioner",
  sv: "AI redigerar ditt material efter din referens, stil eller dina instruktioner.|Automatiskt|Direkt videofil · MP4, MOV eller WebM · upp till 256 MB / 2 min|Avsluta helskärm|Filter|Videomaterial|Importera referens|Använd en stil|Ingen stil|Vissa källmedier är inte tillgängliga. Den sparade designen bevaras.|Inställningar|Stil|Dina instruktioner",
  no: "KI redigerer opptakene etter referansen, stilen eller instruksjonene dine.|Automatisk|Direkte videofil · MP4, MOV eller WebM · opptil 256 MB / 2 min|Avslutt fullskjerm|Filtre|Opptak|Importer referanse|Bruk en stil|Ingen stil|Noen kildefiler er utilgjengelige. Det lagrede designet bevares.|Innstillinger|Stil|Instruksjonene dine",
  fi: "Tekoäly leikkaa materiaalisi viitteen, tyylin tai ohjeidesi mukaan.|Automaattinen|Suora videotiedosto · MP4, MOV tai WebM · enintään 256 Mt / 2 min|Poistu koko näytöstä|Suodattimet|Videomateriaali|Tuo viite|Käytä tyyliä|Ei tyyliä|Osa lähdemediasta ei ole saatavilla. Tallennettu suunnittelu säilyy.|Asetukset|Tyyli|Ohjeesi",
  cs: "AI sestříhá záběry podle vaší předlohy, stylu nebo pokynů.|Automaticky|Přímý videosoubor · MP4, MOV nebo WebM · až 256 MB / 2 min|Ukončit celou obrazovku|Filtry|Záběry|Importovat předlohu|Použít styl|Bez stylu|Některá zdrojová média nejsou dostupná. Uložený design zůstává zachován.|Nastavení|Styl|Vaše pokyny",
  hu: "Az AI a referencia, a stílus vagy az utasításaid szerint vágja meg a felvételeket.|Automatikus|Közvetlen videófájl · MP4, MOV vagy WebM · legfeljebb 256 MB / 2 perc|Kilépés a teljes képernyőből|Szűrők|Felvételek|Referencia importálása|Stílus alkalmazása|Nincs stílus|Néhány forrásmédia nem érhető el. A mentett dizájn megmarad.|Beállítások|Stílus|Utasításaid",
  el: "Το AI μοντάρει το υλικό σύμφωνα με την αναφορά, το στιλ ή τις οδηγίες σας.|Αυτόματο|Άμεσο αρχείο βίντεο · MP4, MOV ή WebM · έως 256 MB / 2 λεπτά|Έξοδος από πλήρη οθόνη|Φίλτρα|Πλάνα|Εισαγωγή αναφοράς|Εφαρμογή στιλ|Χωρίς στιλ|Ορισμένα πηγαία αρχεία δεν είναι διαθέσιμα. Το αποθηκευμένο σχέδιο διατηρείται.|Ρυθμίσεις|Στιλ|Οι οδηγίες σας",
  he: "ה-AI עורך את הצילומים לפי ההפניה, הסגנון או ההוראות שלך.|אוטומטי|קובץ וידאו ישיר · MP4, MOV או WebM · עד 256 MB / 2 דקות|יציאה ממסך מלא|מסננים|צילומים|ייבוא הפניה|החלת סגנון|ללא סגנון|חלק מקובצי המקור אינם זמינים. העיצוב השמור נשמר.|הגדרות|סגנון|ההוראות שלך",
  id: "AI menyunting rekaman sesuai referensi, gaya, atau arahan Anda.|Otomatis|Berkas video langsung · MP4, MOV atau WebM · hingga 256 MB / 2 menit|Keluar dari layar penuh|Filter|Rekaman|Impor referensi|Terapkan gaya|Tanpa gaya|Sebagian media sumber tidak tersedia. Desain tersimpan tetap terjaga.|Pengaturan|Gaya|Instruksi Anda",
  th: "AI ตัดต่อฟุตเทจตามวิดีโออ้างอิง สไตล์ หรือคำแนะนำของคุณ|อัตโนมัติ|ไฟล์วิดีโอโดยตรง · MP4, MOV หรือ WebM · สูงสุด 256 MB / 2 นาที|ออกจากเต็มหน้าจอ|ตัวกรอง|ฟุตเทจ|นำเข้าวิดีโออ้างอิง|ใช้สไตล์|ไม่มีสไตล์|สื่อบางส่วนของต้นฉบับไม่พร้อมใช้งาน การออกแบบที่บันทึกไว้ยังคงอยู่|การตั้งค่า|สไตล์|คำแนะนำของคุณ",
};
export const editorOct31Ui = Object.fromEntries(
  Object.entries(rows).map(([code, row]) => {
    const values = row.split("|");
    if (values.length !== keys.length)
      throw new Error(`Invalid editor copy for ${code}`);
    return [
      code,
      Object.fromEntries(keys.map((key, index) => [key, values[index]])),
    ];
  })
) as Record<string, Record<string, string>>;

const voiceIntro: Partial<Record<InterfaceLanguage, string>> = {
  it: "Trasforma l'audio in trascrizioni, script o voci fuori campo modificabili.",
  es: "Convierte audio en una transcripción editable, un guion o una voz en off.",
  fr: "Transformez l’audio en transcription modifiable, script ou voix off.",
  de: "Verwandle Audio in ein bearbeitbares Transkript, Skript oder Voiceover.",
  pt: "Transforme áudio numa transcrição editável, num guião ou numa narração.",
  nl: "Zet audio om in een bewerkbaar transcript, script of voice-over.",
  pl: "Zamień dźwięk w edytowalną transkrypcję, scenariusz lub narrację.",
  ro: "Transformă sunetul într-o transcriere editabilă, un scenariu sau o narațiune.",
  tr: "Sesi düzenlenebilir bir döküme, senaryoya veya seslendirmeye dönüştürün.",
  uk: "Перетворіть аудіо на редаговану розшифровку, сценарій або озвучення.",
  ru: "Превратите аудио в редактируемую расшифровку, сценарий или озвучку.",
  ar: "حوّل الصوت إلى نص قابل للتحرير أو سيناريو أو تعليق صوتي.",
  hi: "ऑडियो को संपादन योग्य ट्रांसक्रिप्ट, स्क्रिप्ट या वॉयसओवर में बदलें।",
  ja: "音声を編集可能な文字起こし、台本、ナレーションに変換します。",
  ko: "오디오를 편집 가능한 대본, 스크립트 또는 내레이션으로 바꾸세요.",
  zh: "将音频转换为可编辑的转录文本、脚本或配音。",
  vi: "Chuyển âm thanh thành bản chép lời, kịch bản hoặc lời thuyết minh có thể chỉnh sửa.",
  da: "Gør lyd til en redigerbar transskription, et manuskript eller en voiceover.",
  sv: "Gör ljud till en redigerbar transkription, ett manus eller en berättarröst.",
  no: "Gjør lyd om til en redigerbar transkripsjon, et manus eller en fortellerstemme.",
  fi: "Muunna ääni muokattavaksi litteroinniksi, käsikirjoitukseksi tai selostukseksi.",
  cs: "Převeďte zvuk na upravitelný přepis, scénář nebo komentář.",
  hu: "Alakítsd a hangot szerkeszthető átirattá, forgatókönyvvé vagy narrációvá.",
  el: "Μετατρέψτε τον ήχο σε επεξεργάσιμη απομαγνητοφώνηση, σενάριο ή αφήγηση.",
  he: "הפכו אודיו לתמלול ניתן לעריכה, לתסריט או לקריינות.",
  id: "Ubah audio menjadi transkrip, naskah, atau sulih suara yang dapat diedit.",
  th: "เปลี่ยนเสียงเป็นข้อความถอดเสียง สคริปต์ หรือเสียงบรรยายที่แก้ไขได้",
};
for (const [language, value] of Object.entries(voiceIntro)) {
  editorOct31Ui[language][
    "Turn audio into an editable transcript, script or voiceover."
  ] = value;
}

const controlKeys = [
  "Expressive voice in 90+ languages.",
  "Recent colors",
  "Enter a valid hex color.",
  "Preview {{name}}",
  "Hue",
];
const controlRows: Partial<Record<InterfaceLanguage, string>> = {
  it: "Voce espressiva in oltre 90 lingue.|Colori recenti|Inserisci un colore esadecimale valido.|Anteprima {{name}}|Tonalità",
  es: "Voz expresiva en más de 90 idiomas.|Colores recientes|Introduce un color hexadecimal válido.|Vista previa de {{name}}|Tono",
  fr: "Voix expressive dans plus de 90 langues.|Couleurs récentes|Saisissez une couleur hexadécimale valide.|Aperçu de {{name}}|Teinte",
  de: "Ausdrucksstarke Stimme in über 90 Sprachen.|Zuletzt verwendete Farben|Gib einen gültigen Hex-Farbwert ein.|Vorschau: {{name}}|Farbton",
  pt: "Voz expressiva em mais de 90 idiomas.|Cores recentes|Introduza uma cor hexadecimal válida.|Pré-visualização de {{name}}|Matiz",
  nl: "Expressieve stem in meer dan 90 talen.|Recente kleuren|Voer een geldige hexkleur in.|Voorbeeld van {{name}}|Tint",
  pl: "Ekspresyjny głos w ponad 90 językach.|Ostatnie kolory|Wpisz prawidłowy kolor szesnastkowy.|Podgląd {{name}}|Odcień",
  ro: "Voce expresivă în peste 90 de limbi.|Culori recente|Introdu o culoare hexazecimală validă.|Previzualizare {{name}}|Nuanță",
  tr: "90'dan fazla dilde etkileyici ses.|Son renkler|Geçerli bir onaltılık renk girin.|{{name}} önizlemesi|Renk tonu",
  uk: "Виразний голос понад 90 мовами.|Нещодавні кольори|Введіть дійсний шістнадцятковий колір.|Перегляд {{name}}|Відтінок",
  ru: "Выразительный голос более чем на 90 языках.|Недавние цвета|Введите допустимый шестнадцатеричный цвет.|Просмотр {{name}}|Оттенок",
  ar: "صوت تعبيري بأكثر من 90 لغة.|الألوان الأخيرة|أدخل لونًا سداسيًا عشريًا صالحًا.|معاينة {{name}}|درجة اللون",
  hi: "90 से अधिक भाषाओं में अभिव्यक्तिपूर्ण आवाज़।|हाल के रंग|मान्य हेक्स रंग दर्ज करें।|{{name}} का पूर्वावलोकन|रंगत",
  ja: "90以上の言語に対応した表現豊かな音声。|最近使った色|有効な16進数の色を入力してください。|{{name}}をプレビュー|色相",
  ko: "90개 이상의 언어로 표현력 있는 음성.|최근 색상|올바른 16진수 색상을 입력하세요.|{{name}} 미리보기|색조",
  zh: "支持90多种语言的生动语音。|最近使用的颜色|请输入有效的十六进制颜色。|预览{{name}}|色相",
  vi: "Giọng nói biểu cảm với hơn 90 ngôn ngữ.|Màu gần đây|Nhập mã màu hex hợp lệ.|Xem trước {{name}}|Sắc độ",
  da: "Udtryksfuld stemme på over 90 sprog.|Seneste farver|Indtast en gyldig hex-farve.|Forhåndsvis {{name}}|Farvetone",
  sv: "Uttrycksfull röst på över 90 språk.|Senaste färger|Ange en giltig hex-färg.|Förhandsvisa {{name}}|Nyans",
  no: "Uttrykksfull stemme på over 90 språk.|Nylige farger|Skriv inn en gyldig heksadesimal farge.|Forhåndsvis {{name}}|Fargetone",
  fi: "Ilmeikäs ääni yli 90 kielellä.|Viimeisimmät värit|Anna kelvollinen heksaväri.|Esikatsele {{name}}|Sävy",
  cs: "Výrazný hlas ve více než 90 jazycích.|Nedávné barvy|Zadejte platnou hexadecimální barvu.|Náhled {{name}}|Odstín",
  hu: "Kifejező hang több mint 90 nyelven.|Legutóbbi színek|Adj meg érvényes hexadecimális színt.|{{name}} előnézete|Árnyalat",
  el: "Εκφραστική φωνή σε περισσότερες από 90 γλώσσες.|Πρόσφατα χρώματα|Εισαγάγετε έγκυρο δεκαεξαδικό χρώμα.|Προεπισκόπηση {{name}}|Απόχρωση",
  he: "קול מלא הבעה ביותר מ-90 שפות.|צבעים אחרונים|יש להזין צבע הקסדצימלי תקין.|תצוגה מקדימה של {{name}}|גוון",
  id: "Suara ekspresif dalam lebih dari 90 bahasa.|Warna terbaru|Masukkan warna heksadesimal yang valid.|Pratinjau {{name}}|Rona",
  th: "เสียงที่มีอารมณ์ในกว่า 90 ภาษา|สีล่าสุด|ป้อนรหัสสีฐานสิบหกที่ถูกต้อง|ดูตัวอย่าง {{name}}|เฉดสี",
};
for (const [code, row] of Object.entries(controlRows)) {
  const values = row.split("|");
  if (values.length !== controlKeys.length)
    throw new Error(`Invalid editor control copy: ${code}`);
  Object.assign(
    editorOct31Ui[code],
    Object.fromEntries(controlKeys.map((key, i) => [key, values[i]]))
  );
  editorOct31Ui[code].HEX = "HEX";
}
