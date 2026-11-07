import type { InterfaceLanguage } from "@contracts/interface-language";

const keys = [
  "Match a link or Library video",
  "Retry save",
  "Sign in again to save your changes.",
  "A newer workspace copy exists.",
  "The workspace is full. Download a backup before removing unused items.",
  "Your changes are kept here. Check your connection and retry saving.",
];
const rows: Partial<Record<InterfaceLanguage, string>> = {
  it: "Abbina un link o un video della Libreria|Riprova salvataggio|Accedi di nuovo per salvare le modifiche.|Esiste una copia più recente dello spazio di lavoro.|Lo spazio di lavoro è pieno. Scarica un backup prima di rimuovere gli elementi inutilizzati.|Le modifiche sono conservate qui. Controlla la connessione e riprova a salvare.",
  es: "Usar un enlace o vídeo de la Biblioteca|Reintentar guardado|Inicia sesión de nuevo para guardar los cambios.|Existe una copia más reciente del espacio de trabajo.|El espacio de trabajo está lleno. Descarga una copia de seguridad antes de eliminar elementos sin usar.|Tus cambios se conservan aquí. Comprueba la conexión y vuelve a guardar.",
  fr: "Utiliser un lien ou une vidéo de la Bibliothèque|Réessayer l’enregistrement|Reconnectez-vous pour enregistrer vos modifications.|Une copie plus récente de l’espace de travail existe.|L’espace de travail est plein. Téléchargez une sauvegarde avant de supprimer des éléments inutilisés.|Vos modifications sont conservées ici. Vérifiez votre connexion et réessayez d’enregistrer.",
  de: "Link oder Bibliotheksvideo als Vorlage|Speichern wiederholen|Melde dich erneut an, um deine Änderungen zu speichern.|Eine neuere Kopie des Arbeitsbereichs ist vorhanden.|Der Arbeitsbereich ist voll. Lade eine Sicherung herunter, bevor du ungenutzte Elemente entfernst.|Deine Änderungen bleiben hier erhalten. Prüfe deine Verbindung und speichere erneut.",
  pt: "Usar ligação ou vídeo da Biblioteca|Tentar guardar novamente|Inicie sessão novamente para guardar as alterações.|Existe uma cópia mais recente do espaço de trabalho.|O espaço de trabalho está cheio. Descarregue uma cópia de segurança antes de remover itens não utilizados.|As alterações são mantidas aqui. Verifique a ligação e tente guardar novamente.",
  nl: "Link of bibliotheekvideo als voorbeeld|Opnieuw opslaan|Meld je opnieuw aan om je wijzigingen op te slaan.|Er is een nieuwere kopie van de werkruimte.|De werkruimte is vol. Download een back-up voordat je ongebruikte items verwijdert.|Je wijzigingen blijven hier bewaard. Controleer je verbinding en probeer opnieuw op te slaan.",
  pl: "Użyj linku lub filmu z Biblioteki|Ponów zapis|Zaloguj się ponownie, aby zapisać zmiany.|Istnieje nowsza kopia obszaru roboczego.|Obszar roboczy jest pełny. Pobierz kopię zapasową przed usunięciem nieużywanych elementów.|Zmiany są zachowane tutaj. Sprawdź połączenie i ponów zapis.",
  ro: "Folosește un link sau un video din Bibliotecă|Reîncearcă salvarea|Autentifică-te din nou pentru a salva modificările.|Există o copie mai nouă a spațiului de lucru.|Spațiul de lucru este plin. Descarcă o copie de rezervă înainte de a elimina elementele neutilizate.|Modificările sunt păstrate aici. Verifică conexiunea și reîncearcă salvarea.",
  tr: "Bağlantı veya Kitaplık videosunu örnek al|Kaydetmeyi yeniden dene|Değişiklikleri kaydetmek için yeniden giriş yapın.|Çalışma alanının daha yeni bir kopyası var.|Çalışma alanı dolu. Kullanılmayan öğeleri kaldırmadan önce yedek indirin.|Değişiklikleriniz burada saklanıyor. Bağlantınızı kontrol edip yeniden kaydetmeyi deneyin.",
  uk: "Взяти за зразок посилання або відео з Бібліотеки|Повторити збереження|Увійдіть знову, щоб зберегти зміни.|Існує новіша копія робочого простору.|Робочий простір заповнений. Завантажте резервну копію перед видаленням невикористаних елементів.|Ваші зміни збережені тут. Перевірте з’єднання та повторіть збереження.",
  ru: "Взять за образец ссылку или видео из Библиотеки|Повторить сохранение|Войдите снова, чтобы сохранить изменения.|Существует более новая копия рабочего пространства.|Рабочее пространство заполнено. Скачайте резервную копию перед удалением неиспользуемых элементов.|Ваши изменения сохранены здесь. Проверьте соединение и повторите сохранение.",
  ar: "استخدام رابط أو فيديو من المكتبة كمرجع|إعادة الحفظ|سجّل الدخول مجددًا لحفظ تغييراتك.|توجد نسخة أحدث من مساحة العمل.|مساحة العمل ممتلئة. نزّل نسخة احتياطية قبل إزالة العناصر غير المستخدمة.|تغييراتك محفوظة هنا. تحقق من اتصالك وحاول الحفظ مجددًا.",
  hi: "लिंक या लाइब्रेरी वीडियो को संदर्भ बनाएँ|फिर सहेजें|बदलाव सहेजने के लिए फिर साइन इन करें।|वर्कस्पेस की नई कॉपी मौजूद है।|वर्कस्पेस भर गया है। अप्रयुक्त आइटम हटाने से पहले बैकअप डाउनलोड करें।|आपके बदलाव यहाँ सुरक्षित हैं। कनेक्शन जाँचें और फिर सहेजें।",
  ja: "リンクやライブラリの動画を参考にする|保存を再試行|変更を保存するには再度ログインしてください。|ワークスペースの新しいコピーがあります。|ワークスペースがいっぱいです。未使用の項目を削除する前にバックアップをダウンロードしてください。|変更はここに保持されています。接続を確認して、もう一度保存してください。",
  ko: "링크 또는 라이브러리 동영상을 참고하기|저장 다시 시도|변경 사항을 저장하려면 다시 로그인하세요.|더 최신의 작업 공간 사본이 있습니다.|작업 공간이 가득 찼습니다. 사용하지 않는 항목을 삭제하기 전에 백업을 다운로드하세요.|변경 사항이 여기에 보관되어 있습니다. 연결을 확인하고 다시 저장하세요.",
  zh: "参考链接或素材库视频|重试保存|请重新登录以保存更改。|存在更新的工作区副本。|工作区已满。删除未使用的项目之前，请下载备份。|更改保留在此处。请检查连接并重试保存。",
  vi: "Tham khảo liên kết hoặc video trong Thư viện|Thử lưu lại|Đăng nhập lại để lưu thay đổi.|Có bản sao không gian làm việc mới hơn.|Không gian làm việc đã đầy. Tải bản sao lưu trước khi xóa các mục không dùng.|Thay đổi được giữ ở đây. Kiểm tra kết nối và thử lưu lại.",
  da: "Brug link eller biblioteksvideo som reference|Prøv at gemme igen|Log ind igen for at gemme dine ændringer.|Der findes en nyere kopi af arbejdsområdet.|Arbejdsområdet er fuldt. Download en sikkerhedskopi, før du fjerner ubrugte elementer.|Dine ændringer bevares her. Kontrollér forbindelsen, og prøv at gemme igen.",
  sv: "Använd länk eller biblioteksvideo som referens|Försök spara igen|Logga in igen för att spara dina ändringar.|Det finns en nyare kopia av arbetsytan.|Arbetsytan är full. Hämta en säkerhetskopia innan du tar bort oanvända objekt.|Dina ändringar finns kvar här. Kontrollera anslutningen och försök spara igen.",
  no: "Bruk lenke eller bibliotekvideo som referanse|Prøv å lagre igjen|Logg inn igjen for å lagre endringene.|Det finnes en nyere kopi av arbeidsområdet.|Arbeidsområdet er fullt. Last ned en sikkerhetskopi før du fjerner ubrukte elementer.|Endringene dine beholdes her. Kontroller tilkoblingen og prøv å lagre igjen.",
  fi: "Käytä linkkiä tai Kirjaston videota mallina|Yritä tallentaa uudelleen|Kirjaudu uudelleen tallentaaksesi muutokset.|Työtilasta on olemassa uudempi kopio.|Työtila on täynnä. Lataa varmuuskopio ennen käyttämättömien kohteiden poistamista.|Muutoksesi säilyvät tässä. Tarkista yhteys ja yritä tallentaa uudelleen.",
  cs: "Použít odkaz nebo video z Knihovny jako vzor|Zkusit znovu uložit|Znovu se přihlaste pro uložení změn.|Existuje novější kopie pracovního prostoru.|Pracovní prostor je plný. Před odebráním nepoužívaných položek stáhněte zálohu.|Vaše změny jsou zde zachovány. Zkontrolujte připojení a zkuste znovu uložit.",
  hu: "Hivatkozás vagy könyvtári videó mintaként|Mentés újrapróbálása|Jelentkezz be újra a módosítások mentéséhez.|Létezik a munkaterületnek újabb másolata.|A munkaterület megtelt. A nem használt elemek eltávolítása előtt tölts le biztonsági másolatot.|A módosításaid itt megmaradnak. Ellenőrizd a kapcsolatot, és próbáld újra a mentést.",
  el: "Χρήση συνδέσμου ή βίντεο της Βιβλιοθήκης ως πρότυπο|Επανάληψη αποθήκευσης|Συνδεθείτε ξανά για να αποθηκεύσετε τις αλλαγές.|Υπάρχει νεότερο αντίγραφο του χώρου εργασίας.|Ο χώρος εργασίας είναι πλήρης. Κατεβάστε αντίγραφο ασφαλείας πριν αφαιρέσετε αχρησιμοποίητα στοιχεία.|Οι αλλαγές σας διατηρούνται εδώ. Ελέγξτε τη σύνδεση και δοκιμάστε ξανά την αποθήκευση.",
  he: "התאמה לקישור או לסרטון מהספרייה|ניסיון שמירה חוזר|יש להתחבר שוב כדי לשמור את השינויים.|קיים עותק חדש יותר של סביבת העבודה.|סביבת העבודה מלאה. יש להוריד גיבוי לפני הסרת פריטים שאינם בשימוש.|השינויים נשמרים כאן. יש לבדוק את החיבור ולנסות לשמור שוב.",
  id: "Gunakan tautan atau video Pustaka sebagai referensi|Coba simpan lagi|Masuk lagi untuk menyimpan perubahan.|Ada salinan ruang kerja yang lebih baru.|Ruang kerja penuh. Unduh cadangan sebelum menghapus item yang tidak digunakan.|Perubahan disimpan di sini. Periksa koneksi dan coba simpan lagi.",
  th: "ใช้ลิงก์หรือวิดีโอในคลังเป็นตัวอย่าง|ลองบันทึกอีกครั้ง|เข้าสู่ระบบอีกครั้งเพื่อบันทึกการเปลี่ยนแปลง|มีสำเนาพื้นที่ทำงานที่ใหม่กว่า|พื้นที่ทำงานเต็ม ดาวน์โหลดข้อมูลสำรองก่อนนำรายการที่ไม่ได้ใช้ออก|การเปลี่ยนแปลงของคุณยังอยู่ที่นี่ ตรวจสอบการเชื่อมต่อแล้วลองบันทึกอีกครั้ง",
};

export const editorNov7Ui = Object.fromEntries(
  Object.entries(rows).map(([locale, row]) => {
    const values = row.split("|");
    if (values.length !== keys.length)
      throw new Error(`Invalid editor copy for ${locale}`);
    return [
      locale,
      Object.fromEntries(keys.map((key, index) => [key, values[index]])),
    ];
  })
);
