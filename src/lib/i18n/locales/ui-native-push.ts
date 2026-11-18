const keys = [
  "Accelerated push left",
  "Accelerated push right",
  "Accelerated push up",
  "Accelerated push down",
  "Pushes one shot into the next with eased motion.",
];
const rows: Record<string, string> = {
  it: "Scorrimento accelerato a sinistra|Scorrimento accelerato a destra|Scorrimento accelerato verso l’alto|Scorrimento accelerato verso il basso|Fa scorrere una ripresa nella successiva con movimento graduale.",
  es: "Desplazamiento acelerado a la izquierda|Desplazamiento acelerado a la derecha|Desplazamiento acelerado hacia arriba|Desplazamiento acelerado hacia abajo|Desplaza una toma hacia la siguiente con movimiento suavizado.",
  fr: "Glissement accéléré à gauche|Glissement accéléré à droite|Glissement accéléré vers le haut|Glissement accéléré vers le bas|Fait glisser un plan vers le suivant avec un mouvement progressif.",
  de: "Beschleunigter Schub nach links|Beschleunigter Schub nach rechts|Beschleunigter Schub nach oben|Beschleunigter Schub nach unten|Schiebt eine Aufnahme mit sanfter Beschleunigung in die nächste.",
  pt: "Deslizamento acelerado à esquerda|Deslizamento acelerado à direita|Deslizamento acelerado para cima|Deslizamento acelerado para baixo|Desliza uma imagem para a seguinte com movimento suavizado.",
  nl: "Versnelde schuif naar links|Versnelde schuif naar rechts|Versnelde schuif omhoog|Versnelde schuif omlaag|Schuift het ene shot met vloeiende versnelling in het volgende.",
  pl: "Przyspieszone przesunięcie w lewo|Przyspieszone przesunięcie w prawo|Przyspieszone przesunięcie w górę|Przyspieszone przesunięcie w dół|Przesuwa jedno ujęcie w następne płynnym ruchem.",
  ro: "Glisare accelerată spre stânga|Glisare accelerată spre dreapta|Glisare accelerată în sus|Glisare accelerată în jos|Glisează un cadru în următorul cu mișcare lină.",
  tr: "Sola hızlanan kaydırma|Sağa hızlanan kaydırma|Yukarı hızlanan kaydırma|Aşağı hızlanan kaydırma|Bir çekimi yumuşak hareketle sonrakine kaydırır.",
  uk: "Прискорений зсув ліворуч|Прискорений зсув праворуч|Прискорений зсув угору|Прискорений зсув униз|Плавно зсуває один кадр у наступний.",
  ru: "Ускоренный сдвиг влево|Ускоренный сдвиг вправо|Ускоренный сдвиг вверх|Ускоренный сдвиг вниз|Плавно сдвигает один кадр в следующий.",
  ar: "دفع متسارع لليسار|دفع متسارع لليمين|دفع متسارع للأعلى|دفع متسارع للأسفل|يدفع لقطة إلى التالية بحركة متدرجة وسلسة.",
  hi: "बाईं ओर तेज़ होता स्लाइड|दाईं ओर तेज़ होता स्लाइड|ऊपर की ओर तेज़ होता स्लाइड|नीचे की ओर तेज़ होता स्लाइड|सहज गति से एक शॉट को अगले शॉट में खिसकाता है।",
  ja: "左へ加速スライド|右へ加速スライド|上へ加速スライド|下へ加速スライド|緩急のある動きで前のショットを次のショットへ押し出します。",
  ko: "왼쪽 가속 밀기|오른쪽 가속 밀기|위쪽 가속 밀기|아래쪽 가속 밀기|부드러운 가속으로 한 장면을 다음 장면으로 밀어냅니다.",
  zh: "向左加速推进|向右加速推进|向上加速推进|向下加速推进|通过缓动将一个镜头推进到下一个镜头。",
  vi: "Đẩy tăng tốc sang trái|Đẩy tăng tốc sang phải|Đẩy tăng tốc lên trên|Đẩy tăng tốc xuống dưới|Đẩy cảnh này sang cảnh tiếp theo bằng chuyển động mượt mà.",
  da: "Accelereret skub til venstre|Accelereret skub til højre|Accelereret skub opad|Accelereret skub nedad|Skubber ét klip ind i det næste med glidende bevægelse.",
  sv: "Accelererad förskjutning åt vänster|Accelererad förskjutning åt höger|Accelererad förskjutning uppåt|Accelererad förskjutning nedåt|Skjuter ett klipp in i nästa med mjuk rörelse.",
  no: "Akselerert skyv mot venstre|Akselerert skyv mot høyre|Akselerert skyv oppover|Akselerert skyv nedover|Skyver ett klipp inn i det neste med myk bevegelse.",
  fi: "Kiihtyvä työntö vasemmalle|Kiihtyvä työntö oikealle|Kiihtyvä työntö ylöspäin|Kiihtyvä työntö alaspäin|Työntää otoksen seuraavaan pehmeästi kiihtyvällä liikkeellä.",
  cs: "Zrychlený posun doleva|Zrychlený posun doprava|Zrychlený posun nahoru|Zrychlený posun dolů|Plynule posouvá jeden záběr do dalšího.",
  hu: "Gyorsuló áttolás balra|Gyorsuló áttolás jobbra|Gyorsuló áttolás felfelé|Gyorsuló áttolás lefelé|Finoman gyorsuló mozgással tolja át az egyik felvételt a következőbe.",
  el: "Επιταχυνόμενη ώθηση αριστερά|Επιταχυνόμενη ώθηση δεξιά|Επιταχυνόμενη ώθηση πάνω|Επιταχυνόμενη ώθηση κάτω|Ωθεί το ένα πλάνο στο επόμενο με ομαλή κίνηση.",
  he: "דחיפה מואצת שמאלה|דחיפה מואצת ימינה|דחיפה מואצת למעלה|דחיפה מואצת למטה|דוחף שוט אחד לתוך הבא בתנועה הדרגתית וחלקה.",
  id: "Dorongan dipercepat ke kiri|Dorongan dipercepat ke kanan|Dorongan dipercepat ke atas|Dorongan dipercepat ke bawah|Mendorong satu shot ke shot berikutnya dengan gerakan halus.",
  th: "เลื่อนเร่งไปทางซ้าย|เลื่อนเร่งไปทางขวา|เลื่อนเร่งขึ้นด้านบน|เลื่อนเร่งลงด้านล่าง|เลื่อนช็อตหนึ่งเข้าสู่ช็อตถัดไปด้วยการเคลื่อนไหวที่นุ่มนวล",
};
export const nativePushUi: Record<
  string,
  Record<string, string>
> = Object.fromEntries(
  Object.entries(rows).map(([code, row]) => [
    code,
    Object.fromEntries(row.split("|").map((value, i) => [keys[i], value])),
  ])
);
