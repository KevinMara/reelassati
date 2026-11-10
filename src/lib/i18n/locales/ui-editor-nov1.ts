import type { InterfaceLanguage } from "@contracts/interface-language";

const keys = [
  "Add media",
  "Upload files",
  "Import video link",
  "Video link",
  "Paste a video or social link",
  "Video saved to Library.",
  "Import",
  "Please sign in again to continue.",
  "You need more credits to continue.",
  "Your edit changed. Please try again with the current timeline.",
  "Reel couldn't read the audio. Please try again.",
  "Reel is unavailable right now. Please try again.",
  "This video isn't available right now. Try another link or upload the file.",
];
const rows: Partial<Record<InterfaceLanguage, string>> = {
  it: "Aggiungi media|Carica file|Importa link video|Link video|Incolla un link video o social|Video salvato nella Libreria.|Importa|Accedi di nuovo per continuare.|Servono più crediti per continuare.|Il montaggio è cambiato. Riprova con la timeline attuale.|Reel non è riuscito a leggere l'audio. Riprova.|Reel non è disponibile al momento. Riprova.|Questo video non è disponibile al momento. Prova un altro link o carica il file.",
  es: "Añadir medios|Subir archivos|Importar enlace de vídeo|Enlace de vídeo|Pega un enlace de vídeo o red social|Vídeo guardado en la Biblioteca.|Importar|Vuelve a iniciar sesión para continuar.|Necesitas más créditos para continuar.|La edición ha cambiado. Vuelve a intentarlo con la línea de tiempo actual.|Reel no pudo leer el audio. Vuelve a intentarlo.|Reel no está disponible ahora. Vuelve a intentarlo.|Este vídeo no está disponible ahora. Prueba otro enlace o sube el archivo.",
  fr: "Ajouter des médias|Importer des fichiers|Importer un lien vidéo|Lien vidéo|Collez un lien vidéo ou de réseau social|Vidéo enregistrée dans la Bibliothèque.|Importer|Reconnectez-vous pour continuer.|Il vous faut plus de crédits pour continuer.|Le montage a changé. Réessayez avec la timeline actuelle.|Reel n’a pas pu lire l’audio. Réessayez.|Reel est indisponible pour le moment. Réessayez.|Cette vidéo est indisponible pour le moment. Essayez un autre lien ou importez le fichier.",
  de: "Medien hinzufügen|Dateien hochladen|Videolink importieren|Videolink|Video- oder Social-Media-Link einfügen|Video in der Bibliothek gespeichert.|Importieren|Melde dich erneut an, um fortzufahren.|Du brauchst mehr Credits, um fortzufahren.|Der Schnitt wurde geändert. Versuche es mit der aktuellen Zeitleiste erneut.|Reel konnte das Audio nicht lesen. Versuche es erneut.|Reel ist gerade nicht verfügbar. Versuche es erneut.|Dieses Video ist gerade nicht verfügbar. Versuche einen anderen Link oder lade die Datei hoch.",
  pt: "Adicionar multimédia|Carregar ficheiros|Importar ligação de vídeo|Ligação de vídeo|Cole uma ligação de vídeo ou rede social|Vídeo guardado na Biblioteca.|Importar|Inicie sessão novamente para continuar.|Precisa de mais créditos para continuar.|A edição mudou. Tente novamente com a linha temporal atual.|O Reel não conseguiu ler o áudio. Tente novamente.|O Reel está indisponível neste momento. Tente novamente.|Este vídeo está indisponível neste momento. Tente outra ligação ou carregue o ficheiro.",
  nl: "Media toevoegen|Bestanden uploaden|Videolink importeren|Videolink|Plak een video- of socialmedialink|Video opgeslagen in de bibliotheek.|Importeren|Meld je opnieuw aan om door te gaan.|Je hebt meer credits nodig om door te gaan.|Je montage is veranderd. Probeer het opnieuw met de huidige tijdlijn.|Reel kon de audio niet lezen. Probeer het opnieuw.|Reel is momenteel niet beschikbaar. Probeer het opnieuw.|Deze video is momenteel niet beschikbaar. Probeer een andere link of upload het bestand.",
  pl: "Dodaj multimedia|Prześlij pliki|Importuj link do filmu|Link do filmu|Wklej link do filmu lub posta|Film zapisano w Bibliotece.|Importuj|Zaloguj się ponownie, aby kontynuować.|Potrzebujesz więcej kredytów, aby kontynuować.|Montaż się zmienił. Spróbuj ponownie z aktualną osią czasu.|Reel nie mógł odczytać dźwięku. Spróbuj ponownie.|Reel jest teraz niedostępny. Spróbuj ponownie.|Ten film jest teraz niedostępny. Spróbuj innego linku lub prześlij plik.",
  ro: "Adaugă media|Încarcă fișiere|Importă link video|Link video|Lipește un link video sau social|Videoclip salvat în Bibliotecă.|Importă|Autentifică-te din nou pentru a continua.|Ai nevoie de mai multe credite pentru a continua.|Montajul s-a schimbat. Încearcă din nou cu cronologia actuală.|Reel nu a putut citi sunetul. Încearcă din nou.|Reel nu este disponibil momentan. Încearcă din nou.|Acest videoclip nu este disponibil momentan. Încearcă alt link sau încarcă fișierul.",
  tr: "Medya ekle|Dosya yükle|Video bağlantısı içe aktar|Video bağlantısı|Video veya sosyal medya bağlantısı yapıştır|Video Kitaplığa kaydedildi.|İçe aktar|Devam etmek için yeniden giriş yapın.|Devam etmek için daha fazla kredi gerekiyor.|Düzenleme değişti. Güncel zaman çizelgesiyle yeniden deneyin.|Reel sesi okuyamadı. Yeniden deneyin.|Reel şu anda kullanılamıyor. Yeniden deneyin.|Bu video şu anda kullanılamıyor. Başka bir bağlantı deneyin veya dosyayı yükleyin.",
  uk: "Додати медіа|Завантажити файли|Імпортувати відеопосилання|Посилання на відео|Вставте посилання на відео або допис|Відео збережено в Бібліотеці.|Імпортувати|Увійдіть знову, щоб продовжити.|Для продовження потрібно більше кредитів.|Монтаж змінився. Спробуйте знову з поточною шкалою часу.|Reel не вдалося прочитати аудіо. Спробуйте знову.|Reel зараз недоступний. Спробуйте знову.|Це відео зараз недоступне. Спробуйте інше посилання або завантажте файл.",
  ru: "Добавить медиа|Загрузить файлы|Импортировать видеоссылку|Ссылка на видео|Вставьте ссылку на видео или публикацию|Видео сохранено в Библиотеке.|Импортировать|Войдите снова, чтобы продолжить.|Для продолжения нужно больше кредитов.|Монтаж изменился. Повторите с текущей временной шкалой.|Reel не удалось прочитать аудио. Попробуйте снова.|Reel сейчас недоступен. Попробуйте снова.|Это видео сейчас недоступно. Попробуйте другую ссылку или загрузите файл.",
  ar: "إضافة وسائط|رفع ملفات|استيراد رابط فيديو|رابط الفيديو|ألصق رابط فيديو أو منشور اجتماعي|تم حفظ الفيديو في المكتبة.|استيراد|سجّل الدخول مجددًا للمتابعة.|تحتاج إلى مزيد من الأرصدة للمتابعة.|تغير المونتاج. حاول مجددًا باستخدام المخطط الزمني الحالي.|تعذّر على Reel قراءة الصوت. حاول مجددًا.|Reel غير متاح الآن. حاول مجددًا.|هذا الفيديو غير متاح الآن. جرّب رابطًا آخر أو ارفع الملف.",
  hi: "मीडिया जोड़ें|फ़ाइलें अपलोड करें|वीडियो लिंक आयात करें|वीडियो लिंक|वीडियो या सोशल लिंक पेस्ट करें|वीडियो लाइब्रेरी में सहेजा गया।|आयात करें|जारी रखने के लिए फिर से साइन इन करें।|जारी रखने के लिए और क्रेडिट चाहिए।|संपादन बदल गया है। वर्तमान टाइमलाइन के साथ फिर कोशिश करें।|Reel ऑडियो नहीं पढ़ सका। फिर कोशिश करें।|Reel अभी उपलब्ध नहीं है। फिर कोशिश करें।|यह वीडियो अभी उपलब्ध नहीं है। दूसरा लिंक आज़माएँ या फ़ाइल अपलोड करें।",
  ja: "メディアを追加|ファイルをアップロード|動画リンクをインポート|動画リンク|動画やSNSのリンクを貼り付け|ライブラリに動画を保存しました。|インポート|続けるには再度ログインしてください。|続けるにはクレジットが足りません。|編集が変更されました。現在のタイムラインでもう一度お試しください。|Reelが音声を読み取れませんでした。もう一度お試しください。|現在Reelを利用できません。もう一度お試しください。|現在この動画を利用できません。別のリンクを試すか、ファイルをアップロードしてください。",
  ko: "미디어 추가|파일 업로드|동영상 링크 가져오기|동영상 링크|동영상 또는 소셜 링크 붙여넣기|동영상이 라이브러리에 저장되었습니다.|가져오기|계속하려면 다시 로그인하세요.|계속하려면 크레딧이 더 필요합니다.|편집이 변경되었습니다. 현재 타임라인으로 다시 시도하세요.|Reel이 오디오를 읽지 못했습니다. 다시 시도하세요.|지금은 Reel을 사용할 수 없습니다. 다시 시도하세요.|지금은 이 동영상을 사용할 수 없습니다. 다른 링크를 시도하거나 파일을 업로드하세요.",
  zh: "添加媒体|上传文件|导入视频链接|视频链接|粘贴视频或社交媒体链接|视频已保存到素材库。|导入|请重新登录以继续。|需要更多积分才能继续。|剪辑已更改。请使用当前时间线重试。|Reel 无法读取音频，请重试。|Reel 暂时不可用，请重试。|此视频暂时不可用。请尝试其他链接或上传文件。",
  vi: "Thêm phương tiện|Tải tệp lên|Nhập liên kết video|Liên kết video|Dán liên kết video hoặc mạng xã hội|Đã lưu video vào Thư viện.|Nhập|Đăng nhập lại để tiếp tục.|Bạn cần thêm tín dụng để tiếp tục.|Bản dựng đã thay đổi. Hãy thử lại với dòng thời gian hiện tại.|Reel không đọc được âm thanh. Hãy thử lại.|Reel hiện không khả dụng. Hãy thử lại.|Video này hiện không khả dụng. Thử liên kết khác hoặc tải tệp lên.",
  da: "Tilføj medier|Upload filer|Importer videolink|Videolink|Indsæt et video- eller socialt link|Video gemt i Biblioteket.|Importer|Log ind igen for at fortsætte.|Du skal bruge flere credits for at fortsætte.|Din redigering er ændret. Prøv igen med den aktuelle tidslinje.|Reel kunne ikke læse lyden. Prøv igen.|Reel er ikke tilgængelig lige nu. Prøv igen.|Videoen er ikke tilgængelig lige nu. Prøv et andet link, eller upload filen.",
  sv: "Lägg till media|Ladda upp filer|Importera videolänk|Videolänk|Klistra in en video- eller social länk|Videon sparades i Biblioteket.|Importera|Logga in igen för att fortsätta.|Du behöver fler krediter för att fortsätta.|Redigeringen har ändrats. Försök igen med den aktuella tidslinjen.|Reel kunde inte läsa ljudet. Försök igen.|Reel är inte tillgängligt just nu. Försök igen.|Videon är inte tillgänglig just nu. Prova en annan länk eller ladda upp filen.",
  no: "Legg til medier|Last opp filer|Importer videolenke|Videolenke|Lim inn en video- eller sosial lenke|Video lagret i Biblioteket.|Importer|Logg inn igjen for å fortsette.|Du trenger flere kreditter for å fortsette.|Redigeringen er endret. Prøv igjen med den gjeldende tidslinjen.|Reel kunne ikke lese lyden. Prøv igjen.|Reel er ikke tilgjengelig akkurat nå. Prøv igjen.|Videoen er ikke tilgjengelig akkurat nå. Prøv en annen lenke eller last opp filen.",
  fi: "Lisää mediaa|Lataa tiedostoja|Tuo videolinkki|Videolinkki|Liitä video- tai somelinkki|Video tallennettu kirjastoon.|Tuo|Kirjaudu uudelleen jatkaaksesi.|Tarvitset lisää krediittejä jatkaaksesi.|Muokkaus muuttui. Yritä uudelleen nykyisellä aikajanalla.|Reel ei voinut lukea ääntä. Yritä uudelleen.|Reel ei ole juuri nyt käytettävissä. Yritä uudelleen.|Video ei ole juuri nyt käytettävissä. Kokeile toista linkkiä tai lataa tiedosto.",
  cs: "Přidat média|Nahrát soubory|Importovat odkaz na video|Odkaz na video|Vložte odkaz na video nebo příspěvek|Video uloženo do Knihovny.|Importovat|Chcete-li pokračovat, znovu se přihlaste.|K pokračování potřebujete více kreditů.|Střih se změnil. Zkuste to znovu s aktuální časovou osou.|Reel nemohl přečíst zvuk. Zkuste to znovu.|Reel je nyní nedostupný. Zkuste to znovu.|Toto video je nyní nedostupné. Zkuste jiný odkaz nebo nahrajte soubor.",
  hu: "Média hozzáadása|Fájlok feltöltése|Videóhivatkozás importálása|Videóhivatkozás|Illessz be videó- vagy közösségi hivatkozást|Videó mentve a Könyvtárba.|Importálás|A folytatáshoz jelentkezz be újra.|A folytatáshoz több kredit szükséges.|A vágás megváltozott. Próbáld újra az aktuális idővonallal.|A Reel nem tudta olvasni a hangot. Próbáld újra.|A Reel most nem érhető el. Próbáld újra.|Ez a videó most nem érhető el. Próbálj másik hivatkozást, vagy töltsd fel a fájlt.",
  el: "Προσθήκη πολυμέσων|Μεταφόρτωση αρχείων|Εισαγωγή συνδέσμου βίντεο|Σύνδεσμος βίντεο|Επικολλήστε σύνδεσμο βίντεο ή ανάρτησης|Το βίντεο αποθηκεύτηκε στη Βιβλιοθήκη.|Εισαγωγή|Συνδεθείτε ξανά για να συνεχίσετε.|Χρειάζεστε περισσότερες μονάδες για να συνεχίσετε.|Το μοντάζ άλλαξε. Δοκιμάστε ξανά με το τρέχον χρονολόγιο.|Το Reel δεν μπόρεσε να διαβάσει τον ήχο. Δοκιμάστε ξανά.|Το Reel δεν είναι διαθέσιμο αυτή τη στιγμή. Δοκιμάστε ξανά.|Το βίντεο δεν είναι διαθέσιμο αυτή τη στιγμή. Δοκιμάστε άλλο σύνδεσμο ή μεταφορτώστε το αρχείο.",
  he: "הוספת מדיה|העלאת קבצים|ייבוא קישור לסרטון|קישור לסרטון|הדביקו קישור לסרטון או לרשת חברתית|הסרטון נשמר בספרייה.|ייבוא|התחברו שוב כדי להמשיך.|דרושים קרדיטים נוספים כדי להמשיך.|העריכה השתנתה. נסו שוב עם ציר הזמן הנוכחי.|Reel לא הצליח לקרוא את השמע. נסו שוב.|Reel אינו זמין כרגע. נסו שוב.|הסרטון אינו זמין כרגע. נסו קישור אחר או העלו את הקובץ.",
  id: "Tambah media|Unggah berkas|Impor tautan video|Tautan video|Tempel tautan video atau media sosial|Video disimpan ke Pustaka.|Impor|Masuk kembali untuk melanjutkan.|Anda memerlukan lebih banyak kredit untuk melanjutkan.|Suntingan berubah. Coba lagi dengan linimasa saat ini.|Reel tidak dapat membaca audio. Coba lagi.|Reel tidak tersedia saat ini. Coba lagi.|Video ini tidak tersedia saat ini. Coba tautan lain atau unggah berkasnya.",
  th: "เพิ่มสื่อ|อัปโหลดไฟล์|นำเข้าลิงก์วิดีโอ|ลิงก์วิดีโอ|วางลิงก์วิดีโอหรือโซเชียล|บันทึกวิดีโอในคลังแล้ว|นำเข้า|เข้าสู่ระบบอีกครั้งเพื่อดำเนินการต่อ|ต้องมีเครดิตเพิ่มเพื่อดำเนินการต่อ|การตัดต่อเปลี่ยนไปแล้ว ลองอีกครั้งด้วยไทม์ไลน์ปัจจุบัน|Reel อ่านเสียงไม่ได้ โปรดลองอีกครั้ง|Reel ไม่พร้อมใช้งานในขณะนี้ โปรดลองอีกครั้ง|วิดีโอนี้ไม่พร้อมใช้งานในขณะนี้ ลองลิงก์อื่นหรืออัปโหลดไฟล์",
};
const planFailureText: Partial<Record<InterfaceLanguage, string>> = {
  it: "Reel non è riuscito a completare questo montaggio. Riprova.",
  es: "Reel no pudo terminar esta edición. Vuelve a intentarlo.",
  fr: "Reel n’a pas pu terminer ce montage. Réessayez.",
  de: "Reel konnte diesen Schnitt nicht fertigstellen. Versuche es erneut.",
  pt: "O Reel não conseguiu concluir esta edição. Tente novamente.",
  nl: "Reel kon deze montage niet afmaken. Probeer het opnieuw.",
  pl: "Reel nie mógł ukończyć tego montażu. Spróbuj ponownie.",
  ro: "Reel nu a putut finaliza acest montaj. Încearcă din nou.",
  tr: "Reel bu düzenlemeyi tamamlayamadı. Lütfen tekrar deneyin.",
  uk: "Reel не вдалося завершити цей монтаж. Спробуйте ще раз.",
  ru: "Reel не удалось завершить этот монтаж. Попробуйте ещё раз.",
  ar: "لم يتمكن Reel من إكمال هذا المونتاج. يُرجى المحاولة مجددًا.",
  hi: "Reel यह संपादन पूरा नहीं कर सका। कृपया फिर से प्रयास करें।",
  ja: "Reelはこの編集を完了できませんでした。もう一度お試しください。",
  ko: "Reel이 이 편집을 완료하지 못했습니다. 다시 시도해 주세요.",
  zh: "Reel 未能完成此次剪辑。请重试。",
  vi: "Reel không thể hoàn thành bản dựng này. Vui lòng thử lại.",
  da: "Reel kunne ikke færdiggøre denne redigering. Prøv igen.",
  sv: "Reel kunde inte slutföra den här redigeringen. Försök igen.",
  no: "Reel kunne ikke fullføre denne redigeringen. Prøv igjen.",
  fi: "Reel ei voinut viimeistellä tätä muokkausta. Yritä uudelleen.",
  cs: "Reel nemohl dokončit tento střih. Zkuste to znovu.",
  hu: "A Reel nem tudta befejezni ezt a vágást. Próbáld újra.",
  el: "Το Reel δεν μπόρεσε να ολοκληρώσει αυτό το μοντάζ. Δοκιμάστε ξανά.",
  he: "Reel לא הצליח להשלים את העריכה הזו. נסו שוב.",
  id: "Reel tidak dapat menyelesaikan suntingan ini. Coba lagi.",
  th: "Reel ตัดต่อครั้งนี้ไม่สำเร็จ โปรดลองอีกครั้ง",
};
export const editorNov1Ui = Object.fromEntries(
  Object.entries(rows).map(([code, row]) => {
    const values = row.split("|");
    if (values.length !== keys.length)
      throw new Error(`Invalid editor copy for ${code}`);
    const copy: Record<string, string> = Object.fromEntries(
      keys.map((key, index) => [key, values[index]])
    );
    copy["Reel couldn't finish this edit. Please try again."] =
      planFailureText[code as InterfaceLanguage] ??
      "Reel couldn't finish this edit. Please try again.";
    return [code, copy] as const;
  })
) as Record<InterfaceLanguage, Record<string, string>>;
