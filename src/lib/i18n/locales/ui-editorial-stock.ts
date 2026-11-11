const key =
  "Supporting shots left out: {count}. Their source timing or availability could not be verified.";
const copy: Record<string, string> = {
  en: key,
  it: "Inquadrature di supporto omesse: {count}. Non è stato possibile verificarne i tempi nella fonte o la disponibilità.",
  es: "Tomas de apoyo omitidas: {count}. No se pudo verificar su tiempo en la fuente o disponibilidad.",
  fr: "Plans d’illustration omis : {count}. Leur minutage source ou leur disponibilité n’a pas pu être vérifié.",
  de: "Ausgelassene ergänzende Aufnahmen: {count}. Quellzeitpunkte oder Verfügbarkeit konnten nicht geprüft werden.",
  pt: "Planos de apoio omitidos: {count}. Não foi possível verificar os tempos na fonte ou a disponibilidade.",
  nl: "Overgeslagen ondersteunende beelden: {count}. De brontiming of beschikbaarheid kon niet worden geverifieerd.",
  pl: "Pominięte ujęcia uzupełniające: {count}. Nie można było zweryfikować ich czasu w źródle lub dostępności.",
  ro: "Cadre de susținere omise: {count}. Timpii din sursă sau disponibilitatea nu au putut fi verificate.",
  tr: "Atlanan destekleyici çekimler: {count}. Kaynak zamanlaması veya kullanılabilirliği doğrulanamadı.",
  uk: "Пропущено допоміжних кадрів: {count}. Не вдалося перевірити їхній час у джерелі або доступність.",
  ru: "Пропущено дополнительных кадров: {count}. Не удалось проверить их время в источнике или доступность.",
  ar: "اللقطات التوضيحية المستبعدة: {count}. تعذر التحقق من توقيتها في المصدر أو توافرها.",
  hi: "छोड़े गए सहायक शॉट: {count}। स्रोत में उनके समय या उपलब्धता की पुष्टि नहीं हो सकी।",
  ja: "省略した補足映像：{count}。ソース内のタイミングまたは利用可能性を確認できませんでした。",
  ko: "제외된 보조 장면: {count}. 소스 타이밍이나 사용 가능 여부를 확인할 수 없었습니다.",
  zh: "已省略辅助镜头：{count}。无法核实其源素材时间或可用性。",
  vi: "Cảnh bổ trợ bị bỏ qua: {count}. Không thể xác minh thời điểm trong nguồn hoặc khả năng sử dụng.",
  da: "Udeladte støtteklip: {count}. Kildetidspunkter eller tilgængelighed kunne ikke verificeres.",
  sv: "Utelämnade kompletterande klipp: {count}. Källtider eller tillgänglighet kunde inte verifieras.",
  no: "Utelatte støtteklipp: {count}. Kildetidspunkter eller tilgjengelighet kunne ikke verifiseres.",
  fi: "Pois jätettyjä tukikuvia: {count}. Lähteen ajoitusta tai saatavuutta ei voitu varmistaa.",
  cs: "Vynechané doplňující záběry: {count}. Časování ve zdroji nebo dostupnost se nepodařilo ověřit.",
  hu: "Kihagyott kiegészítő felvételek: {count}. A forrásidőzítés vagy az elérhetőség nem volt ellenőrizhető.",
  el: "Παραλειφθέντα συμπληρωματικά πλάνα: {count}. Δεν επαληθεύτηκαν ο χρόνος στην πηγή ή η διαθεσιμότητά τους.",
  he: "קטעי השלמה שהושמטו: {count}. לא ניתן היה לאמת את התזמון במקור או את זמינותם.",
  id: "Cuplikan pendukung yang dilewati: {count}. Waktu sumber atau ketersediaannya tidak dapat diverifikasi.",
  th: "ช็อตเสริมที่ข้าม: {count} ไม่สามารถยืนยันเวลาของต้นฉบับหรือความพร้อมใช้งานได้",
};
export const editorialStockUi = Object.fromEntries(
  Object.entries(copy).map(([language, value]) => [language, { [key]: value }])
);
