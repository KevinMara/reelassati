const raw =
  "pacing|framing|color|motion|transitions|captions|graphics|sound|measured|balanced|brisk|variable|unknown|wide|close|mixed|natural|warm|cool|monochrome|vivid|muted|still|subtle|dynamic|cuts|dissolves|none|phrase|word-emphasis|minimal|explanatory|kinetic|speech-led|music-led|ambient".split(
    "|"
  );
const english =
  "Pacing|Framing|Color|Motion|Transitions|Captions|Graphics|Sound|Measured|Balanced|Brisk|Variable|Unknown|Wide|Close|Mixed|Natural|Warm|Cool|Monochrome|Vivid|Muted color|Still|Subtle|Dynamic|Cuts|Dissolves|None|Phrase|Word emphasis|Minimal|Explanatory|Kinetic|Speech led|Music led|Ambient".split(
    "|"
  );
export const editingTraitLabel = (key: string) =>
  english[raw.indexOf(key)] ?? key;
const rows: Record<string, string> = {
  it: "Ritmo|Inquadratura|Colore|Movimento|Transizioni|Sottotitoli|Grafica|Suono|Misurato|Equilibrato|Rapido|Variabile|Non determinato|Ampia|Ravvicinata|Misto|Naturale|Caldo|Freddo|Monocromatico|Vivace|Colori tenui|Statico|Discreto|Dinamico|Stacchi|Dissolvenze|Nessuno|Per frase|Enfasi sulle parole|Minimale|Esplicativo|Cinetico|Guidato dalla voce|Guidato dalla musica|Ambientale",
  es: "Ritmo|Encuadre|Color|Movimiento|Transiciones|Subtítulos|Gráficos|Sonido|Pausado|Equilibrado|Ágil|Variable|Desconocido|Amplio|Cercano|Mixto|Natural|Cálido|Frío|Monocromo|Vívido|Colores suaves|Estático|Sutil|Dinámico|Cortes|Fundidos|Ninguno|Por frase|Énfasis en palabras|Minimalista|Explicativo|Cinético|Guiado por la voz|Guiado por la música|Ambiental",
  fr: "Rythme|Cadrage|Couleur|Mouvement|Transitions|Sous-titres|Graphismes|Son|Posé|Équilibré|Vif|Variable|Inconnu|Large|Rapproché|Mixte|Naturel|Chaud|Froid|Monochrome|Vif|Couleurs atténuées|Fixe|Subtil|Dynamique|Coupes|Fondus|Aucun|Par phrase|Mots accentués|Minimal|Explicatif|Cinétique|Guidé par la parole|Guidé par la musique|Ambiant",
  de: "Tempo|Bildausschnitt|Farbe|Bewegung|Übergänge|Untertitel|Grafiken|Ton|Ruhig|Ausgewogen|Zügig|Variabel|Unbekannt|Weit|Nah|Gemischt|Natürlich|Warm|Kühl|Monochrom|Lebhaft|Gedämpfte Farben|Statisch|Dezent|Dynamisch|Schnitte|Überblendungen|Keine|Satzweise|Wortbetonung|Minimal|Erklärend|Kinetisch|Sprachgeführt|Musikgeführt|Atmosphärisch",
  pt: "Ritmo|Enquadramento|Cor|Movimento|Transições|Legendas|Gráficos|Som|Pausado|Equilibrado|Rápido|Variável|Desconhecido|Amplo|Próximo|Misto|Natural|Quente|Frio|Monocromático|Vivo|Cores suaves|Estático|Subtil|Dinâmico|Cortes|Dissolvências|Nenhum|Por frase|Ênfase nas palavras|Minimalista|Explicativo|Cinético|Guiado pela fala|Guiado pela música|Ambiente",
  nl: "Tempo|Kadrering|Kleur|Beweging|Overgangen|Ondertitels|Grafische elementen|Geluid|Rustig|Evenwichtig|Vlot|Variabel|Onbekend|Wijd|Dichtbij|Gemengd|Natuurlijk|Warm|Koel|Monochroom|Levendig|Gedempte kleuren|Stil|Subtiel|Dynamisch|Cuts|Overvloeiers|Geen|Per zin|Woordaccenten|Minimaal|Verklarend|Kinetisch|Spraakgestuurd|Muziekgestuurd|Sfeervol",
  pl: "Tempo|Kadrowanie|Kolor|Ruch|Przejścia|Napisy|Grafika|Dźwięk|Spokojne|Zrównoważone|Szybkie|Zmienne|Nieznane|Szerokie|Zbliżenie|Mieszane|Naturalny|Ciepły|Chłodny|Monochromatyczny|Żywy|Stonowane kolory|Statyczny|Subtelny|Dynamiczny|Cięcia|Przenikanie|Brak|Zdaniami|Akcentowanie słów|Minimalistyczny|Objaśniający|Kinetyczny|Prowadzony mową|Prowadzony muzyką|Otoczenie",
  tr: "Tempo|Kadraj|Renk|Hareket|Geçişler|Altyazılar|Grafikler|Ses|Sakin|Dengeli|Hızlı|Değişken|Bilinmiyor|Geniş|Yakın|Karışık|Doğal|Sıcak|Soğuk|Tek renk|Canlı|Soluk renkler|Sabit|Hafif|Dinamik|Kesme|Çözünme|Yok|Cümle|Kelime vurgusu|Minimal|Açıklayıcı|Kinetik|Konuşma odaklı|Müzik odaklı|Ortam",
  ro: "Ritm|Încadrare|Culoare|Mișcare|Tranziții|Subtitrări|Grafică|Sunet|Calm|Echilibrat|Rapid|Variabil|Necunoscut|Larg|Apropiat|Mixt|Natural|Cald|Rece|Monocrom|Viu|Culori estompate|Static|Subtil|Dinamic|Tăieturi|Dizolvări|Niciunul|Pe frază|Accent pe cuvinte|Minimal|Explicativ|Cinetic|Condus de vorbire|Condus de muzică|Ambiental",
  da: "Tempo|Beskæring|Farve|Bevægelse|Overgange|Undertekster|Grafik|Lyd|Roligt|Balanceret|Hurtigt|Variabelt|Ukendt|Bredt|Nært|Blandet|Naturlig|Varm|Kølig|Monokrom|Livlig|Dæmpede farver|Stille|Diskret|Dynamisk|Klip|Overtoninger|Ingen|Sætningsvis|Ordbetoning|Minimal|Forklarende|Kinetisk|Talestyret|Musikstyret|Omgivelseslyd",
  cs: "Tempo|Kompozice|Barva|Pohyb|Přechody|Titulky|Grafika|Zvuk|Klidné|Vyvážené|Svižné|Proměnlivé|Neznámé|Široké|Detailní|Smíšené|Přirozená|Teplá|Chladná|Monochromatická|Živá|Tlumené barvy|Statický|Jemný|Dynamický|Střihy|Prolínačky|Žádné|Po větách|Důraz na slova|Minimální|Vysvětlující|Kinetický|Vedený řečí|Vedený hudbou|Prostředí",
  id: "Tempo|Pembingkaian|Warna|Gerakan|Transisi|Takarir|Grafis|Suara|Tenang|Seimbang|Cepat|Bervariasi|Tidak diketahui|Lebar|Dekat|Campuran|Alami|Hangat|Dingin|Monokrom|Cerah|Warna redup|Diam|Halus|Dinamis|Potongan|Larut|Tidak ada|Per frasa|Penekanan kata|Minimal|Penjelas|Kinetik|Berbasis ucapan|Berbasis musik|Suasana",
  sv: "Tempo|Bildutsnitt|Färg|Rörelse|Övergångar|Undertexter|Grafik|Ljud|Lugnt|Balanserat|Snabbt|Varierat|Okänt|Brett|Nära|Blandat|Naturlig|Varm|Kall|Monokrom|Livfull|Dämpade färger|Stilla|Diskret|Dynamisk|Klipp|Övertoningar|Ingen|Frasvis|Ordbetoning|Minimal|Förklarande|Kinetisk|Talstyrt|Musikstyrt|Omgivningsljud",
  hu: "Tempó|Képkivágás|Szín|Mozgás|Átmenetek|Feliratok|Grafika|Hang|Nyugodt|Kiegyensúlyozott|Gyors|Változó|Ismeretlen|Tág|Közeli|Vegyes|Természetes|Meleg|Hideg|Monokróm|Élénk|Visszafogott színek|Álló|Finom|Dinamikus|Vágások|Áttűnések|Nincs|Mondatonként|Szóhangsúly|Minimális|Magyarázó|Kinetikus|Beszédvezérelt|Zenevezérelt|Környezeti",
  no: "Tempo|Utsnitt|Farge|Bevegelse|Overganger|Undertekster|Grafikk|Lyd|Rolig|Balansert|Raskt|Variabelt|Ukjent|Bredt|Nært|Blandet|Naturlig|Varm|Kjølig|Monokrom|Livlig|Dempede farger|Stille|Diskret|Dynamisk|Klipp|Overtoninger|Ingen|Frasevis|Ordbetoning|Minimal|Forklarende|Kinetisk|Talestyrt|Musikkstyrt|Omgivelseslyd",
  vi: "Nhịp độ|Khung hình|Màu sắc|Chuyển động|Chuyển cảnh|Phụ đề|Đồ họa|Âm thanh|Chậm rãi|Cân bằng|Nhanh|Thay đổi|Chưa rõ|Rộng|Cận cảnh|Kết hợp|Tự nhiên|Ấm|Lạnh|Đơn sắc|Rực rỡ|Màu dịu|Tĩnh|Tinh tế|Năng động|Cắt|Hòa tan|Không có|Theo cụm từ|Nhấn từ|Tối giản|Giải thích|Động|Dẫn bằng lời nói|Dẫn bằng âm nhạc|Môi trường",
  el: "Ρυθμός|Κάδρο|Χρώμα|Κίνηση|Μεταβάσεις|Υπότιτλοι|Γραφικά|Ήχος|Ήρεμος|Ισορροπημένος|Γρήγορος|Μεταβλητός|Άγνωστο|Ευρύ|Κοντινό|Μικτό|Φυσικό|Θερμό|Ψυχρό|Μονόχρωμο|Ζωντανό|Απαλά χρώματα|Στατικό|Διακριτικό|Δυναμικό|Κοψίματα|Διαλύσεις|Κανένα|Ανά φράση|Έμφαση λέξεων|Λιτό|Επεξηγηματικό|Κινητικό|Με βάση την ομιλία|Με βάση τη μουσική|Περιβάλλοντος",
  ja: "テンポ|構図|色|動き|トランジション|字幕|グラフィック|音|落ち着いた|バランス型|速い|変化型|不明|広角|寄り|混合|自然|暖色|寒色|モノクロ|鮮やか|控えめな色|静止|控えめ|ダイナミック|カット|ディゾルブ|なし|フレーズ単位|単語強調|最小限|説明的|キネティック|会話主導|音楽主導|環境音",
  fi: "Tempo|Rajaus|Väri|Liike|Siirtymät|Tekstitykset|Grafiikka|Ääni|Rauhallinen|Tasapainoinen|Nopea|Vaihteleva|Tuntematon|Laaja|Lähi|Sekoitettu|Luonnollinen|Lämmin|Viileä|Yksivärinen|Eloisa|Hillityt värit|Paikallaan|Hienovarainen|Dynaaminen|Leikkaukset|Häivytykset|Ei mitään|Lauseittain|Sanapainotus|Minimaalinen|Selittävä|Kineettinen|Puhevetoinen|Musiikkivetoinen|Ympäristöääni",
  zh: "节奏|构图|色彩|运动|转场|字幕|图形|声音|舒缓|均衡|轻快|变化|未知|广角|近景|混合|自然|暖色|冷色|单色|鲜明|柔和色彩|静止|轻微|动态|切换|叠化|无|按短语|关键词强调|简约|说明性|动感|人声主导|音乐主导|环境音",
  uk: "Темп|Кадрування|Колір|Рух|Переходи|Субтитри|Графіка|Звук|Спокійний|Збалансований|Швидкий|Змінний|Невідомо|Широкий|Крупний|Змішаний|Природний|Теплий|Холодний|Монохромний|Яскравий|Приглушені кольори|Статичний|Делікатний|Динамічний|Склейки|Напливи|Немає|Фразами|Акцент на словах|Мінімальний|Пояснювальний|Кінетичний|На основі мовлення|На основі музики|Навколишній",
  ko: "템포|구도|색상|움직임|전환|자막|그래픽|소리|차분한|균형 잡힌|빠른|변화하는|알 수 없음|와이드|클로즈업|혼합|자연스러운|따뜻한|차가운|단색|선명한|차분한 색감|정적인|은은한|역동적인|컷|디졸브|없음|구절 단위|단어 강조|미니멀|설명형|키네틱|대사 중심|음악 중심|환경음",
  th: "จังหวะ|การจัดกรอบ|สี|การเคลื่อนไหว|การเปลี่ยนฉาก|คำบรรยาย|กราฟิก|เสียง|เนิบช้า|สมดุล|รวดเร็ว|แปรผัน|ไม่ทราบ|กว้าง|ใกล้|ผสม|ธรรมชาติ|โทนอุ่น|โทนเย็น|สีเดียว|สดใส|สีหม่น|นิ่ง|นุ่มนวล|มีพลัง|ตัดตรง|ละลายภาพ|ไม่มี|เป็นวลี|เน้นคำ|เรียบง่าย|อธิบาย|เคลื่อนไหว|เน้นคำพูด|เน้นดนตรี|บรรยากาศ",
  ru: "Темп|Кадрирование|Цвет|Движение|Переходы|Субтитры|Графика|Звук|Спокойный|Сбалансированный|Быстрый|Переменный|Неизвестно|Широкий|Крупный|Смешанный|Естественный|Тёплый|Холодный|Монохромный|Яркий|Приглушённые цвета|Статичный|Деликатный|Динамичный|Склейки|Наплывы|Нет|По фразам|Выделение слов|Минимальный|Поясняющий|Кинетический|На основе речи|На основе музыки|Окружение",
  ar: "الإيقاع|التأطير|اللون|الحركة|الانتقالات|الترجمة|الرسومات|الصوت|متأنٍ|متوازن|سريع|متغير|غير معروف|واسع|قريب|مختلط|طبيعي|دافئ|بارد|أحادي اللون|زاهٍ|ألوان هادئة|ثابت|خفيف|ديناميكي|قطع|تلاشي|بلا|بالعبارة|إبراز الكلمات|بسيط|توضيحي|حركي|تقوده الكلمات|تقوده الموسيقى|محيطي",
  hi: "गति|फ़्रेमिंग|रंग|हलचल|ट्रांज़िशन|कैप्शन|ग्राफ़िक्स|ध्वनि|धीमी|संतुलित|तेज़|बदलती|अज्ञात|चौड़ा|क़रीब|मिश्रित|प्राकृतिक|गर्म|ठंडा|एकरंगी|चटख|हल्के रंग|स्थिर|हल्का|गतिशील|कट|डिज़ॉल्व|कोई नहीं|वाक्यांश|शब्द पर ज़ोर|न्यूनतम|व्याख्यात्मक|काइनेटिक|बोल-आधारित|संगीत-आधारित|परिवेश",
  he: "קצב|מסגור|צבע|תנועה|מעברים|כתוביות|גרפיקה|צליל|מתון|מאוזן|מהיר|משתנה|לא ידוע|רחב|קרוב|מעורב|טבעי|חם|קר|מונוכרום|חי|צבעים מעודנים|סטטי|עדין|דינמי|חיתוכים|התמזגויות|ללא|לפי משפט|הדגשת מילים|מינימלי|מסביר|קינטי|מונחה דיבור|מונחה מוזיקה|אווירה",
};
export const editingTraitUi: Record<
  string,
  Record<string, string>
> = Object.fromEntries(
  Object.entries(rows).map(([language, row]) => {
    const values = row.split("|");
    if (values.length !== english.length)
      throw new Error(`Incomplete editing style catalog: ${language}`);
    return [
      language,
      Object.fromEntries(english.map((key, i) => [key, values[i]])),
    ];
  })
);
