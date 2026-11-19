const keys = [
  "Eased wipe up",
  "Eased wipe down",
  "Reveals the next shot while both pictures stay fixed.",
];
const rows: Record<string, string> = {
  it: "Tendina morbida verso l’alto|Tendina morbida verso il basso|Rivela la ripresa successiva mantenendo ferme entrambe le immagini.",
  es: "Barrido suave hacia arriba|Barrido suave hacia abajo|Revela el siguiente plano manteniendo ambas imágenes fijas.",
  fr: "Balayage progressif vers le haut|Balayage progressif vers le bas|Révèle le plan suivant en gardant les deux images fixes.",
  de: "Sanfte Wischblende nach oben|Sanfte Wischblende nach unten|Zeigt die nächste Aufnahme, während beide Bilder unverändert stehen bleiben.",
  pt: "Transição suave para cima|Transição suave para baixo|Revela o plano seguinte mantendo ambas as imagens fixas.",
  nl: "Vloeiende veeg omhoog|Vloeiende veeg omlaag|Onthult het volgende beeld terwijl beide beelden op hun plek blijven.",
  pl: "Łagodne odsłonięcie w górę|Łagodne odsłonięcie w dół|Odsłania następne ujęcie bez przesuwania obu obrazów.",
  ro: "Tranziție lină în sus|Tranziție lină în jos|Dezvăluie cadrul următor păstrând ambele imagini fixe.",
  tr: "Yukarı yumuşak silme|Aşağı yumuşak silme|Her iki görüntü sabit kalırken sonraki çekimi açığa çıkarır.",
  uk: "Плавне відкриття вгору|Плавне відкриття вниз|Відкриває наступний кадр, залишаючи обидва зображення нерухомими.",
  ru: "Плавное открытие вверх|Плавное открытие вниз|Открывает следующий кадр, оставляя оба изображения неподвижными.",
  ar: "مسح سلس إلى الأعلى|مسح سلس إلى الأسفل|يكشف اللقطة التالية مع إبقاء الصورتين ثابتتين.",
  hi: "ऊपर की ओर सहज वाइप|नीचे की ओर सहज वाइप|दोनों चित्रों को स्थिर रखते हुए अगला शॉट दिखाता है।",
  ja: "上方向への滑らかなワイプ|下方向への滑らかなワイプ|両方の映像を動かさずに次のショットを表示します。",
  ko: "부드러운 위쪽 와이프|부드러운 아래쪽 와이프|두 영상의 위치를 유지하면서 다음 장면을 드러냅니다.",
  zh: "向上缓动擦除|向下缓动擦除|保持两个画面位置不变，逐步显露下一个镜头。",
  vi: "Gạt mượt lên trên|Gạt mượt xuống dưới|Hé lộ cảnh tiếp theo trong khi giữ nguyên vị trí của cả hai hình ảnh.",
  da: "Blød overgang opad|Blød overgang nedad|Afslører næste klip, mens begge billeder bliver på deres plads.",
  sv: "Mjuk svepning uppåt|Mjuk svepning nedåt|Visar nästa klipp medan båda bilderna ligger kvar på samma plats.",
  no: "Myk overgang oppover|Myk overgang nedover|Avdekker neste klipp mens begge bildene holder seg på plass.",
  fi: "Pehmeä pyyhkäisy ylös|Pehmeä pyyhkäisy alas|Paljastaa seuraavan otoksen molempien kuvien pysyessä paikoillaan.",
  cs: "Plynulé odkrytí nahoru|Plynulé odkrytí dolů|Odkrývá další záběr, zatímco oba obrazy zůstávají na místě.",
  hu: "Lágy áttűnés felfelé|Lágy áttűnés lefelé|A következő képet úgy fedi fel, hogy mindkét kép a helyén marad.",
  el: "Ομαλή σάρωση προς τα πάνω|Ομαλή σάρωση προς τα κάτω|Αποκαλύπτει το επόμενο πλάνο διατηρώντας και τις δύο εικόνες σταθερές.",
  he: "ניגוב חלק כלפי מעלה|ניגוב חלק כלפי מטה|חושף את השוט הבא כששתי התמונות נשארות במקומן.",
  id: "Usap halus ke atas|Usap halus ke bawah|Menampilkan klip berikutnya dengan kedua gambar tetap di tempatnya.",
  th: "กวาดขึ้นอย่างนุ่มนวล|กวาดลงอย่างนุ่มนวล|เผยช็อตถัดไปโดยคงตำแหน่งของภาพทั้งสองไว้",
};
export const nativeMotionUi: Record<
  string,
  Record<string, string>
> = Object.fromEntries(
  Object.entries(rows).map(([code, row]) => [
    code,
    Object.fromEntries(row.split("|").map((value, i) => [keys[i], value])),
  ])
);
