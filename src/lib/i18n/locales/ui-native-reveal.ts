const keys = [
  "Picture reveal from right",
  "Picture reveal from left",
  "Centered picture exchange",
  "Slides in a small picture, then expands it to fill the frame.",
  "Exchanges centered pictures with an intentional black surround.",
];
const rows: Record<string, string> = {
  it: "Comparsa immagine da destra|Comparsa immagine da sinistra|Scambio di immagini centrato|Fa scorrere una piccola immagine, poi la espande a tutto schermo.|Scambia immagini centrate con uno sfondo nero intenzionale.",
  es: "Revelado desde la derecha|Revelado desde la izquierda|Intercambio de imágenes centrado|Desliza una imagen pequeña y la amplía hasta llenar el encuadre.|Intercambia imágenes centradas con un fondo negro intencional.",
  fr: "Apparition par la droite|Apparition par la gauche|Échange d’images centré|Fait entrer une petite image, puis l’agrandit pour remplir le cadre.|Échange des images centrées sur un fond noir intentionnel.",
  de: "Bildeinblendung von rechts|Bildeinblendung von links|Zentrierter Bildwechsel|Schiebt ein kleines Bild hinein und vergrößert es auf das volle Bild.|Wechselt zentrierte Bilder mit bewusst schwarzer Umgebung.",
  pt: "Revelação pela direita|Revelação pela esquerda|Troca de imagens centralizada|Desliza uma imagem pequena e a amplia até preencher o quadro.|Troca imagens centralizadas com um fundo preto intencional.",
  nl: "Beeldonthulling van rechts|Beeldonthulling van links|Gecentreerde beeldwisseling|Schuift een klein beeld naar binnen en vergroot het tot het hele kader.|Wisselt gecentreerde beelden met een bewust zwarte omgeving.",
  pl: "Odsłonięcie obrazu z prawej|Odsłonięcie obrazu z lewej|Centralna zamiana obrazów|Wsuwa mały obraz, a następnie powiększa go na cały kadr.|Zamienia wyśrodkowane obrazy z celowym czarnym tłem.",
  ro: "Dezvăluire din dreapta|Dezvăluire din stânga|Schimb de imagini centrat|Glisează o imagine mică, apoi o mărește pentru a umple cadrul.|Schimbă imagini centrate cu un fundal negru intenționat.",
  tr: "Sağdan görüntü açılışı|Soldan görüntü açılışı|Ortalanmış görüntü değişimi|Küçük bir görüntüyü içeri kaydırır, ardından kareyi dolduracak şekilde büyütür.|Ortalanmış görüntüleri bilinçli bir siyah çevreyle değiştirir.",
  uk: "Поява зображення справа|Поява зображення зліва|Центрована зміна зображень|Всуває мале зображення, потім розгортає його на весь кадр.|Змінює центровані зображення з навмисним чорним тлом.",
  ru: "Появление изображения справа|Появление изображения слева|Смена изображений по центру|Вдвигает маленькое изображение, затем разворачивает его на весь кадр.|Меняет изображения по центру с намеренным чёрным фоном.",
  ar: "ظهور الصورة من اليمين|ظهور الصورة من اليسار|تبادل الصور في المنتصف|يُدخل صورة صغيرة ثم يوسعها لملء الإطار.|يبدّل الصور في المنتصف مع خلفية سوداء مقصودة.",
  hi: "दाईं ओर से चित्र प्रकट होना|बाईं ओर से चित्र प्रकट होना|केंद्रित चित्र बदलाव|छोटे चित्र को अंदर लाकर पूरे फ़्रेम में फैलाता है।|जानबूझकर रखी गई काली पृष्ठभूमि के साथ केंद्रित चित्र बदलता है।",
  ja: "右から画像を表示|左から画像を表示|中央で画像を入れ替え|小さな画像をスライドさせてから全画面に拡大します。|意図的な黒い余白を残して中央の画像を入れ替えます。",
  ko: "오른쪽에서 이미지 표시|왼쪽에서 이미지 표시|중앙 이미지 교체|작은 이미지를 밀어 넣은 뒤 화면 전체로 확대합니다.|의도적인 검은 배경과 함께 중앙 이미지를 교체합니다.",
  zh: "从右侧显现画面|从左侧显现画面|居中画面交换|滑入小画面，然后放大至填满整个画面。|交换居中的画面，并有意保留周围的黑色背景。",
  vi: "Hiện hình từ bên phải|Hiện hình từ bên trái|Đổi hình ở giữa|Trượt hình nhỏ vào rồi phóng lớn để lấp đầy khung hình.|Đổi hình ở giữa với nền đen có chủ đích xung quanh.",
  da: "Billedfremvisning fra højre|Billedfremvisning fra venstre|Centreret billedskift|Skyder et lille billede ind og udvider det til hele rammen.|Skifter centrerede billeder med en bevidst sort baggrund.",
  sv: "Bildvisning från höger|Bildvisning från vänster|Centrerat bildbyte|Skjuter in en liten bild och förstorar den till hela bildrutan.|Byter centrerade bilder med en avsiktlig svart bakgrund.",
  no: "Bildevisning fra høyre|Bildevisning fra venstre|Sentrert bildebytte|Skyver inn et lite bilde og utvider det til hele rammen.|Bytter sentrerte bilder med en bevisst svart bakgrunn.",
  fi: "Kuvan paljastus oikealta|Kuvan paljastus vasemmalta|Keskitetty kuvanvaihto|Liu’uttaa pienen kuvan sisään ja suurentaa sen koko ruudulle.|Vaihtaa keskitettyjä kuvia tarkoituksellisella mustalla taustalla.",
  cs: "Odhalení obrazu zprava|Odhalení obrazu zleva|Vystředěná výměna obrazů|Vsune malý obraz a poté jej zvětší na celý snímek.|Vyměňuje vystředěné obrazy se záměrným černým pozadím.",
  hu: "Kép megjelenése jobbról|Kép megjelenése balról|Középre igazított képcsere|Becsúsztat egy kis képet, majd teljes képernyőre nagyítja.|Középre igazított képeket cserél szándékos fekete háttérrel.",
  el: "Εμφάνιση εικόνας από δεξιά|Εμφάνιση εικόνας από αριστερά|Κεντραρισμένη εναλλαγή εικόνων|Εισάγει μια μικρή εικόνα και τη μεγεθύνει σε όλο το κάδρο.|Εναλλάσσει κεντραρισμένες εικόνες με σκόπιμο μαύρο φόντο.",
  he: "חשיפת תמונה מימין|חשיפת תמונה משמאל|החלפת תמונות במרכז|מחליק תמונה קטנה פנימה ואז מגדיל אותה למילוי הפריים.|מחליף תמונות ממורכזות עם רקע שחור מכוון.",
  id: "Kemunculan gambar dari kanan|Kemunculan gambar dari kiri|Pergantian gambar terpusat|Menggeser gambar kecil masuk, lalu memperbesarnya hingga memenuhi bingkai.|Mengganti gambar terpusat dengan latar hitam yang disengaja.",
  th: "เผยภาพจากด้านขวา|เผยภาพจากด้านซ้าย|สลับภาพตรงกลาง|เลื่อนภาพขนาดเล็กเข้ามาแล้วขยายให้เต็มเฟรม|สลับภาพตรงกลางโดยตั้งใจให้มีพื้นหลังสีดำล้อมรอบ",
};
export const nativeRevealUi: Record<
  string,
  Record<string, string>
> = Object.fromEntries(
  Object.entries(rows).map(([lang, row]) => [
    lang,
    Object.fromEntries(keys.map((key, index) => [key, row.split("|")[index]])),
  ])
);
