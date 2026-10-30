import type { InterfaceLanguage } from "@contracts/interface-language";
const keys = [
  "Choose a preset",
  "Collapse composer",
  "Create style",
  "Customize a stock preset",
  "Customize, save and reuse this preset in any edit.",
  "Estimate credits",
  "Expand composer",
  "Export preset",
  "Import preset",
  "Personal styles",
  "Preview snapping",
  "Reel commands",
  "Restore Reel timing and title",
  "Restore Reel version",
  "Snap to canvas, objects and spacing",
  "Transition presets",
];
const rows: Partial<Record<InterfaceLanguage, string>> = {
  it: "Scegli un preset|Riduci il campo messaggio|Crea stile|Personalizza un preset stock|Personalizza, salva e riutilizza questo preset in qualsiasi montaggio.|Stima crediti|Espandi il campo messaggio|Esporta preset|Importa preset|Stili personali|Aggancio nell'anteprima|Comandi di Reel|Ripristina tempi e titolo di Reel|Ripristina versione di Reel|Aggancia a formato, oggetti e distanze|Preset di transizione",
  es: "Elige un preajuste|Contraer editor de mensajes|Crear estilo|Personalizar un preajuste de catálogo|Personaliza, guarda y reutiliza este preajuste en cualquier edición.|Estimar créditos|Ampliar editor de mensajes|Exportar preajuste|Importar preajuste|Estilos personales|Ajuste en vista previa|Comandos de Reel|Restaurar tiempos y título de Reel|Restaurar versión de Reel|Ajustar al lienzo, objetos y espaciado|Preajustes de transición",
  fr: "Choisir un préréglage|Réduire la zone de saisie|Créer un style|Personnaliser un préréglage du catalogue|Personnalisez, enregistrez et réutilisez ce préréglage dans vos montages.|Estimer les crédits|Agrandir la zone de saisie|Exporter le préréglage|Importer un préréglage|Styles personnels|Magnétisme de l'aperçu|Commandes de Reel|Restaurer les temps et le titre de Reel|Restaurer la version de Reel|Aligner sur le cadre, les objets et les espacements|Préréglages de transition",
  de: "Vorlage auswählen|Eingabefeld verkleinern|Stil erstellen|Katalogvorlage anpassen|Diese Vorlage anpassen, speichern und in jedem Schnitt wiederverwenden.|Credits schätzen|Eingabefeld vergrößern|Vorlage exportieren|Vorlage importieren|Eigene Stile|Einrasten in der Vorschau|Reel-Befehle|Reels Zeiten und Titel wiederherstellen|Reel-Version wiederherstellen|An Bildfläche, Objekten und Abständen einrasten|Übergangsvorlagen",
  pt: "Escolher predefinição|Recolher campo de mensagem|Criar estilo|Personalizar predefinição do catálogo|Personalize, guarde e reutilize esta predefinição em qualquer edição.|Estimar créditos|Expandir campo de mensagem|Exportar predefinição|Importar predefinição|Estilos pessoais|Encaixe na pré-visualização|Comandos do Reel|Restaurar tempos e título do Reel|Restaurar versão do Reel|Encaixar na tela, nos objetos e no espaçamento|Predefinições de transição",
  nl: "Kies een voorinstelling|Berichtvak verkleinen|Stijl maken|Catalogusvoorinstelling aanpassen|Pas deze voorinstelling aan, sla haar op en hergebruik haar in elke montage.|Credits schatten|Berichtvak vergroten|Voorinstelling exporteren|Voorinstelling importeren|Eigen stijlen|Uitlijnen in voorbeeld|Reel-opdrachten|Timing en titel van Reel herstellen|Reel-versie herstellen|Uitlijnen op canvas, objecten en tussenruimten|Overgangsvoorinstellingen",
  pl: "Wybierz ustawienie|Zwiń pole wiadomości|Utwórz styl|Dostosuj ustawienie z katalogu|Dostosuj, zapisz i wykorzystuj to ustawienie w dowolnym montażu.|Oszacuj kredyty|Rozwiń pole wiadomości|Eksportuj ustawienie|Importuj ustawienie|Własne style|Przyciąganie w podglądzie|Polecenia Reel|Przywróć czas i tytuł od Reel|Przywróć wersję Reel|Przyciągaj do obszaru, obiektów i odstępów|Ustawienia przejść",
  ro: "Alege o presetare|Restrânge câmpul mesajului|Creează stil|Personalizează o presetare din catalog|Personalizează, salvează și refolosește această presetare în orice montaj.|Estimează creditele|Extinde câmpul mesajului|Exportă presetarea|Importă presetare|Stiluri personale|Aliniere magnetică în previzualizare|Comenzi Reel|Restabilește timpii și titlul Reel|Restabilește versiunea Reel|Aliniază la cadru, obiecte și spațiere|Presetări de tranziție",
  tr: "Ön ayar seç|Mesaj alanını daralt|Stil oluştur|Katalog ön ayarını özelleştir|Bu ön ayarı özelleştir, kaydet ve her düzenlemede yeniden kullan.|Kredileri tahmin et|Mesaj alanını genişlet|Ön ayarı dışa aktar|Ön ayar içe aktar|Kişisel stiller|Önizlemede yakalama|Reel komutları|Reel zamanlamasını ve başlığını geri yükle|Reel sürümünü geri yükle|Tuvale, nesnelere ve aralıklara hizala|Geçiş ön ayarları",
  uk: "Вибрати шаблон|Згорнути поле повідомлення|Створити стиль|Налаштувати шаблон із каталогу|Налаштуйте, збережіть і використовуйте цей шаблон у будь-якому монтажі.|Оцінити кредити|Розгорнути поле повідомлення|Експортувати шаблон|Імпортувати шаблон|Власні стилі|Прив’язка в перегляді|Команди Reel|Відновити час і назву від Reel|Відновити версію Reel|Прив’язувати до полотна, об’єктів і відступів|Шаблони переходів",
  ru: "Выбрать шаблон|Свернуть поле сообщения|Создать стиль|Настроить шаблон из каталога|Настройте, сохраните и используйте этот шаблон в любом монтаже.|Оценить кредиты|Развернуть поле сообщения|Экспортировать шаблон|Импортировать шаблон|Свои стили|Привязка в предпросмотре|Команды Reel|Восстановить время и название Reel|Восстановить версию Reel|Привязывать к холсту, объектам и интервалам|Шаблоны переходов",
  ar: "اختر إعدادًا مسبقًا|تصغير حقل الرسالة|إنشاء نمط|تخصيص إعداد من الكتالوج|خصّص هذا الإعداد واحفظه وأعد استخدامه في أي مونتاج.|تقدير الأرصدة|توسيع حقل الرسالة|تصدير الإعداد|استيراد إعداد|أنماط شخصية|المحاذاة في المعاينة|أوامر Reel|استعادة توقيت Reel وعنوانه|استعادة نسخة Reel|محاذاة مع اللوحة والعناصر والمسافات|إعدادات الانتقالات",
  hi: "प्रीसेट चुनें|संदेश क्षेत्र छोटा करें|स्टाइल बनाएँ|कैटलॉग प्रीसेट बदलें|इस प्रीसेट को बदलें, सहेजें और किसी भी एडिट में फिर इस्तेमाल करें।|क्रेडिट का अनुमान|संदेश क्षेत्र बड़ा करें|प्रीसेट एक्सपोर्ट करें|प्रीसेट इम्पोर्ट करें|अपने स्टाइल|प्रीव्यू स्नैपिंग|Reel कमांड|Reel का समय और शीर्षक बहाल करें|Reel का संस्करण बहाल करें|कैनवस, वस्तुओं और दूरी से स्नैप करें|ट्रांज़िशन प्रीसेट",
  ja: "プリセットを選択|入力欄を縮小|スタイルを作成|標準プリセットをカスタマイズ|プリセットをカスタマイズして保存し、どの編集でも再利用できます。|クレジットを見積もる|入力欄を拡大|プリセットをエクスポート|プリセットをインポート|マイスタイル|プレビューのスナップ|Reelのコマンド|Reelのタイミングとタイトルを復元|Reelのバージョンを復元|キャンバス、オブジェクト、間隔にスナップ|トランジションプリセット",
  ko: "프리셋 선택|입력창 축소|스타일 만들기|기본 프리셋 맞춤 설정|이 프리셋을 수정하고 저장해 모든 편집에서 다시 사용하세요.|크레딧 예상|입력창 확대|프리셋 내보내기|프리셋 가져오기|내 스타일|미리보기 스냅|Reel 명령|Reel의 타이밍과 제목 복원|Reel 버전 복원|캔버스, 개체 및 간격에 맞추기|전환 프리셋",
  zh: "选择预设|缩小输入框|创建样式|自定义内置预设|自定义并保存此预设，在任何剪辑中重复使用。|预估点数|展开输入框|导出预设|导入预设|个人样式|预览吸附|Reel 命令|恢复 Reel 的时间和标题|恢复 Reel 版本|吸附到画布、对象和间距|转场预设",
  vi: "Chọn mẫu|Thu gọn ô tin nhắn|Tạo kiểu|Tùy chỉnh mẫu có sẵn|Tùy chỉnh, lưu và sử dụng lại mẫu này trong mọi bản dựng.|Ước tính tín dụng|Mở rộng ô tin nhắn|Xuất mẫu|Nhập mẫu|Kiểu cá nhân|Bám căn chỉnh trong bản xem trước|Lệnh Reel|Khôi phục thời gian và tiêu đề của Reel|Khôi phục phiên bản Reel|Bám vào khung, đối tượng và khoảng cách|Mẫu chuyển cảnh",
  da: "Vælg forudindstilling|Formindsk beskedfelt|Opret stil|Tilpas en katalogforudindstilling|Tilpas, gem og genbrug denne forudindstilling i enhver redigering.|Anslå credits|Udvid beskedfelt|Eksportér forudindstilling|Importér forudindstilling|Egne stilarter|Fastgørelse i forhåndsvisning|Reel-kommandoer|Gendan Reels timing og titel|Gendan Reel-version|Fastgør til lærred, objekter og afstande|Overgangsforudindstillinger",
  sv: "Välj förinställning|Minska meddelandefält|Skapa stil|Anpassa en katalogförinställning|Anpassa, spara och återanvänd denna förinställning i alla redigeringar.|Uppskatta krediter|Utöka meddelandefält|Exportera förinställning|Importera förinställning|Egna stilar|Fäst i förhandsvisningen|Reel-kommandon|Återställ Reels tider och titel|Återställ Reel-version|Fäst vid arbetsyta, objekt och mellanrum|Övergångsförinställningar",
  no: "Velg forhåndsinnstilling|Gjør meldingsfeltet mindre|Opprett stil|Tilpass en kataloginnstilling|Tilpass, lagre og gjenbruk denne forhåndsinnstillingen i alle redigeringer.|Anslå kreditter|Utvid meldingsfelt|Eksporter forhåndsinnstilling|Importer forhåndsinnstilling|Egne stiler|Fest i forhåndsvisningen|Reel-kommandoer|Gjenopprett Reels tider og tittel|Gjenopprett Reel-versjon|Fest til lerret, objekter og avstander|Overgangsinnstillinger",
  fi: "Valitse esiasetus|Pienennä viestikenttää|Luo tyyli|Muokkaa luettelon esiasetusta|Muokkaa, tallenna ja käytä tätä esiasetusta uudelleen kaikissa muokkauksissa.|Arvioi krediitit|Laajenna viestikenttää|Vie esiasetus|Tuo esiasetus|Omat tyylit|Esikatselun kohdistus|Reelin komennot|Palauta Reelin ajoitus ja otsikko|Palauta Reelin versio|Kohdista kankaaseen, objekteihin ja väleihin|Siirtymien esiasetukset",
  cs: "Vybrat předvolbu|Zmenšit pole zprávy|Vytvořit styl|Upravit předvolbu z katalogu|Upravte, uložte a znovu používejte tuto předvolbu v libovolném střihu.|Odhadnout kredity|Zvětšit pole zprávy|Exportovat předvolbu|Importovat předvolbu|Vlastní styly|Přichytávání v náhledu|Příkazy Reel|Obnovit časy a název od Reel|Obnovit verzi Reel|Přichytit k plátnu, objektům a rozestupům|Předvolby přechodů",
  hu: "Válassz előbeállítást|Üzenetmező összecsukása|Stílus létrehozása|Katalógus-előbeállítás testreszabása|Szabd testre, mentsd el és használd újra ezt az előbeállítást bármely szerkesztésben.|Kreditek becslése|Üzenetmező kibontása|Előbeállítás exportálása|Előbeállítás importálása|Saját stílusok|Illesztés az előnézetben|Reel-parancsok|Reel időzítésének és címének visszaállítása|Reel-verzió visszaállítása|Illesztés a vászonhoz, objektumokhoz és térközökhöz|Átmenet-előbeállítások",
  el: "Επιλογή προρύθμισης|Σύμπτυξη πεδίου μηνύματος|Δημιουργία στυλ|Προσαρμογή προρύθμισης καταλόγου|Προσαρμόστε, αποθηκεύστε και χρησιμοποιήστε ξανά αυτή την προρύθμιση σε κάθε μοντάζ.|Εκτίμηση μονάδων|Ανάπτυξη πεδίου μηνύματος|Εξαγωγή προρύθμισης|Εισαγωγή προρύθμισης|Προσωπικά στυλ|Προσκόλληση στην προεπισκόπηση|Εντολές Reel|Επαναφορά χρονισμού και τίτλου του Reel|Επαναφορά έκδοσης Reel|Προσκόλληση σε καμβά, αντικείμενα και αποστάσεις|Προρυθμίσεις μεταβάσεων",
  he: "בחירת הגדרה מוכנה|צמצום שדה ההודעה|יצירת סגנון|התאמת הגדרה מהקטלוג|התאימו, שמרו והשתמשו בהגדרה זו שוב בכל עריכה.|הערכת קרדיטים|הרחבת שדה ההודעה|ייצוא הגדרה|ייבוא הגדרה|סגנונות אישיים|הצמדה בתצוגה המקדימה|פקודות Reel|שחזור התזמון והכותרת של Reel|שחזור גרסת Reel|הצמדה לקנבס, לאובייקטים ולמרווחים|הגדרות מעברים",
  id: "Pilih preset|Perkecil kolom pesan|Buat gaya|Sesuaikan preset katalog|Sesuaikan, simpan, dan gunakan kembali preset ini di setiap edit.|Perkirakan kredit|Perluas kolom pesan|Ekspor preset|Impor preset|Gaya pribadi|Penempelan di pratinjau|Perintah Reel|Pulihkan waktu dan judul Reel|Pulihkan versi Reel|Tempel ke kanvas, objek, dan jarak|Preset transisi",
  th: "เลือกพรีเซ็ต|ย่อช่องข้อความ|สร้างสไตล์|ปรับแต่งพรีเซ็ตในคลัง|ปรับแต่ง บันทึก และนำพรีเซ็ตนี้กลับมาใช้ได้ในทุกงานตัดต่อ|ประมาณเครดิต|ขยายช่องข้อความ|ส่งออกพรีเซ็ต|นำเข้าพรีเซ็ต|สไตล์ส่วนตัว|การดูดแนวในภาพตัวอย่าง|คำสั่ง Reel|คืนเวลาและชื่อเรื่องของ Reel|คืนเวอร์ชันของ Reel|ดูดเข้ากับผืนงาน วัตถุ และระยะห่าง|พรีเซ็ตการเปลี่ยนฉาก",
};
export const editorOct30Ui: Record<
  string,
  Record<string, string>
> = Object.fromEntries(
  Object.entries(rows).map(([code, row]) => {
    const values = row!.split("|");
    if (values.length !== keys.length)
      throw new Error(`Incomplete editor translations: ${code}`);
    return [code, Object.fromEntries(keys.map((key, i) => [key, values[i]]))];
  })
);
