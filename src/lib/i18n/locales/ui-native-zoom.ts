const keys = [
  "Measured zoom dissolve",
  "Mirrored grid dissolve",
  "Gently zooms and blends both shots.",
  "Pulls back into mirrored tiles, then returns to full frame.",
] as const;
const rows: Record<string, string[]> = {
  it: [
    "Dissolvenza con zoom misurato",
    "Dissolvenza a griglia specchiata",
    "Sfuma entrambe le riprese con uno zoom delicato.",
    "Arretra in riquadri specchiati, poi torna a pieno fotogramma.",
  ],
  es: [
    "Fundido con zoom suave",
    "Fundido en mosaico reflejado",
    "Acerca y mezcla suavemente ambas tomas.",
    "Se aleja en mosaicos reflejados y vuelve al encuadre completo.",
  ],
  fr: [
    "Fondu avec zoom mesuré",
    "Fondu en grille miroir",
    "Zoome doucement et mélange les deux plans.",
    "Recule en mosaïque miroir, puis revient en plein cadre.",
  ],
  de: [
    "Sanfte Zoomüberblendung",
    "Gespiegelte Rasterüberblendung",
    "Zoomt sanft und überblendet beide Aufnahmen.",
    "Zieht sich in gespiegelte Kacheln zurück und kehrt zum Vollbild zurück.",
  ],
  pt: [
    "Dissolução com zoom suave",
    "Dissolução em grelha espelhada",
    "Aplica zoom suave e mistura as duas imagens.",
    "Recua em mosaicos espelhados e regressa ao quadro completo.",
  ],
  nl: [
    "Geleidelijke zoomovergang",
    "Gespiegelde rasterovergang",
    "Zoomt zachtjes en mengt beide opnamen.",
    "Trekt terug in gespiegelde tegels en keert terug naar het volledige beeld.",
  ],
  pl: [
    "Łagodne przenikanie z zoomem",
    "Przenikanie lustrzanej siatki",
    "Delikatnie przybliża i łączy oba ujęcia.",
    "Oddala obraz w lustrzane kafelki, po czym wraca do pełnego kadru.",
  ],
  ro: [
    "Dizolvare cu zoom delicat",
    "Dizolvare cu grilă oglindită",
    "Mărește ușor și îmbină ambele cadre.",
    "Se retrage în dale oglindite, apoi revine la cadrul complet.",
  ],
  tr: [
    "Yumuşak yakınlaştırmalı geçiş",
    "Aynalı ızgara geçişi",
    "Hafifçe yakınlaştırıp iki çekimi harmanlar.",
    "Aynalı döşemelere çekilir, sonra tam kareye döner.",
  ],
  uk: [
    "Плавне розчинення з масштабуванням",
    "Розчинення дзеркальної сітки",
    "Плавно наближає та змішує обидва кадри.",
    "Віддаляє в дзеркальні плитки, потім повертає повний кадр.",
  ],
  ru: [
    "Плавное растворение с масштабированием",
    "Растворение зеркальной сетки",
    "Плавно приближает и смешивает оба кадра.",
    "Отдаляет в зеркальные плитки, затем возвращает полный кадр.",
  ],
  ar: [
    "تلاشي بتقريب هادئ",
    "تلاشي شبكة معكوسة",
    "يقرّب ويمزج اللقطتين بلطف.",
    "يتراجع إلى مربعات معكوسة ثم يعود إلى الإطار الكامل.",
  ],
  hi: [
    "हल्के ज़ूम के साथ मिश्रण",
    "दर्पण ग्रिड मिश्रण",
    "दोनों शॉट को हल्के ज़ूम के साथ मिलाता है।",
    "दर्पण टाइलों में पीछे जाता है, फिर पूरे फ़्रेम पर लौटता है।",
  ],
  ja: [
    "穏やかなズームディゾルブ",
    "ミラーグリッドディゾルブ",
    "両方のショットを穏やかにズームしてブレンドします。",
    "鏡像タイルへ引いてから全画面に戻ります。",
  ],
  ko: [
    "부드러운 줌 디졸브",
    "거울 격자 디졸브",
    "두 샷을 부드럽게 확대하고 혼합합니다.",
    "거울 타일로 축소한 뒤 전체 프레임으로 돌아갑니다.",
  ],
  zh: [
    "柔和缩放叠化",
    "镜像网格叠化",
    "柔和地缩放并混合两个镜头。",
    "缩退为镜像拼贴，再回到完整画面。",
  ],
  vi: [
    "Hòa tan với thu phóng nhẹ",
    "Hòa tan lưới phản chiếu",
    "Thu phóng nhẹ và hòa trộn hai cảnh.",
    "Thu nhỏ thành các ô phản chiếu rồi trở lại toàn khung hình.",
  ],
  da: [
    "Blød zoomovergang",
    "Spejlet gitterovergang",
    "Zoomer blidt og blander begge klip.",
    "Trækker tilbage i spejlede felter og vender tilbage til fuldt billede.",
  ],
  sv: [
    "Mjuk zoomövergång",
    "Speglad rutnätsövergång",
    "Zoomar mjukt och blandar båda klippen.",
    "Drar tillbaka till speglade rutor och återgår till hela bilden.",
  ],
  no: [
    "Myk zoomovergang",
    "Speilet rutenettovergang",
    "Zoomer mykt og blander begge klippene.",
    "Trekker tilbake til speilede ruter og går tilbake til fullt bilde.",
  ],
  fi: [
    "Pehmeä zoomhäivytys",
    "Peilatun ruudukon häivytys",
    "Zoomaa ja yhdistää molemmat otokset pehmeästi.",
    "Vetäytyy peilatuiksi ruuduiksi ja palaa koko kuvaan.",
  ],
  cs: [
    "Jemné prolnutí se zoomem",
    "Prolnutí zrcadlové mřížky",
    "Jemně přibližuje a prolíná oba záběry.",
    "Oddálí obraz do zrcadlových dlaždic a vrátí se na celý snímek.",
  ],
  hu: [
    "Finom zoomos áttűnés",
    "Tükrözött rácsos áttűnés",
    "Finoman nagyítja és összeolvasztja a két felvételt.",
    "Tükrözött csempékbe távolodik, majd visszatér a teljes képre.",
  ],
  el: [
    "Ήπια διάλυση με ζουμ",
    "Διάλυση κατοπτρικού πλέγματος",
    "Μεγεθύνει απαλά και συνδυάζει τα δύο πλάνα.",
    "Απομακρύνεται σε κατοπτρικά πλακίδια και επιστρέφει στο πλήρες καρέ.",
  ],
  he: [
    "מעבר התמזגות עם זום עדין",
    "מעבר התמזגות ברשת מראות",
    "מגדיל בעדינות ומשלב את שני השוטים.",
    "מתרחק לאריחים משתקפים ואז חוזר לפריים מלא.",
  ],
  id: [
    "Dissolve dengan zoom lembut",
    "Dissolve kisi cermin",
    "Memperbesar dan memadukan kedua shot dengan lembut.",
    "Mundur menjadi ubin cermin, lalu kembali ke bingkai penuh.",
  ],
  th: [
    "ซ้อนภาพพร้อมซูมอย่างนุ่มนวล",
    "ซ้อนภาพตารางสะท้อน",
    "ซูมและผสมทั้งสองช็อตอย่างนุ่มนวล",
    "ถอยเป็นช่องภาพสะท้อน แล้วกลับมาเต็มเฟรม",
  ],
};
export const nativeZoomUi: Record<
  string,
  Record<string, string>
> = Object.fromEntries(
  Object.entries(rows).map(([code, values]) => [
    code,
    Object.fromEntries(keys.map((key, i) => [key, values[i]])),
  ])
);
