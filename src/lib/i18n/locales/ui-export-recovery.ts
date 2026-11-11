const keys = [
  "Refresh the editor to load the export engine.",
  "Your edit changed while saving. Try again.",
  "Your edit could not be saved. Retry before refreshing.",
  "Save and refresh",
];
const rows: Record<string, string[]> = {
  en: keys,
  it: [
    "Aggiorna l’editor per caricare il motore di esportazione.",
    "Il montaggio è cambiato durante il salvataggio. Riprova.",
    "Non è stato possibile salvare il montaggio. Riprova prima di aggiornare.",
    "Salva e aggiorna",
  ],
  es: [
    "Actualiza el editor para cargar el motor de exportación.",
    "La edición cambió al guardar. Inténtalo de nuevo.",
    "No se pudo guardar la edición. Reintenta antes de actualizar.",
    "Guardar y actualizar",
  ],
  fr: [
    "Actualisez l’éditeur pour charger le moteur d’exportation.",
    "Le montage a changé pendant l’enregistrement. Réessayez.",
    "Le montage n’a pas pu être enregistré. Réessayez avant d’actualiser.",
    "Enregistrer et actualiser",
  ],
  de: [
    "Lade den Editor neu, um die Export-Engine zu laden.",
    "Der Schnitt hat sich beim Speichern geändert. Versuche es erneut.",
    "Der Schnitt konnte nicht gespeichert werden. Versuche es vor dem Neuladen erneut.",
    "Speichern und neu laden",
  ],
  pt: [
    "Atualize o editor para carregar o mecanismo de exportação.",
    "A edição mudou durante o salvamento. Tente novamente.",
    "Não foi possível salvar a edição. Tente novamente antes de atualizar.",
    "Salvar e atualizar",
  ],
  nl: [
    "Vernieuw de editor om de exportmodule te laden.",
    "De montage is tijdens het opslaan gewijzigd. Probeer opnieuw.",
    "De montage kon niet worden opgeslagen. Probeer opnieuw voordat je vernieuwt.",
    "Opslaan en vernieuwen",
  ],
  pl: [
    "Odśwież edytor, aby wczytać moduł eksportu.",
    "Montaż zmienił się podczas zapisywania. Spróbuj ponownie.",
    "Nie udało się zapisać montażu. Spróbuj ponownie przed odświeżeniem.",
    "Zapisz i odśwież",
  ],
  ro: [
    "Reîncarcă editorul pentru a încărca motorul de export.",
    "Montajul s-a schimbat în timpul salvării. Încearcă din nou.",
    "Montajul nu a putut fi salvat. Încearcă din nou înainte de reîncărcare.",
    "Salvează și reîncarcă",
  ],
  tr: [
    "Dışa aktarma motorunu yüklemek için düzenleyiciyi yenileyin.",
    "Kurgu kaydetme sırasında değişti. Tekrar deneyin.",
    "Kurgu kaydedilemedi. Yenilemeden önce tekrar deneyin.",
    "Kaydet ve yenile",
  ],
  uk: [
    "Оновіть редактор, щоб завантажити модуль експорту.",
    "Монтаж змінився під час збереження. Спробуйте ще раз.",
    "Не вдалося зберегти монтаж. Повторіть спробу перед оновленням.",
    "Зберегти й оновити",
  ],
  ru: [
    "Обновите редактор, чтобы загрузить модуль экспорта.",
    "Монтаж изменился во время сохранения. Повторите попытку.",
    "Не удалось сохранить монтаж. Повторите попытку перед обновлением.",
    "Сохранить и обновить",
  ],
  ar: [
    "حدّث المحرر لتحميل محرك التصدير.",
    "تغير المونتاج أثناء الحفظ. حاول مجددًا.",
    "تعذر حفظ المونتاج. أعد المحاولة قبل التحديث.",
    "حفظ وتحديث",
  ],
  hi: [
    "एक्सपोर्ट इंजन लोड करने के लिए एडिटर रीफ़्रेश करें।",
    "सेव करते समय एडिट बदल गया। फिर कोशिश करें।",
    "एडिट सेव नहीं हो सका। रीफ़्रेश करने से पहले फिर कोशिश करें।",
    "सेव करें और रीफ़्रेश करें",
  ],
  ja: [
    "書き出しエンジンを読み込むには、エディターを再読み込みしてください。",
    "保存中に編集内容が変わりました。もう一度お試しください。",
    "編集内容を保存できませんでした。再読み込みの前にもう一度お試しください。",
    "保存して再読み込み",
  ],
  ko: [
    "내보내기 엔진을 불러오려면 편집기를 새로고침하세요.",
    "저장 중 편집 내용이 변경되었습니다. 다시 시도하세요.",
    "편집 내용을 저장하지 못했습니다. 새로고침 전에 다시 시도하세요.",
    "저장 후 새로고침",
  ],
  zh: [
    "刷新编辑器以加载导出引擎。",
    "保存期间编辑内容已更改，请重试。",
    "无法保存编辑内容，请在刷新前重试。",
    "保存并刷新",
  ],
  vi: [
    "Làm mới trình chỉnh sửa để tải bộ xuất video.",
    "Nội dung đã thay đổi khi lưu. Hãy thử lại.",
    "Không thể lưu bản chỉnh sửa. Hãy thử lại trước khi làm mới.",
    "Lưu và làm mới",
  ],
  da: [
    "Genindlæs editoren for at indlæse eksportmodulet.",
    "Redigeringen blev ændret under lagring. Prøv igen.",
    "Redigeringen kunne ikke gemmes. Prøv igen før genindlæsning.",
    "Gem og genindlæs",
  ],
  sv: [
    "Ladda om redigeraren för att läsa in exportmodulen.",
    "Redigeringen ändrades medan den sparades. Försök igen.",
    "Redigeringen kunde inte sparas. Försök igen innan du laddar om.",
    "Spara och ladda om",
  ],
  no: [
    "Last inn redigeringsverktøyet på nytt for å laste eksportmodulen.",
    "Redigeringen ble endret under lagring. Prøv igjen.",
    "Redigeringen kunne ikke lagres. Prøv igjen før du laster inn på nytt.",
    "Lagre og last inn på nytt",
  ],
  fi: [
    "Lataa editori uudelleen vientimoduulin lataamiseksi.",
    "Muokkaus muuttui tallennuksen aikana. Yritä uudelleen.",
    "Muokkausta ei voitu tallentaa. Yritä uudelleen ennen sivun päivittämistä.",
    "Tallenna ja päivitä",
  ],
  cs: [
    "Obnovte editor pro načtení exportního modulu.",
    "Střih se během ukládání změnil. Zkuste to znovu.",
    "Střih se nepodařilo uložit. Zkuste to znovu před obnovením.",
    "Uložit a obnovit",
  ],
  hu: [
    "Frissítsd a szerkesztőt az exportmodul betöltéséhez.",
    "A vágás mentés közben megváltozott. Próbáld újra.",
    "A vágást nem sikerült menteni. Frissítés előtt próbáld újra.",
    "Mentés és frissítés",
  ],
  el: [
    "Ανανεώστε τον επεξεργαστή για να φορτώσει η μηχανή εξαγωγής.",
    "Το μοντάζ άλλαξε κατά την αποθήκευση. Δοκιμάστε ξανά.",
    "Το μοντάζ δεν αποθηκεύτηκε. Δοκιμάστε ξανά πριν την ανανέωση.",
    "Αποθήκευση και ανανέωση",
  ],
  he: [
    "יש לרענן את העורך כדי לטעון את מנוע הייצוא.",
    "העריכה השתנתה במהלך השמירה. נסו שוב.",
    "לא ניתן לשמור את העריכה. נסו שוב לפני הרענון.",
    "שמירה ורענון",
  ],
  id: [
    "Muat ulang editor untuk memuat mesin ekspor.",
    "Edit berubah saat disimpan. Coba lagi.",
    "Edit tidak dapat disimpan. Coba lagi sebelum memuat ulang.",
    "Simpan dan muat ulang",
  ],
  th: [
    "รีเฟรชตัวแก้ไขเพื่อโหลดระบบส่งออก",
    "งานตัดต่อเปลี่ยนไประหว่างบันทึก โปรดลองอีกครั้ง",
    "บันทึกงานตัดต่อไม่ได้ โปรดลองอีกครั้งก่อนรีเฟรช",
    "บันทึกและรีเฟรช",
  ],
};
export const exportRecoveryUi = Object.fromEntries(
  Object.entries(rows).map(([language, values]) => [
    language,
    Object.fromEntries(keys.map((key, index) => [key, values[index]])),
  ])
);
