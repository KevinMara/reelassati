const keys = ["Font", "Loading font…", "Retry font"] as const;
const rows: Record<string, string[]> = {
  da: ["Skrifttype", "Indlæser skrifttype…", "Indlæs skrifttypen igen"],
  sv: ["Typsnitt", "Läser in typsnitt…", "Läs in typsnitt igen"],
  no: ["Skrifttype", "Laster inn skrifttype…", "Last inn skrifttype på nytt"],
  fi: ["Fontti", "Ladataan fonttia…", "Lataa fontti uudelleen"],
  cs: ["Písmo", "Načítání písma…", "Znovu načíst písmo"],
  hu: ["Betűtípus", "Betűtípus betöltése…", "Betűtípus újratöltése"],
  el: [
    "Γραμματοσειρά",
    "Φόρτωση γραμματοσειράς…",
    "Επαναφόρτωση γραμματοσειράς",
  ],
  it: ["Carattere", "Caricamento carattere…", "Riprova carattere"],
  es: ["Fuente", "Cargando fuente…", "Reintentar fuente"],
  fr: ["Police", "Chargement de la police…", "Réessayer la police"],
  de: ["Schriftart", "Schriftart wird geladen…", "Schriftart erneut laden"],
  pt: ["Fonte", "A carregar fonte…", "Tentar carregar a fonte novamente"],
  nl: ["Lettertype", "Lettertype laden…", "Lettertype opnieuw laden"],
  pl: ["Czcionka", "Ładowanie czcionki…", "Ponów ładowanie czcionki"],
  ro: ["Font", "Se încarcă fontul…", "Reîncarcă fontul"],
  ru: ["Шрифт", "Загрузка шрифта…", "Загрузить шрифт снова"],
  uk: ["Шрифт", "Завантаження шрифту…", "Завантажити шрифт знову"],
  ja: ["フォント", "フォントを読み込み中…", "フォントを再読み込み"],
  ko: ["글꼴", "글꼴 불러오는 중…", "글꼴 다시 불러오기"],
  zh: ["字体", "正在加载字体…", "重新加载字体"],
  ar: ["الخط", "جارٍ تحميل الخط…", "إعادة تحميل الخط"],
  hi: ["फ़ॉन्ट", "फ़ॉन्ट लोड हो रहा है…", "फ़ॉन्ट फिर लोड करें"],
  tr: ["Yazı tipi", "Yazı tipi yükleniyor…", "Yazı tipini yeniden yükle"],
  id: ["Font", "Memuat font…", "Muat ulang font"],
  vi: ["Phông chữ", "Đang tải phông chữ…", "Tải lại phông chữ"],
  he: ["גופן", "הגופן נטען…", "טעינת הגופן מחדש"],
  th: ["แบบอักษร", "กำลังโหลดแบบอักษร…", "โหลดแบบอักษรอีกครั้ง"],
};
export const editorFontUi: Record<
  string,
  Record<string, string>
> = Object.fromEntries(
  Object.entries(rows).map(([code, values]) => [
    code,
    Object.fromEntries(keys.map((key, i) => [key, values[i]])),
  ])
);
