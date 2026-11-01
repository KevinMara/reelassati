const keys = [
  "Style examples",
  "Add videos or project edits. Reel learns their shared style and adapts it to your new footage.",
  "Choose an example",
  "Saved project edit",
  "Style reviewed",
  "Reviewed when you run Reel",
  "Remove example {{name}}",
  "This example's video is no longer in the Library.",
  "Video review credits are included in Reel's estimate. Adding examples does not start an analysis.",
  "Folders",
  "All folders",
  "Unfiled",
  "Folder",
  "Choose or create a folder",
  "examples",
  "Upload video",
  "Library / Projects",
];
const rows: Record<string, string> = {
  it: "Esempi dello stile|Aggiungi video o montaggi di progetto. Reel ne apprende lo stile comune e lo adatta alle nuove riprese.|Scegli un esempio|Montaggio del progetto salvato|Stile analizzato|Analizzato quando avvii Reel|Rimuovi l’esempio {{name}}|Il video di questo esempio non è più nella Libreria.|I crediti per analizzare i video sono inclusi nella stima di Reel. Aggiungere esempi non avvia un’analisi.|Cartelle|Tutte le cartelle|Senza cartella|Cartella|Scegli o crea una cartella|esempi|Carica video|Libreria / Progetti",
  es: "Ejemplos del estilo|Añade vídeos o montajes de proyectos. Reel aprende su estilo común y lo adapta a tus nuevas imágenes.|Elegir un ejemplo|Montaje de proyecto guardado|Estilo analizado|Se analiza al ejecutar Reel|Quitar ejemplo {{name}}|El vídeo de este ejemplo ya no está en la Biblioteca.|Los créditos de análisis de vídeo se incluyen en la estimación de Reel. Añadir ejemplos no inicia un análisis.|Carpetas|Todas las carpetas|Sin carpeta|Carpeta|Elige o crea una carpeta|ejemplos|Subir vídeo|Biblioteca / Proyectos",
  fr: "Exemples du style|Ajoutez des vidéos ou des montages de projets. Reel apprend leur style commun et l’adapte à vos nouvelles images.|Choisir un exemple|Montage de projet enregistré|Style analysé|Analysé au lancement de Reel|Retirer l’exemple {{name}}|La vidéo de cet exemple n’est plus dans la Bibliothèque.|Les crédits d’analyse vidéo sont inclus dans l’estimation de Reel. Ajouter des exemples ne lance pas d’analyse.|Dossiers|Tous les dossiers|Sans dossier|Dossier|Choisir ou créer un dossier|exemples|Importer une vidéo|Bibliothèque / Projets",
  de: "Stilbeispiele|Füge Videos oder Projektmontagen hinzu. Reel erkennt ihren gemeinsamen Stil und passt ihn an dein neues Material an.|Beispiel auswählen|Gespeicherte Projektmontage|Stil analysiert|Wird beim Start von Reel analysiert|Beispiel {{name}} entfernen|Das Video dieses Beispiels ist nicht mehr in der Bibliothek.|Die Credits für Videoanalysen sind in Reels Schätzung enthalten. Beispiele hinzuzufügen startet keine Analyse.|Ordner|Alle Ordner|Ohne Ordner|Ordner|Ordner auswählen oder erstellen|Beispiele|Video hochladen|Bibliothek / Projekte",
  pt: "Exemplos do estilo|Adicione vídeos ou montagens de projetos. O Reel aprende o estilo comum e adapta-o às novas imagens.|Escolher um exemplo|Montagem de projeto guardada|Estilo analisado|Analisado ao iniciar o Reel|Remover exemplo {{name}}|O vídeo deste exemplo já não está na Biblioteca.|Os créditos da análise de vídeo estão incluídos na estimativa do Reel. Adicionar exemplos não inicia uma análise.|Pastas|Todas as pastas|Sem pasta|Pasta|Escolha ou crie uma pasta|exemplos|Carregar vídeo|Biblioteca / Projetos",
  nl: "Stijlvoorbeelden|Voeg video's of projectmontages toe. Reel leert hun gedeelde stijl en past die aan je nieuwe beelden aan.|Kies een voorbeeld|Opgeslagen projectmontage|Stijl geanalyseerd|Wordt geanalyseerd wanneer je Reel start|Voorbeeld {{name}} verwijderen|De video van dit voorbeeld staat niet meer in de Bibliotheek.|Credits voor videoanalyse zijn opgenomen in de schatting van Reel. Voorbeelden toevoegen start geen analyse.|Mappen|Alle mappen|Zonder map|Map|Kies of maak een map|voorbeelden|Video uploaden|Bibliotheek / Projecten",
  pl: "Przykłady stylu|Dodaj filmy lub montaże projektów. Reel poznaje ich wspólny styl i dostosowuje go do nowych nagrań.|Wybierz przykład|Zapisany montaż projektu|Styl przeanalizowany|Analiza po uruchomieniu Reel|Usuń przykład {{name}}|Filmu tego przykładu nie ma już w Bibliotece.|Kredyty na analizę filmów są uwzględnione w wycenie Reel. Dodanie przykładów nie uruchamia analizy.|Foldery|Wszystkie foldery|Bez folderu|Folder|Wybierz lub utwórz folder|przykłady|Prześlij film|Biblioteka / Projekty",
  ro: "Exemple de stil|Adaugă videoclipuri sau montaje de proiect. Reel învață stilul lor comun și îl adaptează noilor filmări.|Alege un exemplu|Montaj de proiect salvat|Stil analizat|Analizat când pornești Reel|Elimină exemplul {{name}}|Videoclipul acestui exemplu nu mai este în Bibliotecă.|Creditele pentru analiza video sunt incluse în estimarea Reel. Adăugarea exemplelor nu pornește o analiză.|Dosare|Toate dosarele|Fără dosar|Dosar|Alege sau creează un dosar|exemple|Încarcă un videoclip|Bibliotecă / Proiecte",
  tr: "Stil örnekleri|Video veya proje kurgusu ekleyin. Reel ortak stillerini öğrenir ve yeni çekimlerinize uyarlar.|Örnek seçin|Kaydedilmiş proje kurgusu|Stil analiz edildi|Reel çalıştırıldığında analiz edilir|{{name}} örneğini kaldır|Bu örneğin videosu artık Kitaplıkta değil.|Video analizi kredileri Reel tahminine dahildir. Örnek eklemek analiz başlatmaz.|Klasörler|Tüm klasörler|Klasörsüz|Klasör|Klasör seçin veya oluşturun|örnek|Video yükle|Kitaplık / Projeler",
  uk: "Приклади стилю|Додайте відео або монтажі проєктів. Reel вивчає їхній спільний стиль і адаптує його до нових кадрів.|Вибрати приклад|Збережений монтаж проєкту|Стиль проаналізовано|Аналіз під час запуску Reel|Видалити приклад {{name}}|Відео цього прикладу більше немає в Бібліотеці.|Кредити за аналіз відео включено в оцінку Reel. Додавання прикладів не запускає аналіз.|Папки|Усі папки|Без папки|Папка|Виберіть або створіть папку|приклади|Завантажити відео|Бібліотека / Проєкти",
  ru: "Примеры стиля|Добавьте видео или монтажи проектов. Reel изучит их общий стиль и адаптирует его к новым кадрам.|Выбрать пример|Сохранённый монтаж проекта|Стиль проанализирован|Анализ при запуске Reel|Удалить пример {{name}}|Видео этого примера больше нет в Библиотеке.|Кредиты за анализ видео включены в оценку Reel. Добавление примеров не запускает анализ.|Папки|Все папки|Без папки|Папка|Выберите или создайте папку|примеры|Загрузить видео|Библиотека / Проекты",
  ar: "أمثلة النمط|أضف مقاطع فيديو أو مونتاج مشاريع. يتعلم Reel نمطها المشترك ويكيفه مع لقطاتك الجديدة.|اختر مثالاً|مونتاج مشروع محفوظ|تم تحليل النمط|يُحلل عند تشغيل Reel|إزالة المثال {{name}}|لم يعد فيديو هذا المثال موجوداً في المكتبة.|أرصدة تحليل الفيديو مضمنة في تقدير Reel. إضافة الأمثلة لا تبدأ تحليلاً.|المجلدات|كل المجلدات|بلا مجلد|مجلد|اختر مجلداً أو أنشئه|أمثلة|رفع فيديو|المكتبة / المشاريع",
  hi: "शैली के उदाहरण|वीडियो या प्रोजेक्ट संपादन जोड़ें। Reel उनकी साझा शैली सीखकर उसे आपकी नई फुटेज के अनुसार ढालता है।|उदाहरण चुनें|सहेजा गया प्रोजेक्ट संपादन|शैली का विश्लेषण हुआ|Reel चलाने पर विश्लेषण होगा|उदाहरण {{name}} हटाएँ|इस उदाहरण का वीडियो अब लाइब्रेरी में नहीं है।|वीडियो विश्लेषण के क्रेडिट Reel के अनुमान में शामिल हैं। उदाहरण जोड़ने से विश्लेषण शुरू नहीं होता।|फ़ोल्डर|सभी फ़ोल्डर|बिना फ़ोल्डर|फ़ोल्डर|फ़ोल्डर चुनें या बनाएँ|उदाहरण|वीडियो अपलोड करें|लाइब्रेरी / प्रोजेक्ट",
  ja: "スタイルの例|動画やプロジェクトの編集を追加します。Reelが共通のスタイルを学び、新しい映像に合わせます。|例を選択|保存済みのプロジェクト編集|スタイル分析済み|Reelの実行時に分析|例「{{name}}」を削除|この例の動画はライブラリにありません。|動画分析のクレジットはReelの見積もりに含まれます。例を追加しても分析は始まりません。|フォルダー|すべてのフォルダー|未分類|フォルダー|フォルダーを選択または作成|例|動画をアップロード|ライブラリ / プロジェクト",
  ko: "스타일 예시|동영상이나 프로젝트 편집본을 추가하세요. Reel이 공통 스타일을 학습해 새 영상에 맞게 적용합니다.|예시 선택|저장된 프로젝트 편집본|스타일 분석 완료|Reel 실행 시 분석|{{name}} 예시 제거|이 예시의 동영상이 더 이상 라이브러리에 없습니다.|동영상 분석 크레딧은 Reel 예상 비용에 포함됩니다. 예시를 추가해도 분석이 시작되지 않습니다.|폴더|모든 폴더|미분류|폴더|폴더 선택 또는 만들기|예시|동영상 업로드|라이브러리 / 프로젝트",
  zh: "风格示例|添加视频或项目剪辑。Reel 会学习它们的共同风格，并根据新素材进行调整。|选择示例|已保存的项目剪辑|风格已分析|运行 Reel 时分析|移除示例 {{name}}|此示例的视频已不在素材库中。|视频分析积分已包含在 Reel 的预估中。添加示例不会启动分析。|文件夹|所有文件夹|未归档|文件夹|选择或创建文件夹|示例|上传视频|素材库 / 项目",
  vi: "Ví dụ phong cách|Thêm video hoặc bản dựng dự án. Reel học phong cách chung và điều chỉnh cho cảnh quay mới của bạn.|Chọn ví dụ|Bản dựng dự án đã lưu|Đã phân tích phong cách|Phân tích khi chạy Reel|Xóa ví dụ {{name}}|Video của ví dụ này không còn trong Thư viện.|Tín dụng phân tích video được tính trong ước tính của Reel. Thêm ví dụ không bắt đầu phân tích.|Thư mục|Tất cả thư mục|Chưa phân loại|Thư mục|Chọn hoặc tạo thư mục|ví dụ|Tải video lên|Thư viện / Dự án",
  da: "Stileksempler|Tilføj videoer eller projektklip. Reel lærer deres fælles stil og tilpasser den til dine nye optagelser.|Vælg et eksempel|Gemt projektklip|Stil analyseret|Analyseres, når du starter Reel|Fjern eksempel {{name}}|Videoen til dette eksempel findes ikke længere i Biblioteket.|Credits til videoanalyse indgår i Reels estimat. Tilføjelse af eksempler starter ikke en analyse.|Mapper|Alle mapper|Uden mappe|Mappe|Vælg eller opret en mappe|eksempler|Upload video|Bibliotek / Projekter",
  sv: "Stilexempel|Lägg till videor eller projektredigeringar. Reel lär sig deras gemensamma stil och anpassar den till ditt nya material.|Välj ett exempel|Sparad projektredigering|Stilen analyserad|Analyseras när du kör Reel|Ta bort exemplet {{name}}|Exemplets video finns inte längre i Biblioteket.|Krediter för videoanalys ingår i Reels uppskattning. Att lägga till exempel startar ingen analys.|Mappar|Alla mappar|Utan mapp|Mapp|Välj eller skapa en mapp|exempel|Ladda upp video|Bibliotek / Projekt",
  no: "Stileksempler|Legg til videoer eller prosjektredigeringer. Reel lærer deres felles stil og tilpasser den til de nye opptakene dine.|Velg et eksempel|Lagret prosjektredigering|Stilen er analysert|Analyseres når du kjører Reel|Fjern eksempelet {{name}}|Videoen til dette eksempelet finnes ikke lenger i Biblioteket.|Kreditter for videoanalyse er inkludert i Reels estimat. Å legge til eksempler starter ingen analyse.|Mapper|Alle mapper|Uten mappe|Mappe|Velg eller opprett en mappe|eksempler|Last opp video|Bibliotek / Prosjekter",
  fi: "Tyyliesimerkit|Lisää videoita tai projektileikkauksia. Reel oppii niiden yhteisen tyylin ja sovittaa sen uuteen kuvamateriaaliisi.|Valitse esimerkki|Tallennettu projektileikkaus|Tyyli analysoitu|Analysoidaan, kun käynnistät Reelin|Poista esimerkki {{name}}|Tämän esimerkin video ei ole enää Kirjastossa.|Videoanalyysin krediitit sisältyvät Reelin arvioon. Esimerkkien lisääminen ei käynnistä analyysia.|Kansiot|Kaikki kansiot|Ilman kansiota|Kansio|Valitse tai luo kansio|esimerkkiä|Lataa video|Kirjasto / Projektit",
  cs: "Příklady stylu|Přidejte videa nebo střihy projektů. Reel se naučí jejich společný styl a přizpůsobí ho novým záběrům.|Vybrat příklad|Uložený střih projektu|Styl analyzován|Analyzuje se při spuštění Reel|Odebrat příklad {{name}}|Video tohoto příkladu už není v Knihovně.|Kredity za analýzu videa jsou zahrnuty v odhadu Reel. Přidání příkladů nespouští analýzu.|Složky|Všechny složky|Bez složky|Složka|Vyberte nebo vytvořte složku|příklady|Nahrát video|Knihovna / Projekty",
  hu: "Stíluspéldák|Adj hozzá videókat vagy projektvágásokat. A Reel megtanulja közös stílusukat, és az új felvételeidhez igazítja.|Példa kiválasztása|Mentett projektvágás|Stílus elemezve|A Reel indításakor elemzi|{{name}} példa eltávolítása|Ennek a példának a videója már nincs a Könyvtárban.|A videóelemzés kreditjeit a Reel becslése tartalmazza. Példák hozzáadása nem indít elemzést.|Mappák|Összes mappa|Mappa nélkül|Mappa|Válassz vagy hozz létre mappát|példa|Videó feltöltése|Könyvtár / Projektek",
  el: "Παραδείγματα στυλ|Προσθέστε βίντεο ή μοντάζ έργων. Το Reel μαθαίνει το κοινό τους στυλ και το προσαρμόζει στα νέα πλάνα σας.|Επιλογή παραδείγματος|Αποθηκευμένο μοντάζ έργου|Το στυλ αναλύθηκε|Αναλύεται όταν ξεκινάτε το Reel|Αφαίρεση παραδείγματος {{name}}|Το βίντεο αυτού του παραδείγματος δεν βρίσκεται πλέον στη Βιβλιοθήκη.|Οι μονάδες ανάλυσης βίντεο περιλαμβάνονται στην εκτίμηση του Reel. Η προσθήκη παραδειγμάτων δεν ξεκινά ανάλυση.|Φάκελοι|Όλοι οι φάκελοι|Χωρίς φάκελο|Φάκελος|Επιλέξτε ή δημιουργήστε φάκελο|παραδείγματα|Μεταφόρτωση βίντεο|Βιβλιοθήκη / Έργα",
  he: "דוגמאות לסגנון|הוסיפו סרטונים או עריכות פרויקטים. Reel לומד את הסגנון המשותף ומתאים אותו לצילומים החדשים שלכם.|בחירת דוגמה|עריכת פרויקט שמורה|הסגנון נותח|ינותח בעת הפעלת Reel|הסרת הדוגמה {{name}}|הסרטון של דוגמה זו כבר אינו בספרייה.|הקרדיטים לניתוח וידאו כלולים בהערכה של Reel. הוספת דוגמאות אינה מתחילה ניתוח.|תיקיות|כל התיקיות|ללא תיקייה|תיקייה|בחירת תיקייה או יצירתה|דוגמאות|העלאת וידאו|ספרייה / פרויקטים",
  id: "Contoh gaya|Tambahkan video atau suntingan proyek. Reel mempelajari gaya bersama dan menyesuaikannya dengan rekaman baru Anda.|Pilih contoh|Suntingan proyek tersimpan|Gaya telah dianalisis|Dianalisis saat Anda menjalankan Reel|Hapus contoh {{name}}|Video contoh ini tidak lagi ada di Pustaka.|Kredit analisis video termasuk dalam perkiraan Reel. Menambahkan contoh tidak memulai analisis.|Folder|Semua folder|Tanpa folder|Folder|Pilih atau buat folder|contoh|Unggah video|Pustaka / Proyek",
  th: "ตัวอย่างสไตล์|เพิ่มวิดีโอหรืองานตัดต่อโปรเจกต์ Reel จะเรียนรู้สไตล์ร่วมและปรับให้เข้ากับฟุตเทจใหม่ของคุณ|เลือกตัวอย่าง|งานตัดต่อโปรเจกต์ที่บันทึกไว้|วิเคราะห์สไตล์แล้ว|วิเคราะห์เมื่อคุณเริ่ม Reel|นำตัวอย่าง {{name}} ออก|วิดีโอของตัวอย่างนี้ไม่อยู่ในคลังแล้ว|เครดิตวิเคราะห์วิดีโอรวมอยู่ในค่าประมาณของ Reel การเพิ่มตัวอย่างจะไม่เริ่มการวิเคราะห์|โฟลเดอร์|ทุกโฟลเดอร์|ไม่มีโฟลเดอร์|โฟลเดอร์|เลือกหรือสร้างโฟลเดอร์|ตัวอย่าง|อัปโหลดวิดีโอ|คลัง / โปรเจกต์",
};
export const styleExamplesUi = Object.fromEntries(
  Object.entries(rows).map(([language, row]) => {
    const values = row.split("|");
    if (values.length !== keys.length)
      throw new Error(`Incomplete style example catalog: ${language}`);
    return [
      language,
      Object.fromEntries(keys.map((key, index) => [key, values[index]])),
    ];
  })
);

const preparationKeys = [
  "Estimating runs paid review and planning: up to {{credits}} credits. Completed preparation is reused.",
  "Style example review: {{credits}} credits.",
];
const preparationRows: Record<string, string> = {
  it: "La stima esegue analisi e pianificazione a pagamento: fino a {{credits}} crediti. La preparazione già completata viene riutilizzata.|Analisi degli esempi dello stile: {{credits}} crediti.",
  es: "La estimación ejecuta análisis y planificación de pago: hasta {{credits}} créditos. Se reutiliza la preparación completada.|Análisis de ejemplos del estilo: {{credits}} créditos.",
  fr: "L’estimation lance une analyse et une planification payantes : jusqu’à {{credits}} crédits. La préparation terminée est réutilisée.|Analyse des exemples du style : {{credits}} crédits.",
  de: "Die Schätzung führt kostenpflichtige Analyse und Planung aus: bis zu {{credits}} Credits. Abgeschlossene Vorbereitung wird wiederverwendet.|Analyse der Stilbeispiele: {{credits}} Credits.",
  pt: "A estimativa executa análise e planeamento pagos: até {{credits}} créditos. A preparação concluída é reutilizada.|Análise dos exemplos do estilo: {{credits}} créditos.",
  nl: "De schatting voert betaalde analyse en planning uit: maximaal {{credits}} credits. Voltooide voorbereiding wordt hergebruikt.|Analyse van stijlvoorbeelden: {{credits}} credits.",
  pl: "Wycena uruchamia płatną analizę i planowanie: do {{credits}} kredytów. Ukończone przygotowanie jest używane ponownie.|Analiza przykładów stylu: {{credits}} kredytów.",
  ro: "Estimarea execută analiză și planificare plătite: până la {{credits}} credite. Pregătirea finalizată este reutilizată.|Analiza exemplelor de stil: {{credits}} credite.",
  tr: "Tahmin, ücretli analiz ve planlama yapar: en fazla {{credits}} kredi. Tamamlanan hazırlık yeniden kullanılır.|Stil örneği analizi: {{credits}} kredi.",
  uk: "Оцінка запускає платний аналіз і планування: до {{credits}} кредитів. Завершена підготовка використовується повторно.|Аналіз прикладів стилю: {{credits}} кредитів.",
  ru: "Оценка запускает платный анализ и планирование: до {{credits}} кредитов. Завершённая подготовка используется повторно.|Анализ примеров стиля: {{credits}} кредитов.",
  ar: "يشغّل التقدير تحليلاً وتخطيطاً مدفوعين: حتى {{credits}} رصيداً. يُعاد استخدام الإعداد المكتمل.|تحليل أمثلة النمط: {{credits}} رصيداً.",
  hi: "अनुमान में सशुल्क विश्लेषण और योजना चलती है: अधिकतम {{credits}} क्रेडिट। पूरी हुई तैयारी दोबारा उपयोग होती है।|शैली के उदाहरणों का विश्लेषण: {{credits}} क्रेडिट।",
  ja: "見積もりでは有料の分析と計画を実行します（最大{{credits}}クレジット）。完了済みの準備は再利用します。|スタイル例の分析：{{credits}}クレジット。",
  ko: "예상 비용 산정 시 유료 분석과 계획을 실행합니다. 최대 {{credits}}크레딧이며, 완료된 준비는 재사용합니다.|스타일 예시 분석: {{credits}}크레딧.",
  zh: "预估会执行付费分析和规划，最多消耗 {{credits}} 积分。已完成的准备工作会重复使用。|风格示例分析：{{credits}} 积分。",
  vi: "Ước tính thực hiện phân tích và lập kế hoạch có phí: tối đa {{credits}} tín dụng. Phần chuẩn bị đã xong được sử dụng lại.|Phân tích ví dụ phong cách: {{credits}} tín dụng.",
  da: "Estimatet udfører betalt analyse og planlægning: op til {{credits}} credits. Færdig forberedelse genbruges.|Analyse af stileksempler: {{credits}} credits.",
  sv: "Uppskattningen kör betald analys och planering: upp till {{credits}} krediter. Slutförda förberedelser återanvänds.|Analys av stilexempel: {{credits}} krediter.",
  no: "Estimatet kjører betalt analyse og planlegging: opptil {{credits}} kreditter. Fullført forberedelse gjenbrukes.|Analyse av stileksempler: {{credits}} kreditter.",
  fi: "Arvio suorittaa maksullisen analyysin ja suunnittelun: enintään {{credits}} krediittiä. Valmis valmistelu käytetään uudelleen.|Tyyliesimerkkien analyysi: {{credits}} krediittiä.",
  cs: "Odhad spouští placenou analýzu a plánování: až {{credits}} kreditů. Dokončená příprava se použije znovu.|Analýza příkladů stylu: {{credits}} kreditů.",
  hu: "A becslés fizetős elemzést és tervezést futtat: legfeljebb {{credits}} kredit. Az elkészült előkészítést újra felhasználja.|Stíluspéldák elemzése: {{credits}} kredit.",
  el: "Η εκτίμηση εκτελεί ανάλυση και σχεδιασμό με χρέωση: έως {{credits}} μονάδες. Η ολοκληρωμένη προετοιμασία επαναχρησιμοποιείται.|Ανάλυση παραδειγμάτων στυλ: {{credits}} μονάδες.",
  he: "ההערכה מפעילה ניתוח ותכנון בתשלום: עד {{credits}} קרדיטים. הכנה שהושלמה משמשת שוב.|ניתוח דוגמאות סגנון: {{credits}} קרדיטים.",
  id: "Perkiraan menjalankan analisis dan perencanaan berbayar: hingga {{credits}} kredit. Persiapan yang selesai digunakan kembali.|Analisis contoh gaya: {{credits}} kredit.",
  th: "การประเมินจะวิเคราะห์และวางแผนแบบมีค่าใช้จ่าย สูงสุด {{credits}} เครดิต โดยนำการเตรียมที่เสร็จแล้วมาใช้ซ้ำ|วิเคราะห์ตัวอย่างสไตล์: {{credits}} เครดิต",
};
for (const [language, row] of Object.entries(preparationRows)) {
  const values = row.split("|");
  if (values.length !== preparationKeys.length)
    throw new Error(`Incomplete style preparation catalog: ${language}`);
  Object.assign(
    styleExamplesUi[language],
    Object.fromEntries(
      preparationKeys.map((key, index) => [key, values[index]])
    )
  );
}
