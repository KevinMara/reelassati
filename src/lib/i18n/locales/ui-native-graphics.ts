import { NATIVE_GRAPHIC_TEMPLATES } from "@contracts/native-graphics";
const keys = [
  "Stacked outline",
  "Split stack",
  "Scrolling outline",
  "Rising word",
  "Split two-line",
  "Two-line reveal",
  "Social handle",
  "Editable animated title.",
  "Animated icon and editable handle.",
  "Icon color",
  "Bar width",
  "Reveal width",
  "Gradient start",
  "Gradient end",
  "Bar color",
  "Reveal color",
  "Loading animation…",
  "Preview position",
  "Second line",
  "Second line color",
  "Customize appearance",
  "Complete both text lines.",
  "Shorten the text or increase its size.",
  "Unsupported characters. Choose another text style.",
  "Shorten the text for this animation.",
  "The animation could not load. Try again.",
];
const rows: Record<string, string> = {
  it: "Contorni sovrapposti|Testo separato|Contorni scorrevoli|Parola in salita|Due righe separate|Comparsa su due righe|Profilo social|Titolo animato modificabile.|Icona animata e nome utente modificabile.|Colore icona|Larghezza barra|Larghezza comparsa|Inizio sfumatura|Fine sfumatura|Colore barra|Colore comparsa|Caricamento animazione…|Posizione anteprima|Seconda riga|Colore seconda riga|Personalizza aspetto|Completa entrambe le righe.|Accorcia il testo o aumentane la dimensione.|Caratteri non supportati. Scegli un altro stile di testo.|Accorcia il testo per questa animazione.|Impossibile caricare l’animazione. Riprova.",
  es: "Contornos apilados|Texto dividido|Contornos en movimiento|Palabra ascendente|Dos líneas divididas|Aparición en dos líneas|Perfil social|Título animado editable.|Icono animado y nombre de usuario editable.|Color del icono|Ancho de barra|Ancho de aparición|Inicio del degradado|Fin del degradado|Color de barra|Color de aparición|Cargando animación…|Posición de vista previa|Segunda línea|Color de segunda línea|Personalizar apariencia|Completa ambas líneas.|Acorta el texto o aumenta su tamaño.|Caracteres no compatibles. Elige otro estilo de texto.|Acorta el texto para esta animación.|No se pudo cargar la animación. Inténtalo de nuevo.",
  fr: "Contours empilés|Texte séparé|Contours défilants|Mot ascendant|Deux lignes séparées|Révélation sur deux lignes|Profil social|Titre animé modifiable.|Icône animée et identifiant modifiable.|Couleur de l’icône|Largeur de la barre|Largeur de révélation|Début du dégradé|Fin du dégradé|Couleur de la barre|Couleur de révélation|Chargement de l’animation…|Position de l’aperçu|Deuxième ligne|Couleur de la deuxième ligne|Personnaliser l’apparence|Complétez les deux lignes.|Raccourcissez le texte ou agrandissez-le.|Caractères non pris en charge. Choisissez un autre style de texte.|Raccourcissez le texte pour cette animation.|Impossible de charger l’animation. Réessayez.",
  de: "Gestapelte Konturen|Geteilter Text|Scrollende Konturen|Aufsteigendes Wort|Zwei geteilte Zeilen|Zweizeilige Enthüllung|Social-Media-Profil|Bearbeitbarer animierter Titel.|Animiertes Symbol und bearbeitbarer Nutzername.|Symbolfarbe|Balkenbreite|Enthüllungsbreite|Verlaufsanfang|Verlaufsende|Balkenfarbe|Enthüllungsfarbe|Animation wird geladen…|Vorschauposition|Zweite Zeile|Farbe der zweiten Zeile|Darstellung anpassen|Beide Textzeilen ausfüllen.|Text kürzen oder vergrößern.|Nicht unterstützte Zeichen. Anderen Textstil wählen.|Text für diese Animation kürzen.|Animation konnte nicht geladen werden. Erneut versuchen.",
  pt: "Contornos empilhados|Texto dividido|Contornos em movimento|Palavra ascendente|Duas linhas divididas|Revelação em duas linhas|Perfil social|Título animado editável.|Ícone animado e nome de utilizador editável.|Cor do ícone|Largura da barra|Largura da revelação|Início do gradiente|Fim do gradiente|Cor da barra|Cor da revelação|A carregar animação…|Posição da pré-visualização|Segunda linha|Cor da segunda linha|Personalizar aparência|Preencha ambas as linhas.|Encurte o texto ou aumente o tamanho.|Caracteres não suportados. Escolha outro estilo de texto.|Encurte o texto para esta animação.|Não foi possível carregar a animação. Tente novamente.",
  nl: "Gestapelde contouren|Gesplitste tekst|Schuivende contouren|Stijgend woord|Twee gesplitste regels|Onthulling in twee regels|Sociaal profiel|Bewerkbare geanimeerde titel.|Geanimeerd pictogram en bewerkbare gebruikersnaam.|Pictogramkleur|Balkbreedte|Onthullingsbreedte|Begin kleurverloop|Einde kleurverloop|Balkkleur|Onthullingskleur|Animatie laden…|Voorbeeldpositie|Tweede regel|Kleur tweede regel|Uiterlijk aanpassen|Vul beide tekstregels in.|Kort de tekst in of vergroot deze.|Niet-ondersteunde tekens. Kies een andere tekststijl.|Kort de tekst in voor deze animatie.|De animatie kon niet worden geladen. Probeer opnieuw.",
  pl: "Ułożone kontury|Rozdzielony tekst|Przewijane kontury|Wznoszące słowo|Dwie rozdzielone linie|Odsłonięcie dwóch linii|Profil społecznościowy|Edytowalny animowany tytuł.|Animowana ikona i edytowalna nazwa użytkownika.|Kolor ikony|Szerokość paska|Szerokość odsłonięcia|Początek gradientu|Koniec gradientu|Kolor paska|Kolor odsłonięcia|Ładowanie animacji…|Pozycja podglądu|Druga linia|Kolor drugiej linii|Dostosuj wygląd|Uzupełnij obie linie tekstu.|Skróć tekst lub zwiększ jego rozmiar.|Nieobsługiwane znaki. Wybierz inny styl tekstu.|Skróć tekst dla tej animacji.|Nie udało się załadować animacji. Spróbuj ponownie.",
  ro: "Contururi suprapuse|Text separat|Contururi derulante|Cuvânt ascendent|Două rânduri separate|Dezvăluire pe două rânduri|Profil social|Titlu animat editabil.|Pictogramă animată și nume de utilizator editabil.|Culoarea pictogramei|Lățimea barei|Lățimea dezvăluirii|Începutul gradientului|Sfârșitul gradientului|Culoarea barei|Culoarea dezvăluirii|Se încarcă animația…|Poziția previzualizării|Al doilea rând|Culoarea celui de-al doilea rând|Personalizează aspectul|Completează ambele rânduri.|Scurtează textul sau mărește-l.|Caractere neacceptate. Alege alt stil de text.|Scurtează textul pentru această animație.|Animația nu a putut fi încărcată. Încearcă din nou.",
  tr: "Üst üste konturlar|Bölünmüş metin|Kayan konturlar|Yükselen sözcük|İki bölünmüş satır|İki satırlı açılış|Sosyal profil|Düzenlenebilir animasyonlu başlık.|Animasyonlu simge ve düzenlenebilir kullanıcı adı.|Simge rengi|Çubuk genişliği|Açılış genişliği|Gradyan başlangıcı|Gradyan sonu|Çubuk rengi|Açılış rengi|Animasyon yükleniyor…|Önizleme konumu|İkinci satır|İkinci satır rengi|Görünümü özelleştir|Her iki metin satırını da doldurun.|Metni kısaltın veya boyutunu artırın.|Desteklenmeyen karakterler. Başka bir metin stili seçin.|Bu animasyon için metni kısaltın.|Animasyon yüklenemedi. Tekrar deneyin.",
  uk: "Стос контурів|Розділений текст|Прокручувані контури|Слово вгору|Два розділені рядки|Поява двох рядків|Соціальний профіль|Редагований анімований заголовок.|Анімована піктограма й редаговане ім’я користувача.|Колір піктограми|Ширина смуги|Ширина появи|Початок градієнта|Кінець градієнта|Колір смуги|Колір появи|Завантаження анімації…|Позиція перегляду|Другий рядок|Колір другого рядка|Налаштувати вигляд|Заповніть обидва рядки.|Скоротіть текст або збільште його.|Непідтримувані символи. Виберіть інший стиль тексту.|Скоротіть текст для цієї анімації.|Не вдалося завантажити анімацію. Спробуйте ще раз.",
  ru: "Стопка контуров|Разделённый текст|Прокрутка контуров|Слово вверх|Две разделённые строки|Появление двух строк|Социальный профиль|Редактируемый анимированный заголовок.|Анимированный значок и редактируемое имя пользователя.|Цвет значка|Ширина полосы|Ширина появления|Начало градиента|Конец градиента|Цвет полосы|Цвет появления|Загрузка анимации…|Позиция просмотра|Вторая строка|Цвет второй строки|Настроить внешний вид|Заполните обе строки.|Сократите текст или увеличьте его.|Неподдерживаемые символы. Выберите другой стиль текста.|Сократите текст для этой анимации.|Не удалось загрузить анимацию. Попробуйте ещё раз.",
  ar: "حدود متراصة|نص منفصل|حدود متحركة|كلمة صاعدة|سطران منفصلان|ظهور سطرين|حساب اجتماعي|عنوان متحرك قابل للتعديل.|أيقونة متحركة واسم مستخدم قابل للتعديل.|لون الأيقونة|عرض الشريط|عرض الظهور|بداية التدرج|نهاية التدرج|لون الشريط|لون الظهور|جارٍ تحميل الحركة…|موضع المعاينة|السطر الثاني|لون السطر الثاني|تخصيص المظهر|أكمل سطري النص.|اختصر النص أو زد حجمه.|أحرف غير مدعومة. اختر نمط نص آخر.|اختصر النص لهذه الحركة.|تعذر تحميل الحركة. حاول مجددًا.",
  hi: "परतदार रूपरेखा|विभाजित पाठ|स्क्रॉल होती रूपरेखा|उभरता शब्द|दो विभाजित पंक्तियाँ|दो पंक्तियों का अनावरण|सोशल प्रोफ़ाइल|संपादन योग्य एनिमेटेड शीर्षक।|एनिमेटेड आइकन और संपादन योग्य उपयोगकर्ता नाम।|आइकन का रंग|पट्टी की चौड़ाई|अनावरण की चौड़ाई|ग्रेडिएंट की शुरुआत|ग्रेडिएंट का अंत|पट्टी का रंग|अनावरण का रंग|एनिमेशन लोड हो रहा है…|पूर्वावलोकन स्थिति|दूसरी पंक्ति|दूसरी पंक्ति का रंग|रूप अनुकूलित करें|दोनों पाठ पंक्तियाँ भरें।|पाठ छोटा करें या उसका आकार बढ़ाएँ।|असमर्थित अक्षर। दूसरी पाठ शैली चुनें।|इस एनिमेशन के लिए पाठ छोटा करें।|एनिमेशन लोड नहीं हुआ। फिर कोशिश करें।",
  ja: "重なるアウトライン|分割スタック|流れるアウトライン|上昇する単語|分割された2行|2行のリビール|ソーシャルアカウント|編集可能なアニメーションタイトル。|動くアイコンと編集可能なユーザー名。|アイコンの色|バーの幅|リビールの幅|グラデーションの開始|グラデーションの終了|バーの色|リビールの色|アニメーションを読み込み中…|プレビュー位置|2行目|2行目の色|外観をカスタマイズ|両方の行を入力してください。|文字を短くするか大きくしてください。|未対応の文字です。別の文字スタイルを選択してください。|このアニメーション用に文字を短くしてください。|アニメーションを読み込めませんでした。再試行してください。",
  ko: "겹친 윤곽선|분리된 텍스트|스크롤 윤곽선|떠오르는 단어|분리된 두 줄|두 줄 나타내기|소셜 계정|편집 가능한 애니메이션 제목.|움직이는 아이콘과 편집 가능한 사용자 이름.|아이콘 색상|막대 너비|나타내기 너비|그라데이션 시작|그라데이션 끝|막대 색상|나타내기 색상|애니메이션 로딩 중…|미리보기 위치|두 번째 줄|두 번째 줄 색상|모양 사용자 지정|두 줄을 모두 입력하세요.|텍스트를 줄이거나 크기를 늘리세요.|지원하지 않는 문자입니다. 다른 텍스트 스타일을 선택하세요.|이 애니메이션에 맞게 텍스트를 줄이세요.|애니메이션을 불러오지 못했습니다. 다시 시도하세요.",
  zh: "堆叠描边|分离堆叠|滚动描边|上升文字|双行分离|双行显现|社交账号|可编辑的动态标题。|动态图标和可编辑的用户名。|图标颜色|条形宽度|显现宽度|渐变起点|渐变终点|条形颜色|显现颜色|正在加载动画…|预览位置|第二行|第二行颜色|自定义外观|请填写两行文字。|请缩短文字或增大字号。|含不支持的字符，请选择其他文字样式。|请为此动画缩短文字。|动画加载失败，请重试。",
  vi: "Viền xếp chồng|Chữ tách lớp|Viền cuộn|Từ nổi lên|Hai dòng tách biệt|Hiện hai dòng|Tài khoản mạng xã hội|Tiêu đề động có thể chỉnh sửa.|Biểu tượng động và tên người dùng có thể chỉnh sửa.|Màu biểu tượng|Chiều rộng thanh|Chiều rộng phần hiện|Đầu chuyển màu|Cuối chuyển màu|Màu thanh|Màu phần hiện|Đang tải hoạt ảnh…|Vị trí xem trước|Dòng thứ hai|Màu dòng thứ hai|Tùy chỉnh giao diện|Điền cả hai dòng chữ.|Rút ngắn chữ hoặc tăng kích thước.|Ký tự không được hỗ trợ. Chọn kiểu chữ khác.|Rút ngắn chữ cho hoạt ảnh này.|Không tải được hoạt ảnh. Hãy thử lại.",
  da: "Stablede konturer|Opdelt tekst|Rullende konturer|Stigende ord|To opdelte linjer|Afsløring i to linjer|Social profil|Redigerbar animeret titel.|Animeret ikon og redigerbart brugernavn.|Ikonfarve|Bjælkebredde|Afsløringsbredde|Forløbets start|Forløbets slutning|Bjælkefarve|Afsløringsfarve|Indlæser animation…|Forhåndsvisningsposition|Anden linje|Farve på anden linje|Tilpas udseende|Udfyld begge tekstlinjer.|Forkort teksten eller gør den større.|Ikke-understøttede tegn. Vælg en anden tekststil.|Forkort teksten til denne animation.|Animationen kunne ikke indlæses. Prøv igen.",
  sv: "Staplade konturer|Delad text|Rullande konturer|Stigande ord|Två delade rader|Avslöjande i två rader|Social profil|Redigerbar animerad titel.|Animerad ikon och redigerbart användarnamn.|Ikonfärg|Stapelbredd|Avslöjandets bredd|Toningens början|Toningens slut|Stapelfärg|Avslöjandets färg|Läser in animering…|Förhandsvisningens position|Andra raden|Andra radens färg|Anpassa utseende|Fyll i båda textraderna.|Korta texten eller öka storleken.|Tecken stöds inte. Välj en annan textstil.|Korta texten för den här animeringen.|Animeringen kunde inte läsas in. Försök igen.",
  no: "Stablede konturer|Delt tekst|Rullende konturer|Stigende ord|To delte linjer|Avsløring i to linjer|Sosial profil|Redigerbar animert tittel.|Animert ikon og redigerbart brukernavn.|Ikonfarge|Stolpebredde|Avsløringsbredde|Forløpets start|Forløpets slutt|Stolpefarge|Avsløringsfarge|Laster inn animasjon…|Forhåndsvisningsposisjon|Andre linje|Farge på andre linje|Tilpass utseende|Fyll ut begge tekstlinjene.|Forkort teksten eller øk størrelsen.|Tegn støttes ikke. Velg en annen tekststil.|Forkort teksten for denne animasjonen.|Animasjonen kunne ikke lastes inn. Prøv igjen.",
  fi: "Pinotut ääriviivat|Jaettu teksti|Vierivät ääriviivat|Nouseva sana|Kaksi jaettua riviä|Kahden rivin paljastus|Sosiaalinen profiili|Muokattava animoitu otsikko.|Animoitu kuvake ja muokattava käyttäjänimi.|Kuvakkeen väri|Palkin leveys|Paljastuksen leveys|Liukuvärin alku|Liukuvärin loppu|Palkin väri|Paljastuksen väri|Ladataan animaatiota…|Esikatselun sijainti|Toinen rivi|Toisen rivin väri|Mukauta ulkoasua|Täytä molemmat tekstirivit.|Lyhennä tekstiä tai suurenna sitä.|Merkkejä ei tueta. Valitse toinen tekstityyli.|Lyhennä tekstiä tätä animaatiota varten.|Animaation lataus epäonnistui. Yritä uudelleen.",
  cs: "Skládané obrysy|Rozdělený text|Posouvající se obrysy|Stoupající slovo|Dva rozdělené řádky|Odhalení dvou řádků|Sociální profil|Upravitelný animovaný nadpis.|Animovaná ikona a upravitelné uživatelské jméno.|Barva ikony|Šířka pruhu|Šířka odhalení|Začátek přechodu|Konec přechodu|Barva pruhu|Barva odhalení|Načítání animace…|Pozice náhledu|Druhý řádek|Barva druhého řádku|Přizpůsobit vzhled|Vyplňte oba řádky textu.|Zkraťte text nebo jej zvětšete.|Nepodporované znaky. Vyberte jiný styl textu.|Zkraťte text pro tuto animaci.|Animaci nelze načíst. Zkuste to znovu.",
  hu: "Halmozott körvonalak|Osztott szöveg|Gördülő körvonalak|Emelkedő szó|Két osztott sor|Kétsoros felfedés|Közösségi profil|Szerkeszthető animált cím.|Animált ikon és szerkeszthető felhasználónév.|Ikonszín|Sávszélesség|Felfedési szélesség|Színátmenet kezdete|Színátmenet vége|Sávszín|Felfedési szín|Animáció betöltése…|Előnézet helyzete|Második sor|Második sor színe|Megjelenés testreszabása|Töltse ki mindkét szövegsort.|Rövidítse vagy nagyítsa a szöveget.|Nem támogatott karakterek. Válasszon másik szövegstílust.|Rövidítse a szöveget ehhez az animációhoz.|Az animáció nem tölthető be. Próbálja újra.",
  el: "Στοιβαγμένα περιγράμματα|Χωρισμένο κείμενο|Κυλιόμενα περιγράμματα|Ανερχόμενη λέξη|Δύο χωρισμένες γραμμές|Αποκάλυψη δύο γραμμών|Κοινωνικό προφίλ|Επεξεργάσιμος κινούμενος τίτλος.|Κινούμενο εικονίδιο και επεξεργάσιμο όνομα χρήστη.|Χρώμα εικονιδίου|Πλάτος μπάρας|Πλάτος αποκάλυψης|Αρχή διαβάθμισης|Τέλος διαβάθμισης|Χρώμα μπάρας|Χρώμα αποκάλυψης|Φόρτωση κίνησης…|Θέση προεπισκόπησης|Δεύτερη γραμμή|Χρώμα δεύτερης γραμμής|Προσαρμογή εμφάνισης|Συμπληρώστε και τις δύο γραμμές.|Συντομεύστε ή μεγαλώστε το κείμενο.|Μη υποστηριζόμενοι χαρακτήρες. Επιλέξτε άλλο στυλ κειμένου.|Συντομεύστε το κείμενο για αυτή την κίνηση.|Δεν ήταν δυνατή η φόρτωση της κίνησης. Δοκιμάστε ξανά.",
  he: "קווי מתאר מוערמים|טקסט מפוצל|קווי מתאר גוללים|מילה עולה|שתי שורות מפוצלות|חשיפת שתי שורות|פרופיל חברתי|כותרת מונפשת ניתנת לעריכה.|סמל מונפש ושם משתמש ניתן לעריכה.|צבע סמל|רוחב פס|רוחב חשיפה|תחילת מעבר צבע|סוף מעבר צבע|צבע פס|צבע חשיפה|טוען הנפשה…|מיקום תצוגה מקדימה|שורה שנייה|צבע שורה שנייה|התאמת המראה|יש למלא את שתי השורות.|יש לקצר את הטקסט או להגדיל אותו.|תווים לא נתמכים. יש לבחור סגנון טקסט אחר.|יש לקצר את הטקסט להנפשה זו.|לא ניתן לטעון את ההנפשה. נסו שוב.",
  id: "Garis bertumpuk|Teks terpisah|Garis bergulir|Kata naik|Dua baris terpisah|Kemunculan dua baris|Profil sosial|Judul animasi yang dapat diedit.|Ikon animasi dan nama pengguna yang dapat diedit.|Warna ikon|Lebar bilah|Lebar kemunculan|Awal gradien|Akhir gradien|Warna bilah|Warna kemunculan|Memuat animasi…|Posisi pratinjau|Baris kedua|Warna baris kedua|Sesuaikan tampilan|Isi kedua baris teks.|Persingkat teks atau perbesar ukurannya.|Karakter tidak didukung. Pilih gaya teks lain.|Persingkat teks untuk animasi ini.|Animasi tidak dapat dimuat. Coba lagi.",
  th: "เส้นขอบซ้อนกัน|ข้อความแยก|เส้นขอบเลื่อน|คำลอยขึ้น|สองบรรทัดแยก|เผยสองบรรทัด|โปรไฟล์โซเชียล|ชื่อเรื่องเคลื่อนไหวที่แก้ไขได้|ไอคอนเคลื่อนไหวและชื่อผู้ใช้ที่แก้ไขได้|สีไอคอน|ความกว้างแถบ|ความกว้างการเผย|จุดเริ่มไล่สี|จุดสิ้นสุดไล่สี|สีแถบ|สีการเผย|กำลังโหลดภาพเคลื่อนไหว…|ตำแหน่งตัวอย่าง|บรรทัดที่สอง|สีบรรทัดที่สอง|ปรับแต่งรูปลักษณ์|กรอกข้อความทั้งสองบรรทัด|ย่อข้อความหรือเพิ่มขนาด|มีอักขระที่ไม่รองรับ โปรดเลือกรูปแบบข้อความอื่น|ย่อข้อความสำหรับภาพเคลื่อนไหวนี้|โหลดภาพเคลื่อนไหวไม่ได้ โปรดลองอีกครั้ง",
};
const expandedRows: Record<string, string> = {
  it: "Cascata su tre righe|Scheda messaggio|Promemoria|Avviso sul telefono|Scheda di notifica modificabile.|Completa tutti i campi di testo.",
  es: "Cascada de tres líneas|Tarjeta de mensaje|Recordatorio|Alerta del teléfono|Tarjeta de notificación editable.|Completa todos los campos de texto.",
  fr: "Cascade sur trois lignes|Carte de message|Rappel|Alerte téléphonique|Carte de notification modifiable.|Remplissez tous les champs de texte.",
  de: "Dreizeilige Kaskade|Nachrichtenkarte|Erinnerung|Handyhinweis|Bearbeitbare Benachrichtigungskarte.|Alle Textfelder ausfüllen.",
  pt: "Cascata de três linhas|Cartão de mensagem|Lembrete|Alerta do telefone|Cartão de notificação editável.|Preencha todos os campos de texto.",
  nl: "Cascade van drie regels|Berichtkaart|Herinnering|Telefoonmelding|Bewerkbare meldingskaart.|Vul alle tekstvelden in.",
  pl: "Kaskada trzech wierszy|Karta wiadomości|Przypomnienie|Alert telefonu|Edytowalna karta powiadomienia.|Wypełnij wszystkie pola tekstowe.",
  ro: "Cascadă pe trei rânduri|Card de mesaj|Memento|Alertă pe telefon|Card de notificare editabil.|Completează toate câmpurile de text.",
  tr: "Üç satırlı kademeli başlık|Mesaj kartı|Hatırlatıcı|Telefon uyarısı|Düzenlenebilir bildirim kartı.|Tüm metin alanlarını doldurun.",
  uk: "Каскад у три рядки|Картка повідомлення|Нагадування|Сповіщення телефону|Редагована картка сповіщення.|Заповніть усі текстові поля.",
  ru: "Каскад в три строки|Карточка сообщения|Напоминание|Оповещение телефона|Редактируемая карточка уведомления.|Заполните все текстовые поля.",
  ar: "تتابع من ثلاثة أسطر|بطاقة رسالة|تذكير|تنبيه الهاتف|بطاقة إشعار قابلة للتعديل.|أكمل جميع حقول النص.",
  hi: "तीन पंक्तियों का क्रमिक शीर्षक|संदेश कार्ड|रिमाइंडर|फ़ोन अलर्ट|संपादन योग्य सूचना कार्ड।|सभी टेक्स्ट फ़ील्ड भरें।",
  ja: "3行カスケード|メッセージカード|リマインダー|スマートフォン通知|編集可能な通知カード。|すべてのテキスト欄を入力してください。",
  ko: "세 줄 순차 제목|메시지 카드|미리 알림|휴대폰 알림|편집 가능한 알림 카드입니다.|모든 텍스트 필드를 입력하세요.",
  zh: "三行层叠标题|消息卡片|提醒卡片|手机通知|可编辑的通知卡片。|请填写所有文本字段。",
  vi: "Tiêu đề ba dòng nối tiếp|Thẻ tin nhắn|Lời nhắc|Thông báo điện thoại|Thẻ thông báo có thể chỉnh sửa.|Điền vào mọi trường văn bản.",
  da: "Kaskade i tre linjer|Beskedkort|Påmindelse|Telefonvarsel|Redigerbart notifikationskort.|Udfyld alle tekstfelter.",
  sv: "Kaskad i tre rader|Meddelandekort|Påminnelse|Telefonavisering|Redigerbart aviseringskort.|Fyll i alla textfält.",
  no: "Kaskade over tre linjer|Meldingskort|Påminnelse|Telefonvarsel|Redigerbart varselkort.|Fyll ut alle tekstfeltene.",
  fi: "Kolmirivinen porrastus|Viestikortti|Muistutus|Puhelimen ilmoitus|Muokattava ilmoituskortti.|Täytä kaikki tekstikentät.",
  cs: "Třířádková kaskáda|Karta zprávy|Připomínka|Upozornění telefonu|Upravitelná karta oznámení.|Vyplňte všechna textová pole.",
  hu: "Háromsoros lépcsőzetes cím|Üzenetkártya|Emlékeztető|Telefonos értesítés|Szerkeszthető értesítési kártya.|Tölts ki minden szövegmezőt.",
  el: "Διαδοχικός τίτλος τριών γραμμών|Κάρτα μηνύματος|Υπενθύμιση|Ειδοποίηση τηλεφώνου|Επεξεργάσιμη κάρτα ειδοποίησης.|Συμπληρώστε όλα τα πεδία κειμένου.",
  he: "כותרת מדורגת בשלוש שורות|כרטיס הודעה|תזכורת|התראת טלפון|כרטיס התראה הניתן לעריכה.|יש למלא את כל שדות הטקסט.",
  id: "Judul tiga baris berurutan|Kartu pesan|Pengingat|Peringatan ponsel|Kartu notifikasi yang dapat diedit.|Isi semua kolom teks.",
  th: "ชื่อเรื่องสามบรรทัดแบบไล่ลำดับ|การ์ดข้อความ|การเตือนความจำ|การแจ้งเตือนบนโทรศัพท์|การ์ดแจ้งเตือนที่แก้ไขได้|กรอกข้อความให้ครบทุกช่อง",
};

const phoneLabels = ["Alert title", "Alert message", "Button label", "Right button", "Left button", "Top button", "Middle button", "Bottom button"];
const phoneFields: Record<string, string> = {
  it: "Titolo dell’avviso|Messaggio dell’avviso|Testo del pulsante|Pulsante destro|Pulsante sinistro|Pulsante superiore|Pulsante centrale|Pulsante inferiore",
  es: "Título del aviso|Mensaje del aviso|Texto del botón|Botón derecho|Botón izquierdo|Botón superior|Botón central|Botón inferior",
  fr: "Titre de l’alerte|Message de l’alerte|Libellé du bouton|Bouton de droite|Bouton de gauche|Bouton du haut|Bouton du milieu|Bouton du bas",
  de: "Titel der Meldung|Meldungstext|Beschriftung der Schaltfläche|Rechte Schaltfläche|Linke Schaltfläche|Obere Schaltfläche|Mittlere Schaltfläche|Untere Schaltfläche",
  pt: "Título do alerta|Mensagem do alerta|Texto do botão|Botão direito|Botão esquerdo|Botão superior|Botão central|Botão inferior",
  nl: "Meldingstitel|Meldingstekst|Knoptekst|Rechterknop|Linkerknop|Bovenste knop|Middelste knop|Onderste knop",
  pl: "Tytuł komunikatu|Treść komunikatu|Etykieta przycisku|Prawy przycisk|Lewy przycisk|Górny przycisk|Środkowy przycisk|Dolny przycisk",
  ro: "Titlul alertei|Mesajul alertei|Textul butonului|Butonul din dreapta|Butonul din stânga|Butonul de sus|Butonul din mijloc|Butonul de jos",
  tr: "Uyarı başlığı|Uyarı mesajı|Düğme metni|Sağ düğme|Sol düğme|Üst düğme|Orta düğme|Alt düğme",
  uk: "Заголовок сповіщення|Текст сповіщення|Напис на кнопці|Права кнопка|Ліва кнопка|Верхня кнопка|Середня кнопка|Нижня кнопка",
  ru: "Заголовок уведомления|Текст уведомления|Надпись на кнопке|Правая кнопка|Левая кнопка|Верхняя кнопка|Средняя кнопка|Нижняя кнопка",
  ar: "عنوان التنبيه|نص التنبيه|تسمية الزر|الزر الأيمن|الزر الأيسر|الزر العلوي|الزر الأوسط|الزر السفلي",
  hi: "अलर्ट का शीर्षक|अलर्ट संदेश|बटन का टेक्स्ट|दायाँ बटन|बायाँ बटन|ऊपर का बटन|बीच का बटन|नीचे का बटन",
  ja: "アラートのタイトル|アラートの本文|ボタンのラベル|右のボタン|左のボタン|上のボタン|中央のボタン|下のボタン",
  ko: "알림 제목|알림 메시지|버튼 문구|오른쪽 버튼|왼쪽 버튼|위쪽 버튼|가운데 버튼|아래쪽 버튼",
  zh: "提醒标题|提醒正文|按钮文字|右侧按钮|左侧按钮|顶部按钮|中间按钮|底部按钮",
  vi: "Tiêu đề thông báo|Nội dung thông báo|Nhãn nút|Nút bên phải|Nút bên trái|Nút trên|Nút giữa|Nút dưới",
  da: "Beskedens titel|Beskedtekst|Knaptekst|Højre knap|Venstre knap|Øverste knap|Midterste knap|Nederste knap",
  sv: "Aviseringens titel|Aviseringstext|Knapptext|Höger knapp|Vänster knapp|Översta knappen|Mittenknappen|Nedersta knappen",
  no: "Varseltittel|Varseltekst|Knappetekst|Høyre knapp|Venstre knapp|Øverste knapp|Midterste knapp|Nederste knapp",
  fi: "Ilmoituksen otsikko|Ilmoitusteksti|Painikkeen teksti|Oikea painike|Vasen painike|Ylin painike|Keskimmäinen painike|Alin painike",
  cs: "Nadpis upozornění|Text upozornění|Popisek tlačítka|Pravé tlačítko|Levé tlačítko|Horní tlačítko|Prostřední tlačítko|Dolní tlačítko",
  hu: "Értesítés címe|Értesítés szövege|Gombfelirat|Jobb oldali gomb|Bal oldali gomb|Felső gomb|Középső gomb|Alsó gomb",
  el: "Τίτλος ειδοποίησης|Κείμενο ειδοποίησης|Κείμενο κουμπιού|Δεξί κουμπί|Αριστερό κουμπί|Επάνω κουμπί|Μεσαίο κουμπί|Κάτω κουμπί",
  he: "כותרת ההתראה|תוכן ההתראה|תווית הכפתור|הכפתור הימני|הכפתור השמאלי|הכפתור העליון|הכפתור האמצעי|הכפתור התחתון",
  id: "Judul pemberitahuan|Isi pemberitahuan|Label tombol|Tombol kanan|Tombol kiri|Tombol atas|Tombol tengah|Tombol bawah",
  th: "ชื่อการแจ้งเตือน|ข้อความแจ้งเตือน|ข้อความบนปุ่ม|ปุ่มขวา|ปุ่มซ้าย|ปุ่มบน|ปุ่มกลาง|ปุ่มล่าง",
};

export function nativeGraphicsTranslations(
  code: string,
  catalog: Record<string, string>
) {
  const row = rows[code]?.split("|");
  if (!row) return {};
  if (row.length !== keys.length)
    throw Error("Incomplete native graphic locale: " + code);
  const result: Record<string, string> = Object.fromEntries(
    keys.map((key, i) => [key, row[i]])
  );
  const [cascade, message, reminder, phone, description, missing] =
    expandedRows[code].split("|");
  const fields = phoneFields[code].split("|");
  if (fields.length !== phoneLabels.length) throw Error("Incomplete alert labels: " + code);
  phoneLabels.forEach((key, i) => { result[key] = fields[i]; });
  result["Three-line cascade"] = cascade;
  result["Editable notification card."] = description;
  result["Complete every text field for this animation."] = missing;
  for (const t of NATIVE_GRAPHIC_TEMPLATES) {
    if (t.platform) {
      const profile = t.controls.some(
        c => c.type === "text" && c.textSlot === 1
      );
      const type =
        result["Social handle"] + (profile ? " · 2× " + catalog["Text"] : "");
      result[t.name] =
        `${t.platform} · ${type} · ${catalog[t.name.endsWith("left") ? "Left" : "Right"]}`;
    } else if (t.category === "notification") {
      const [name, n] = t.name.split(" · ");
      result[t.name] =
        (name === "Phone alert"
          ? phone
          : name === "Reminder card"
            ? reminder
            : message) +
        " · " +
        n;
    }
  }
  const aliases: Record<string, string> = {
    "Write both text lines for this animation.": "Complete both text lines.",
    "The text is too small for mobile delivery. Shorten the copy or increase the graphic size.":
      "Shorten the text or increase its size.",
    "The template font does not contain these characters. Choose a different text style.":
      "Unsupported characters. Choose another text style.",
    "The title is too long for this animation. Shorten the copy or choose a plain text style.":
      "Shorten the text for this animation.",
  };
  for (const [key, value] of Object.entries(aliases))
    result[key] = result[value];
  return result;
}
