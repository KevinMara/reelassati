import type { InterfaceLanguage } from "@contracts/interface-language";

const keys = [
  "Audio type",
  "Load more",
  "Made using Openverse",
  "Not endorsed or certified by Openverse.",
];
const rows: Partial<Record<InterfaceLanguage, string>> = {
  it: "Tipo di audio|Carica altro|Realizzato con Openverse|Non approvato né certificato da Openverse.",
  fr: "Type d’audio|Afficher plus|Réalisé avec Openverse|Ni approuvé ni certifié par Openverse.",
  es: "Tipo de audio|Cargar más|Creado con Openverse|No aprobado ni certificado por Openverse.",
  de: "Audiotyp|Mehr laden|Erstellt mit Openverse|Nicht von Openverse unterstützt oder zertifiziert.",
  pt: "Tipo de áudio|Carregar mais|Criado com Openverse|Não aprovado nem certificado pelo Openverse.",
  nl: "Audiotype|Meer laden|Gemaakt met Openverse|Niet goedgekeurd of gecertificeerd door Openverse.",
  pl: "Typ dźwięku|Wczytaj więcej|Utworzono z Openverse|Bez zatwierdzenia ani certyfikacji Openverse.",
  ro: "Tip audio|Încarcă mai multe|Realizat cu Openverse|Nu este aprobat sau certificat de Openverse.",
  tr: "Ses türü|Daha fazla yükle|Openverse kullanılarak yapıldı|Openverse tarafından onaylanmamış veya sertifikalandırılmamıştır.",
  uk: "Тип аудіо|Завантажити ще|Створено за допомогою Openverse|Не схвалено й не сертифіковано Openverse.",
  ru: "Тип аудио|Загрузить ещё|Создано с помощью Openverse|Не одобрено и не сертифицировано Openverse.",
  ar: "نوع الصوت|تحميل المزيد|أُنشئ باستخدام Openverse|غير معتمد أو مُصدَّق من Openverse.",
  hi: "ऑडियो का प्रकार|और लोड करें|Openverse का उपयोग करके बनाया गया|Openverse द्वारा समर्थित या प्रमाणित नहीं है।",
  ja: "音声の種類|さらに読み込む|Openverseを使用|Openverseによる推奨・認証は受けていません。",
  ko: "오디오 유형|더 불러오기|Openverse 사용|Openverse의 승인 또는 인증을 받지 않았습니다.",
  zh: "音频类型|加载更多|使用 Openverse 制作|未经 Openverse 认可或认证。",
  vi: "Loại âm thanh|Tải thêm|Được tạo bằng Openverse|Không được Openverse xác nhận hoặc chứng nhận.",
  da: "Lydtype|Indlæs flere|Lavet med Openverse|Ikke godkendt eller certificeret af Openverse.",
  sv: "Ljudtyp|Läs in fler|Skapat med Openverse|Inte godkänt eller certifierat av Openverse.",
  no: "Lydtype|Last inn flere|Laget med Openverse|Ikke godkjent eller sertifisert av Openverse.",
  fi: "Äänen tyyppi|Lataa lisää|Tehty Openversen avulla|Ei Openversen hyväksymä tai sertifioima.",
  cs: "Typ zvuku|Načíst další|Vytvořeno pomocí Openverse|Není schváleno ani certifikováno Openverse.",
  hu: "Hang típusa|Továbbiak betöltése|Openverse használatával készült|Az Openverse nem hagyta jóvá és nem tanúsította.",
  el: "Τύπος ήχου|Φόρτωση περισσότερων|Δημιουργήθηκε με το Openverse|Δεν εγκρίνεται ούτε πιστοποιείται από το Openverse.",
  he: "סוג שמע|טעינת עוד|נוצר באמצעות Openverse|לא נתמך או מאושר על ידי Openverse.",
  id: "Jenis audio|Muat lainnya|Dibuat menggunakan Openverse|Tidak didukung atau disertifikasi oleh Openverse.",
  th: "ประเภทเสียง|โหลดเพิ่มเติม|สร้างโดยใช้ Openverse|ไม่ได้รับการรับรองหรือสนับสนุนจาก Openverse",
};
export const stockExpansionUi = Object.fromEntries(
  Object.entries(rows).map(([code, row]) => [
    code,
    Object.fromEntries(keys.map((key, i) => [key, row.split("|")[i]])),
  ])
) as Partial<Record<InterfaceLanguage, Record<string, string>>>;
