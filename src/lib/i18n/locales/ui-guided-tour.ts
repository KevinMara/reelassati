const keys = [
  "Upload footage once and reuse it in your edits. Drag files onto the page, or choose Upload media.",
  "Search by name, narrow by media type, then use folders and source filters to find uploads, generations or stock.",
  "Describe the topic and audience here. Choose the platform, tone and length below to shape your draft.",
  "Your script appears here. Edit its hook, body and ending, then save it or continue into media creation.",
  "Build it through a conversation",
  "Choose Interview me when you want help finding the story. Answer short follow-up questions to turn your experience into a script.",
  "Upload a video, choose one from Library, or import a direct video link. Add a goal below when you want a focused review.",
  "Review, then improve",
  "Start the review at the displayed credit cost. The result links feedback to moments in your video; Optimize carries it into an editable project.",
  "Create a reusable style",
  "Choose New style to define an editing language, caption treatment, graphic or color look. You can edit every setting.",
  "Keep your visual language",
  "Your saved styles live here. Open one to adjust it, then use it in an edit. Saving a style does not start an AI request.",
  "Choose where it goes",
  "Choose a platform and connected account, then select the finished video you want to publish.",
  "Write the post and choose its timing. Save a draft or review the finished publication before sending it.",
] as const;

const rows: Record<string, string> = {
  it: `Carica i filmati una volta e riutilizzali nei montaggi. Trascina i file nella pagina oppure scegli Carica media.
Cerca per nome, filtra per tipo di media e usa cartelle e filtri di origine per trovare caricamenti, generazioni o contenuti stock.
Descrivi qui argomento e pubblico. Scegli sotto piattaforma, tono e lunghezza per impostare la bozza.
Il tuo script appare qui. Modifica apertura, corpo e finale, poi salvalo o passa alla creazione dei media.
Costruiscilo con una conversazione
Scegli Intervistami se vuoi aiuto a trovare la storia. Rispondi a brevi domande per trasformare la tua esperienza in uno script.
Carica un video, scegline uno dalla Libreria o importa un link diretto al video. Aggiungi sotto un obiettivo per una valutazione mirata.
Valuta, poi migliora
Avvia la valutazione al costo in crediti indicato. Il risultato collega i suggerimenti ai momenti del video; Ottimizza li porta in un progetto modificabile.
Crea uno stile riutilizzabile
Scegli Nuovo stile per definire un linguaggio di montaggio, sottotitoli, grafica o colore. Puoi modificare ogni impostazione.
Conserva il tuo linguaggio visivo
Qui trovi gli stili salvati. Aprine uno per modificarlo, poi usalo in un montaggio. Salvare uno stile non avvia richieste IA.
Scegli la destinazione
Scegli una piattaforma e un account collegato, poi seleziona il video finito da pubblicare.
Scrivi il post e scegli quando pubblicarlo. Salva una bozza o rivedi la pubblicazione completa prima di inviarla.`,
  es: `Sube el material una vez y reutilízalo en tus ediciones. Arrastra archivos a la página o elige Subir medios.
Busca por nombre, filtra por tipo de medio y usa carpetas y filtros de origen para encontrar archivos subidos, generados o de stock.
Describe aquí el tema y el público. Elige abajo la plataforma, el tono y la duración para dar forma al borrador.
Tu guion aparece aquí. Edita el gancho, el cuerpo y el final; después guárdalo o continúa creando medios.
Créalo conversando
Elige Entrevístame si necesitas ayuda para encontrar la historia. Responde preguntas breves para convertir tu experiencia en un guion.
Sube un vídeo, elige uno de la Biblioteca o importa un enlace directo al vídeo. Añade un objetivo abajo para una revisión enfocada.
Revisa y mejora
Inicia la revisión por el coste en créditos mostrado. El resultado relaciona los comentarios con momentos del vídeo; Optimizar los lleva a un proyecto editable.
Crea un estilo reutilizable
Elige Nuevo estilo para definir un lenguaje de edición, subtítulos, gráficos o color. Puedes editar todos los ajustes.
Conserva tu lenguaje visual
Aquí están tus estilos guardados. Abre uno para ajustarlo y úsalo en una edición. Guardar un estilo no inicia una solicitud de IA.
Elige su destino
Elige una plataforma y una cuenta conectada; después selecciona el vídeo terminado que quieras publicar.
Escribe la publicación y elige cuándo enviarla. Guarda un borrador o revisa la publicación completa antes de enviarla.`,
  fr: `Importez vos séquences une fois et réutilisez-les dans vos montages. Glissez les fichiers sur la page ou choisissez Importer des médias.
Recherchez par nom, filtrez par type de média, puis utilisez les dossiers et les filtres de source pour retrouver imports, générations ou médias de stock.
Décrivez ici le sujet et le public. Choisissez ensuite la plateforme, le ton et la longueur pour orienter le brouillon.
Votre script apparaît ici. Modifiez l’accroche, le corps et la fin, puis enregistrez-le ou passez à la création de médias.
Construisez-le en discutant
Choisissez Interviewez-moi pour trouver votre histoire avec de l’aide. Répondez à de courtes questions pour transformer votre expérience en script.
Importez une vidéo, choisissez-en une dans la Bibliothèque ou importez un lien vidéo direct. Ajoutez un objectif ci-dessous pour une analyse ciblée.
Analysez, puis améliorez
Lancez l’analyse au coût en crédits indiqué. Le résultat relie les conseils aux moments de la vidéo ; Optimiser les transfère dans un projet modifiable.
Créez un style réutilisable
Choisissez Nouveau style pour définir un langage de montage, des sous-titres, un graphisme ou un rendu couleur. Chaque réglage est modifiable.
Conservez votre langage visuel
Vos styles enregistrés sont ici. Ouvrez-en un pour l’ajuster, puis utilisez-le dans un montage. Enregistrer un style ne lance aucune requête IA.
Choisissez sa destination
Choisissez une plateforme et un compte connecté, puis sélectionnez la vidéo terminée à publier.
Rédigez la publication et choisissez son horaire. Enregistrez un brouillon ou vérifiez la publication complète avant de l’envoyer.`,
  de: `Lade dein Material einmal hoch und verwende es in mehreren Projekten. Ziehe Dateien auf die Seite oder wähle Medien hochladen.
Suche nach Namen, grenze den Medientyp ein und nutze Ordner und Quellenfilter für Uploads, generierte Dateien oder Stockmedien.
Beschreibe hier Thema und Zielgruppe. Wähle darunter Plattform, Ton und Länge für deinen Entwurf.
Hier erscheint dein Skript. Bearbeite Einstieg, Hauptteil und Schluss und speichere es oder erstelle anschließend Medien.
Entwickle es im Gespräch
Wähle Interviewe mich, wenn du Hilfe bei deiner Geschichte möchtest. Beantworte kurze Rückfragen, um deine Erfahrung in ein Skript zu verwandeln.
Lade ein Video hoch, wähle eines aus der Bibliothek oder importiere einen direkten Videolink. Ergänze unten ein Ziel für eine gezielte Analyse.
Prüfen und verbessern
Starte die Analyse zum angezeigten Creditpreis. Das Ergebnis ordnet Hinweise konkreten Videostellen zu; Optimieren überträgt sie in ein bearbeitbares Projekt.
Erstelle einen wiederverwendbaren Stil
Wähle Neuer Stil, um Schnittsprache, Untertitel, Grafik oder Farblook festzulegen. Jede Einstellung lässt sich bearbeiten.
Bewahre deine Bildsprache
Hier findest du deine gespeicherten Stile. Öffne einen, passe ihn an und verwende ihn im Schnitt. Das Speichern startet keine KI-Anfrage.
Wähle das Ziel
Wähle eine Plattform und ein verbundenes Konto und anschließend das fertige Video, das du veröffentlichen möchtest.
Schreibe den Beitrag und lege den Zeitpunkt fest. Speichere einen Entwurf oder prüfe die fertige Veröffentlichung vor dem Senden.`,
  pt: `Carregue as gravações uma vez e reutilize-as nas edições. Arraste ficheiros para a página ou escolha Carregar multimédia.
Pesquise por nome, filtre por tipo de média e use pastas e filtros de origem para encontrar carregamentos, gerações ou conteúdos de stock.
Descreva aqui o tema e o público. Escolha abaixo a plataforma, o tom e a duração para orientar o rascunho.
O seu guião aparece aqui. Edite a abertura, o corpo e o final; depois guarde-o ou continue para a criação de média.
Crie através de uma conversa
Escolha Entrevista-me quando quiser ajuda para encontrar a história. Responda a perguntas curtas para transformar a sua experiência num guião.
Carregue um vídeo, escolha um da Biblioteca ou importe uma ligação direta ao vídeo. Acrescente um objetivo abaixo para uma análise focada.
Analise e melhore
Inicie a análise pelo custo em créditos indicado. O resultado liga as sugestões a momentos do vídeo; Otimizar leva-as para um projeto editável.
Crie um estilo reutilizável
Escolha Novo estilo para definir uma linguagem de edição, legendas, gráficos ou cor. Pode editar todas as definições.
Mantenha a sua linguagem visual
Os estilos guardados estão aqui. Abra um para o ajustar e use-o numa edição. Guardar um estilo não inicia um pedido de IA.
Escolha o destino
Escolha uma plataforma e uma conta ligada; depois selecione o vídeo terminado que pretende publicar.
Escreva a publicação e escolha o momento. Guarde um rascunho ou reveja a publicação completa antes de a enviar.`,
  nl: `Upload je beelden één keer en gebruik ze in meerdere montages. Sleep bestanden naar de pagina of kies Media uploaden.
Zoek op naam, filter op mediatype en gebruik mappen en bronfilters om uploads, gegenereerde bestanden of stockmedia te vinden.
Beschrijf hier het onderwerp en publiek. Kies hieronder het platform, de toon en de lengte voor je concept.
Hier verschijnt je script. Bewerk de opening, het midden en het einde en sla het op of ga verder met media maken.
Maak het in een gesprek
Kies Interview mij als je hulp wilt bij het vinden van je verhaal. Beantwoord korte vervolgvragen om je ervaring om te zetten in een script.
Upload een video, kies er een uit de Bibliotheek of importeer een directe videolink. Voeg hieronder een doel toe voor gerichte feedback.
Beoordeel en verbeter
Start de beoordeling voor het getoonde aantal credits. Het resultaat koppelt feedback aan videomomenten; Optimaliseren zet dit over naar een bewerkbaar project.
Maak een herbruikbare stijl
Kies Nieuwe stijl om montagetaal, ondertitels, graphics of kleur vast te leggen. Je kunt elke instelling bewerken.
Bewaar je beeldtaal
Hier staan je opgeslagen stijlen. Open er een om die aan te passen en gebruik hem in een montage. Opslaan start geen AI-aanvraag.
Kies de bestemming
Kies een platform en gekoppeld account en selecteer daarna de voltooide video die je wilt publiceren.
Schrijf het bericht en kies het tijdstip. Sla een concept op of controleer de volledige publicatie voordat je die verstuurt.`,
  pl: `Prześlij nagrania raz i używaj ich w kolejnych montażach. Przeciągnij pliki na stronę lub wybierz Prześlij multimedia.
Szukaj po nazwie, zawęź typ mediów i użyj folderów oraz filtrów źródła, aby znaleźć pliki przesłane, wygenerowane lub stockowe.
Opisz tutaj temat i odbiorców. Poniżej wybierz platformę, ton i długość, aby nadać kształt szkicowi.
Tutaj pojawi się scenariusz. Edytuj początek, rozwinięcie i zakończenie, a potem zapisz go lub przejdź do tworzenia mediów.
Stwórz go poprzez rozmowę
Wybierz Przeprowadź ze mną wywiad, gdy potrzebujesz pomocy w znalezieniu historii. Odpowiedz na krótkie pytania, aby zamienić doświadczenie w scenariusz.
Prześlij film, wybierz go z Biblioteki lub zaimportuj bezpośredni link do filmu. Dodaj poniżej cel, jeśli chcesz ukierunkowanej oceny.
Oceń, a potem popraw
Rozpocznij ocenę za podaną liczbę kredytów. Wynik łączy wskazówki z momentami filmu; Optymalizuj przenosi je do edytowalnego projektu.
Utwórz styl do ponownego użycia
Wybierz Nowy styl, aby określić język montażu, napisy, grafikę lub kolorystykę. Możesz zmienić każde ustawienie.
Zachowaj swój język wizualny
Tutaj są zapisane style. Otwórz jeden, dostosuj go i użyj w montażu. Zapisanie stylu nie uruchamia żądania AI.
Wybierz miejsce publikacji
Wybierz platformę i połączone konto, a potem gotowy film do opublikowania.
Napisz post i wybierz termin. Zapisz szkic lub sprawdź gotową publikację przed wysłaniem.`,
  ro: `Încarcă materialele o singură dată și refolosește-le în montaje. Trage fișierele pe pagină sau alege Încarcă materiale media.
Caută după nume, filtrează după tipul media și folosește dosare și filtre de sursă pentru încărcări, generări sau materiale stock.
Descrie aici subiectul și publicul. Alege mai jos platforma, tonul și lungimea pentru a contura ciorna.
Scenariul apare aici. Editează introducerea, conținutul și finalul, apoi salvează-l sau continuă cu crearea materialelor media.
Construiește-l printr-o conversație
Alege Intervievează-mă dacă vrei ajutor să găsești povestea. Răspunde la întrebări scurte pentru a transforma experiența într-un scenariu.
Încarcă un videoclip, alege unul din Bibliotecă sau importă un link video direct. Adaugă mai jos un obiectiv pentru o evaluare concentrată.
Evaluează, apoi îmbunătățește
Pornește evaluarea la costul în credite afișat. Rezultatul leagă sugestiile de momentele videoclipului; Optimizează le transferă într-un proiect editabil.
Creează un stil reutilizabil
Alege Stil nou pentru a defini limbajul montajului, subtitrările, grafica sau culorile. Poți edita fiecare setare.
Păstrează-ți limbajul vizual
Stilurile salvate sunt aici. Deschide unul, ajustează-l și folosește-l într-un montaj. Salvarea unui stil nu pornește o cerere AI.
Alege destinația
Alege o platformă și un cont conectat, apoi selectează videoclipul finalizat pe care vrei să-l publici.
Scrie postarea și alege momentul. Salvează o ciornă sau verifică publicarea completă înainte de trimitere.`,
  tr: `Çekimleri bir kez yükleyin ve düzenlemelerinizde yeniden kullanın. Dosyaları sayfaya sürükleyin veya Medya yükle'yi seçin.
Ada göre arayın, medya türünü daraltın; yüklenen, oluşturulan veya stok dosyaları bulmak için klasör ve kaynak filtrelerini kullanın.
Konuyu ve hedef kitleyi burada açıklayın. Taslağa yön vermek için aşağıdan platformu, tonu ve uzunluğu seçin.
Senaryonuz burada görünür. Açılışı, ana bölümü ve sonu düzenleyin; ardından kaydedin veya medya oluşturmaya geçin.
Sohbet ederek oluşturun
Hikâyeyi bulmak için yardım istediğinizde Benimle röportaj yap'ı seçin. Deneyiminizi senaryoya dönüştürmek için kısa soruları yanıtlayın.
Bir video yükleyin, Kitaplık'tan seçin veya doğrudan video bağlantısı içe aktarın. Odaklı bir inceleme için aşağıya hedef ekleyin.
İnceleyin, ardından geliştirin
İncelemeyi gösterilen kredi ücretiyle başlatın. Sonuç, geri bildirimi videodaki anlarla eşleştirir; Optimize et bunu düzenlenebilir projeye taşır.
Yeniden kullanılabilir stil oluşturun
Kurgu dili, altyazı biçimi, grafik veya renk görünümü tanımlamak için Yeni stil'i seçin. Her ayarı düzenleyebilirsiniz.
Görsel dilinizi koruyun
Kaydettiğiniz stiller buradadır. Birini açıp ayarlayın ve kurguda kullanın. Stil kaydetmek yapay zekâ isteği başlatmaz.
Nereye gideceğini seçin
Bir platform ve bağlı hesap seçin, ardından yayımlamak istediğiniz bitmiş videoyu belirleyin.
Gönderiyi yazın ve zamanını seçin. Taslak kaydedin veya göndermeden önce tamamlanan yayını gözden geçirin.`,
  uk: `Завантажте матеріали один раз і використовуйте їх у різних монтажах. Перетягніть файли на сторінку або виберіть Завантажити медіа.
Шукайте за назвою, звузьте тип медіа та використовуйте папки й фільтри джерела для завантажених, згенерованих або стокових файлів.
Опишіть тут тему й аудиторію. Нижче виберіть платформу, тон і тривалість, щоб сформувати чернетку.
Тут з’явиться сценарій. Відредагуйте початок, основну частину й завершення, а потім збережіть або перейдіть до створення медіа.
Створіть його в розмові
Виберіть Візьми в мене інтерв’ю, якщо потрібна допомога з історією. Відповідайте на короткі запитання, щоб перетворити досвід на сценарій.
Завантажте відео, виберіть його з Бібліотеки або імпортуйте пряме посилання. Додайте нижче мету для цілеспрямованого огляду.
Оцініть, а потім покращте
Почніть огляд за вказану кількість кредитів. Результат пов’язує поради з моментами відео; Оптимізувати переносить їх у редагований проєкт.
Створіть багаторазовий стиль
Виберіть Новий стиль, щоб визначити мову монтажу, субтитри, графіку чи колір. Кожне налаштування можна змінити.
Збережіть свою візуальну мову
Тут зберігаються ваші стилі. Відкрийте один, налаштуйте й використайте в монтажі. Збереження стилю не запускає запит ШІ.
Виберіть місце публікації
Виберіть платформу й підключений обліковий запис, а потім готове відео для публікації.
Напишіть допис і виберіть час. Збережіть чернетку або перевірте готову публікацію перед надсиланням.`,
  ru: `Загрузите материалы один раз и используйте их в разных монтажах. Перетащите файлы на страницу или выберите Загрузить медиа.
Ищите по названию, уточняйте тип медиа и используйте папки и фильтры источника для загруженных, сгенерированных или стоковых файлов.
Опишите здесь тему и аудиторию. Ниже выберите платформу, тон и длительность, чтобы сформировать черновик.
Здесь появится сценарий. Измените начало, основную часть и концовку, затем сохраните его или перейдите к созданию медиа.
Создайте его в разговоре
Выберите Возьми у меня интервью, если нужна помощь с историей. Отвечайте на короткие вопросы, чтобы превратить опыт в сценарий.
Загрузите видео, выберите его из Библиотеки или импортируйте прямую ссылку. Добавьте ниже цель для направленного анализа.
Оцените и улучшите
Начните анализ за указанное число кредитов. Результат связывает советы с моментами видео; Оптимизировать переносит их в редактируемый проект.
Создайте многоразовый стиль
Выберите Новый стиль, чтобы задать язык монтажа, субтитры, графику или цвет. Любую настройку можно изменить.
Сохраните свой визуальный язык
Здесь находятся сохранённые стили. Откройте один, настройте и используйте в монтаже. Сохранение стиля не запускает запрос ИИ.
Выберите место публикации
Выберите платформу и подключённую учётную запись, затем готовое видео для публикации.
Напишите пост и выберите время. Сохраните черновик или проверьте готовую публикацию перед отправкой.`,
  ar: `ارفع اللقطات مرة واحدة وأعد استخدامها في تعديلاتك. اسحب الملفات إلى الصفحة أو اختر رفع الوسائط.
ابحث بالاسم وحدّد نوع الوسائط، ثم استخدم المجلدات ومرشحات المصدر للعثور على الملفات المرفوعة أو المولّدة أو الجاهزة.
صِف الموضوع والجمهور هنا. اختر أدناه المنصة والنبرة والطول لتشكيل المسودة.
يظهر النص هنا. عدّل البداية والمتن والنهاية، ثم احفظه أو تابع إلى إنشاء الوسائط.
أنشئه عبر محادثة
اختر أجرِ معي مقابلة إذا أردت مساعدة في العثور على القصة. أجب عن أسئلة متابعة قصيرة لتحويل تجربتك إلى نص.
ارفع فيديو، أو اختر واحدًا من المكتبة، أو استورد رابط فيديو مباشرًا. أضف هدفًا أدناه إذا أردت مراجعة مركّزة.
راجع ثم حسّن
ابدأ المراجعة بتكلفة الرصيد المعروضة. تربط النتيجة الملاحظات بلحظات الفيديو؛ وينقلها خيار تحسين إلى مشروع قابل للتحرير.
أنشئ نمطًا قابلًا لإعادة الاستخدام
اختر نمط جديد لتحديد لغة المونتاج أو تنسيق الترجمة أو الرسوم أو الألوان. يمكنك تعديل كل إعداد.
احتفظ بلغتك البصرية
أنماطك المحفوظة هنا. افتح أحدها وعدّله ثم استخدمه في المونتاج. حفظ النمط لا يبدأ طلبًا للذكاء الاصطناعي.
اختر وجهته
اختر منصة وحسابًا متصلًا، ثم حدّد الفيديو النهائي الذي تريد نشره.
اكتب المنشور واختر توقيته. احفظ مسودة أو راجع المنشور المكتمل قبل إرساله.`,
  hi: `फ़ुटेज एक बार अपलोड करें और अपने संपादनों में दोबारा इस्तेमाल करें। फ़ाइलें पेज पर खींचें या मीडिया अपलोड करें चुनें।
नाम से खोजें, मीडिया प्रकार चुनें और अपलोड, जनरेट की गई फ़ाइलें या स्टॉक खोजने के लिए फ़ोल्डर और स्रोत फ़िल्टर इस्तेमाल करें।
यहाँ विषय और दर्शकों का वर्णन करें। मसौदे को दिशा देने के लिए नीचे प्लेटफ़ॉर्म, शैली और लंबाई चुनें।
आपकी स्क्रिप्ट यहाँ दिखती है। शुरुआत, मुख्य भाग और अंत संपादित करें, फिर सहेजें या मीडिया बनाना जारी रखें।
बातचीत से तैयार करें
कहानी खोजने में मदद चाहिए तो मेरा इंटरव्यू लें चुनें। अपने अनुभव को स्क्रिप्ट में बदलने के लिए छोटे सवालों के जवाब दें।
वीडियो अपलोड करें, लाइब्रेरी से चुनें या सीधे वीडियो का लिंक आयात करें। केंद्रित समीक्षा के लिए नीचे लक्ष्य जोड़ें।
समीक्षा करें, फिर सुधारें
दिखाई गई क्रेडिट लागत पर समीक्षा शुरू करें। परिणाम सुझावों को वीडियो के खास पलों से जोड़ता है; ऑप्टिमाइज़ उन्हें संपादन योग्य प्रोजेक्ट में ले जाता है।
दोबारा इस्तेमाल होने वाली शैली बनाएँ
संपादन शैली, कैप्शन, ग्राफ़िक या रंग तय करने के लिए नई शैली चुनें। हर सेटिंग बदली जा सकती है।
अपनी दृश्य शैली सहेजें
आपकी सहेजी गई शैलियाँ यहाँ हैं। किसी शैली को खोलकर बदलें और संपादन में इस्तेमाल करें। शैली सहेजने से AI अनुरोध शुरू नहीं होता।
प्रकाशन की जगह चुनें
प्लेटफ़ॉर्म और जुड़ा हुआ खाता चुनें, फिर वह तैयार वीडियो चुनें जिसे प्रकाशित करना है।
पोस्ट लिखें और समय चुनें। मसौदा सहेजें या भेजने से पहले तैयार प्रकाशन की समीक्षा करें।`,
  ja: `素材は一度アップロードすれば、複数の編集で再利用できます。ページにファイルをドラッグするか、「メディアをアップロード」を選んでください。
名前で検索し、メディアの種類を絞り込みます。フォルダーやソースのフィルターで、アップロード、生成、ストックの素材を探せます。
ここにテーマと視聴者を入力します。下でプラットフォーム、トーン、長さを選び、下書きの方向性を決めてください。
ここに台本が表示されます。導入、本文、締めくくりを編集し、保存するかメディア作成に進んでください。
会話から作り上げる
話の組み立てに迷ったら「インタビューして」を選んでください。短い追加質問に答えて、経験を台本にまとめられます。
動画をアップロードするか、ライブラリから選ぶか、動画への直接リンクを取り込みます。目的を下に追加すると、焦点を絞ったレビューになります。
確認してから改善する
表示されたクレジット数でレビューを開始します。結果は指摘を動画内の場面に結び付け、「最適化」で編集可能なプロジェクトに引き継げます。
再利用できるスタイルを作る
「新しいスタイル」で編集の方向性、字幕、グラフィック、色調を定義します。すべての設定を編集できます。
ビジュアルの個性を保存する
保存したスタイルはここにあります。開いて調整し、編集に使用してください。スタイルの保存ではAIリクエストは開始されません。
公開先を選ぶ
プラットフォームと接続済みアカウントを選び、公開する完成動画を指定してください。
投稿文を書き、公開時刻を選びます。下書きを保存するか、送信前に完成した投稿を確認してください。`,
  ko: `영상을 한 번 업로드하고 여러 편집에서 재사용하세요. 파일을 페이지로 끌어오거나 미디어 업로드를 선택하세요.
이름으로 검색하고 미디어 유형을 좁힌 다음, 폴더와 출처 필터로 업로드·생성·스톡 파일을 찾으세요.
주제와 대상 시청자를 여기에 설명하세요. 아래에서 플랫폼, 어조, 길이를 선택해 초안의 방향을 정하세요.
스크립트가 여기에 표시됩니다. 도입부, 본문, 마무리를 편집한 뒤 저장하거나 미디어 제작으로 이어가세요.
대화로 만들어 가세요
이야기를 찾는 데 도움이 필요하면 인터뷰해 주세요를 선택하세요. 짧은 후속 질문에 답해 경험을 스크립트로 바꾸세요.
동영상을 업로드하거나 라이브러리에서 선택하거나 직접 동영상 링크를 가져오세요. 집중 검토를 원하면 아래에 목표를 추가하세요.
검토한 뒤 개선하세요
표시된 크레딧 비용으로 검토를 시작하세요. 결과는 피드백을 영상의 해당 장면과 연결하며, 최적화는 이를 편집 가능한 프로젝트로 옮깁니다.
재사용할 스타일을 만드세요
새 스타일을 선택해 편집 방식, 자막, 그래픽 또는 색감을 정의하세요. 모든 설정을 편집할 수 있습니다.
나만의 시각 언어를 보관하세요
저장한 스타일이 여기에 있습니다. 열어 조정한 뒤 편집에 사용하세요. 스타일을 저장해도 AI 요청이 시작되지는 않습니다.
게시할 곳을 선택하세요
플랫폼과 연결된 계정을 선택한 다음 게시할 완성 영상을 고르세요.
게시물을 작성하고 시간을 선택하세요. 초안을 저장하거나 전송 전에 완성된 게시물을 검토하세요.`,
  zh: `素材上传一次，即可在多次剪辑中复用。将文件拖到页面上，或选择“上传媒体”。
按名称搜索，按媒体类型缩小范围，再使用文件夹和来源筛选查找上传、生成或素材库内容。
在这里描述主题和受众。在下方选择平台、语气和长度，确定草稿方向。
脚本会显示在这里。编辑开场、正文和结尾，然后保存或继续创建媒体。
通过对话逐步创作
需要帮助梳理故事时，选择“采访我”。回答简短的追问，把你的经历整理成脚本。
上传视频、从媒体库选择视频，或导入视频直链。需要针对性评估时，在下方添加目标。
先评估，再改进
按显示的点数费用开始评估。结果会将反馈对应到视频中的具体时刻；“优化”会将这些内容带入可编辑项目。
创建可复用的风格
选择“新建风格”，定义剪辑语言、字幕样式、图形或色彩效果。每项设置都可以编辑。
保留你的视觉语言
保存的风格都在这里。打开并调整，再用于剪辑。保存风格不会发起 AI 请求。
选择发布位置
选择平台和已连接的账号，再选择要发布的成片。
编写帖子并选择发布时间。可以保存草稿，或在发送前检查完整的发布内容。`,
  vi: `Tải cảnh quay lên một lần và dùng lại trong các bản dựng. Kéo tệp vào trang hoặc chọn Tải phương tiện lên.
Tìm theo tên, lọc loại phương tiện rồi dùng thư mục và bộ lọc nguồn để tìm tệp tải lên, được tạo hoặc từ kho.
Mô tả chủ đề và khán giả ở đây. Chọn nền tảng, giọng điệu và độ dài bên dưới để định hình bản nháp.
Kịch bản xuất hiện ở đây. Sửa mở đầu, nội dung và kết thúc, rồi lưu hoặc tiếp tục tạo phương tiện.
Xây dựng qua cuộc trò chuyện
Chọn Phỏng vấn tôi khi cần giúp tìm câu chuyện. Trả lời các câu hỏi ngắn để biến trải nghiệm thành kịch bản.
Tải video lên, chọn từ Thư viện hoặc nhập liên kết video trực tiếp. Thêm mục tiêu bên dưới nếu muốn đánh giá có trọng tâm.
Đánh giá rồi cải thiện
Bắt đầu đánh giá với mức tín dụng hiển thị. Kết quả gắn góp ý với các thời điểm trong video; Tối ưu chuyển chúng sang dự án có thể chỉnh sửa.
Tạo phong cách dùng lại được
Chọn Phong cách mới để định nghĩa ngôn ngữ dựng, phụ đề, đồ họa hoặc màu sắc. Bạn có thể sửa mọi thiết lập.
Giữ ngôn ngữ hình ảnh của bạn
Phong cách đã lưu nằm ở đây. Mở một phong cách để điều chỉnh rồi dùng trong bản dựng. Lưu phong cách không khởi chạy yêu cầu AI.
Chọn nơi đăng
Chọn nền tảng và tài khoản đã kết nối, rồi chọn video hoàn chỉnh muốn đăng.
Viết bài và chọn thời điểm. Lưu bản nháp hoặc xem lại bài đăng hoàn chỉnh trước khi gửi.`,
  da: `Upload optagelser én gang, og genbrug dem i dine redigeringer. Træk filer ind på siden, eller vælg Upload medier.
Søg efter navn, afgræns medietypen, og brug mapper og kildefiltre til at finde uploads, genererede filer eller stockmedier.
Beskriv emnet og målgruppen her. Vælg platform, tone og længde nedenfor for at forme dit udkast.
Dit manuskript vises her. Rediger indledning, hoveddel og afslutning, og gem det eller fortsæt med at skabe medier.
Skab det gennem en samtale
Vælg Interview mig, når du vil have hjælp til at finde historien. Besvar korte opfølgende spørgsmål for at gøre din erfaring til et manuskript.
Upload en video, vælg en fra Bibliotek, eller importer et direkte videolink. Tilføj et mål nedenfor for en fokuseret vurdering.
Vurder, og forbedr
Start vurderingen til den viste kreditpris. Resultatet knytter feedback til tidspunkter i videoen; Optimer overfører den til et redigerbart projekt.
Opret en stil, der kan genbruges
Vælg Ny stil for at definere klippesprog, undertekster, grafik eller farvelook. Du kan redigere alle indstillinger.
Bevar dit visuelle sprog
Her ligger dine gemte stilarter. Åbn en, tilpas den, og brug den i en redigering. At gemme en stil starter ikke en AI-anmodning.
Vælg destinationen
Vælg en platform og en tilknyttet konto, og vælg derefter den færdige video, du vil udgive.
Skriv opslaget, og vælg tidspunktet. Gem et udkast, eller gennemgå den færdige udgivelse, før du sender den.`,
  sv: `Ladda upp materialet en gång och återanvänd det i dina redigeringar. Dra filer till sidan eller välj Ladda upp media.
Sök efter namn, avgränsa medietypen och använd mappar och källfilter för att hitta uppladdningar, genererade filer eller stockmaterial.
Beskriv ämnet och målgruppen här. Välj plattform, ton och längd nedan för att forma utkastet.
Ditt manus visas här. Redigera inledning, huvuddel och avslutning och spara det eller fortsätt skapa media.
Skapa genom ett samtal
Välj Intervjua mig när du vill ha hjälp att hitta berättelsen. Svara på korta följdfrågor för att göra din erfarenhet till ett manus.
Ladda upp en video, välj en från Biblioteket eller importera en direkt videolänk. Lägg till ett mål nedan för en fokuserad granskning.
Granska och förbättra
Starta granskningen till den visade kreditkostnaden. Resultatet kopplar återkopplingen till stunder i videon; Optimera överför den till ett redigerbart projekt.
Skapa en återanvändbar stil
Välj Ny stil för att definiera klippspråk, undertexter, grafik eller färgutseende. Du kan redigera alla inställningar.
Bevara ditt visuella språk
Här finns dina sparade stilar. Öppna en, justera den och använd den i en redigering. Att spara en stil startar ingen AI-förfrågan.
Välj destination
Välj en plattform och ett anslutet konto och sedan den färdiga video du vill publicera.
Skriv inlägget och välj tidpunkt. Spara ett utkast eller granska den färdiga publiceringen innan du skickar.`,
  no: `Last opp opptak én gang og bruk dem igjen i redigeringene dine. Dra filer til siden eller velg Last opp medier.
Søk etter navn, avgrens medietypen og bruk mapper og kildefiltre for å finne opplastinger, genererte filer eller arkivmedier.
Beskriv tema og målgruppe her. Velg plattform, tone og lengde nedenfor for å forme utkastet.
Manuset vises her. Rediger åpning, hoveddel og avslutning, og lagre det eller fortsett med å lage medier.
Lag det gjennom en samtale
Velg Intervju meg når du vil ha hjelp til å finne historien. Svar på korte oppfølgingsspørsmål for å gjøre erfaringen din til et manus.
Last opp en video, velg en fra Biblioteket eller importer en direkte videolenke. Legg til et mål nedenfor for en målrettet vurdering.
Vurder og forbedre
Start vurderingen til den viste kredittprisen. Resultatet knytter tilbakemelding til øyeblikk i videoen; Optimaliser overfører den til et redigerbart prosjekt.
Lag en gjenbrukbar stil
Velg Ny stil for å definere klippespråk, undertekster, grafikk eller fargeuttrykk. Du kan redigere alle innstillinger.
Bevar ditt visuelle språk
De lagrede stilene dine ligger her. Åpne en, juster den og bruk den i en redigering. Å lagre en stil starter ikke en KI-forespørsel.
Velg hvor den skal publiseres
Velg en plattform og en tilkoblet konto, og velg deretter den ferdige videoen du vil publisere.
Skriv innlegget og velg tidspunkt. Lagre et utkast eller se gjennom den ferdige publikasjonen før du sender den.`,
  fi: `Lataa kuvamateriaali kerran ja käytä sitä uudelleen editoinneissa. Vedä tiedostot sivulle tai valitse Lataa mediaa.
Hae nimellä, rajaa mediatyyppi ja etsi kansioiden sekä lähdesuodattimien avulla ladatut, generoidut tai kuvapankin tiedostot.
Kuvaile aihe ja yleisö tässä. Valitse alta alusta, sävy ja pituus luonnoksen muotoilemiseksi.
Käsikirjoituksesi näkyy tässä. Muokkaa aloitusta, keskiosaa ja lopetusta, sitten tallenna tai jatka median luomiseen.
Rakenna se keskustellen
Valitse Haastattele minua, kun haluat apua tarinan löytämiseen. Vastaa lyhyisiin jatkokysymyksiin ja muuta kokemuksesi käsikirjoitukseksi.
Lataa video, valitse se Kirjastosta tai tuo suora videolinkki. Lisää alle tavoite, jos haluat kohdennetun arvion.
Arvioi ja paranna
Aloita arvio näytetyllä krediittihinnalla. Tulos yhdistää palautteen videon kohtiin; Optimoi siirtää sen muokattavaan projektiin.
Luo uudelleenkäytettävä tyyli
Valitse Uusi tyyli määrittääksesi leikkaustavan, tekstitykset, grafiikan tai värimaailman. Voit muokata kaikkia asetuksia.
Säilytä visuaalinen kielesi
Tallennetut tyylisi ovat täällä. Avaa tyyli, muokkaa sitä ja käytä editoinnissa. Tyylin tallentaminen ei käynnistä tekoälypyyntöä.
Valitse julkaisupaikka
Valitse alusta ja yhdistetty tili sekä valmis video, jonka haluat julkaista.
Kirjoita julkaisu ja valitse ajankohta. Tallenna luonnos tai tarkista valmis julkaisu ennen lähettämistä.`,
  cs: `Nahrajte záběry jednou a používejte je v dalších úpravách. Přetáhněte soubory na stránku nebo zvolte Nahrát média.
Hledejte podle názvu, omezte typ médií a pomocí složek a filtrů zdroje najděte nahrané, generované nebo fotobankové soubory.
Zde popište téma a publikum. Níže vyberte platformu, tón a délku, abyste určili podobu návrhu.
Zde se zobrazí scénář. Upravte úvod, hlavní část a závěr, pak ho uložte nebo pokračujte k tvorbě médií.
Vytvořte ho rozhovorem
Pokud potřebujete pomoc s příběhem, zvolte Udělej se mnou rozhovor. Odpovídejte na krátké doplňující otázky a proměňte zkušenost ve scénář.
Nahrajte video, vyberte ho z Knihovny nebo importujte přímý odkaz na video. Pro cílené posouzení přidejte níže cíl.
Posuďte a vylepšete
Spusťte posouzení za zobrazený počet kreditů. Výsledek propojí doporučení s okamžiky ve videu; Optimalizovat je přenese do upravitelného projektu.
Vytvořte opakovaně použitelný styl
Zvolte Nový styl pro jazyk střihu, titulky, grafiku nebo barevný vzhled. Každé nastavení lze upravit.
Zachovejte svůj vizuální jazyk
Zde jsou uložené styly. Otevřete jeden, upravte ho a použijte ve střihu. Uložení stylu nespouští požadavek na AI.
Vyberte místo zveřejnění
Vyberte platformu a připojený účet, pak hotové video, které chcete zveřejnit.
Napište příspěvek a vyberte čas. Uložte koncept nebo před odesláním zkontrolujte hotovou publikaci.`,
  hu: `Töltsd fel egyszer a felvételeket, és használd fel őket több szerkesztésben. Húzd a fájlokat az oldalra, vagy válaszd a Média feltöltése lehetőséget.
Keress név szerint, szűkíts médiatípusra, majd mappákkal és forrásszűrőkkel keresd meg a feltöltött, generált vagy stockfájlokat.
Itt írd le a témát és a célközönséget. Alább válaszd ki a platformot, hangnemet és hosszt a vázlat formálásához.
Itt jelenik meg a forgatókönyv. Szerkeszd a nyitást, a fő részt és a lezárást, majd mentsd el vagy folytasd a médiakészítést.
Építsd fel beszélgetéssel
Válaszd az Interjúzz velem lehetőséget, ha segítség kell a történethez. Rövid kérdésekre válaszolva alakítsd a tapasztalatodat forgatókönyvvé.
Tölts fel videót, válassz a Médiatárból, vagy importálj közvetlen videólinket. Célzott értékeléshez adj meg célt alább.
Értékeld, majd javítsd
Indítsd el az értékelést a kijelzett kreditköltséggel. Az eredmény a visszajelzést videópillanatokhoz köti; az Optimalizálás szerkeszthető projektbe viszi át.
Hozz létre újrahasználható stílust
Válaszd az Új stílus lehetőséget a vágási nyelv, feliratok, grafika vagy színvilág megadásához. Minden beállítás szerkeszthető.
Őrizd meg a vizuális nyelved
Itt találhatók a mentett stílusok. Nyiss meg egyet, módosítsd, majd használd szerkesztésben. A stílus mentése nem indít AI-kérést.
Válaszd ki a megjelenés helyét
Válassz platformot és csatlakoztatott fiókot, majd jelöld ki a közzétenni kívánt kész videót.
Írd meg a bejegyzést, és válassz időpontot. Ments piszkozatot, vagy küldés előtt nézd át a kész publikációt.`,
  el: `Ανεβάστε το υλικό μία φορά και χρησιμοποιήστε το ξανά στα μοντάζ σας. Σύρετε αρχεία στη σελίδα ή επιλέξτε Μεταφόρτωση πολυμέσων.
Αναζητήστε με όνομα, περιορίστε τον τύπο μέσων και χρησιμοποιήστε φακέλους και φίλτρα προέλευσης για μεταφορτώσεις, δημιουργίες ή υλικό αρχείου.
Περιγράψτε εδώ το θέμα και το κοινό. Επιλέξτε παρακάτω πλατφόρμα, τόνο και διάρκεια για να διαμορφώσετε το προσχέδιο.
Το σενάριό σας εμφανίζεται εδώ. Επεξεργαστείτε αρχή, κύριο μέρος και τέλος, μετά αποθηκεύστε το ή συνεχίστε στη δημιουργία μέσων.
Δημιουργήστε το μέσα από συζήτηση
Επιλέξτε Πάρε μου συνέντευξη για βοήθεια στην εύρεση της ιστορίας. Απαντήστε σε σύντομες ερωτήσεις για να μετατρέψετε την εμπειρία σας σε σενάριο.
Ανεβάστε βίντεο, επιλέξτε ένα από τη Βιβλιοθήκη ή εισαγάγετε απευθείας σύνδεσμο βίντεο. Προσθέστε στόχο παρακάτω για εστιασμένη αξιολόγηση.
Αξιολογήστε και βελτιώστε
Ξεκινήστε την αξιολόγηση με το εμφανιζόμενο κόστος μονάδων. Το αποτέλεσμα συνδέει σχόλια με στιγμές του βίντεο· η Βελτιστοποίηση τα μεταφέρει σε επεξεργάσιμο έργο.
Δημιουργήστε επαναχρησιμοποιήσιμο στιλ
Επιλέξτε Νέο στιλ για να ορίσετε γλώσσα μοντάζ, υπότιτλους, γραφικά ή χρώματα. Κάθε ρύθμιση είναι επεξεργάσιμη.
Διατηρήστε την οπτική σας γλώσσα
Εδώ βρίσκονται τα αποθηκευμένα στιλ σας. Ανοίξτε ένα, προσαρμόστε το και χρησιμοποιήστε το σε μοντάζ. Η αποθήκευση στιλ δεν ξεκινά αίτημα AI.
Επιλέξτε προορισμό
Επιλέξτε πλατφόρμα και συνδεδεμένο λογαριασμό, έπειτα το ολοκληρωμένο βίντεο που θέλετε να δημοσιεύσετε.
Γράψτε την ανάρτηση και επιλέξτε χρόνο. Αποθηκεύστε πρόχειρο ή ελέγξτε την ολοκληρωμένη δημοσίευση πριν τη στείλετε.`,
  he: `העלו את חומרי הגלם פעם אחת והשתמשו בהם שוב בעריכות. גררו קבצים לעמוד או בחרו העלאת מדיה.
חפשו לפי שם, צמצמו לפי סוג מדיה והשתמשו בתיקיות ובמסנני מקור למציאת העלאות, קבצים שנוצרו או חומרי מאגר.
תארו כאן את הנושא וקהל היעד. בחרו למטה פלטפורמה, טון ואורך כדי לעצב את הטיוטה.
התסריט מופיע כאן. ערכו את הפתיח, הגוף והסיום, ואז שמרו או המשיכו ליצירת מדיה.
בנו אותו באמצעות שיחה
בחרו ראיין אותי אם תרצו עזרה במציאת הסיפור. ענו על שאלות המשך קצרות כדי להפוך את הניסיון שלכם לתסריט.
העלו סרטון, בחרו אחד מהספרייה או ייבאו קישור ישיר לסרטון. הוסיפו למטה מטרה לקבלת סקירה ממוקדת.
בדקו ואז שפרו
התחילו את הסקירה בעלות הקרדיטים המוצגת. התוצאה מקשרת משוב לרגעים בסרטון; מיטוב מעביר אותו לפרויקט שניתן לעריכה.
צרו סגנון לשימוש חוזר
בחרו סגנון חדש כדי להגדיר שפת עריכה, עיצוב כתוביות, גרפיקה או צבע. אפשר לערוך כל הגדרה.
שמרו על השפה החזותית שלכם
הסגנונות השמורים נמצאים כאן. פתחו סגנון, התאימו אותו והשתמשו בו בעריכה. שמירת סגנון אינה מתחילה בקשת AI.
בחרו את היעד
בחרו פלטפורמה וחשבון מחובר, ואז בחרו את הסרטון המוגמר שברצונכם לפרסם.
כתבו את הפוסט ובחרו תזמון. שמרו טיוטה או בדקו את הפרסום המוגמר לפני שליחתו.`,
  id: `Unggah rekaman sekali dan gunakan kembali dalam suntingan. Seret berkas ke halaman atau pilih Unggah media.
Cari berdasarkan nama, saring jenis media, lalu gunakan folder dan filter sumber untuk menemukan unggahan, hasil pembuatan, atau media stok.
Jelaskan topik dan audiens di sini. Pilih platform, nada, dan panjang di bawah untuk membentuk draf.
Naskah Anda muncul di sini. Edit pembuka, isi, dan penutup, lalu simpan atau lanjutkan membuat media.
Bangun melalui percakapan
Pilih Wawancarai saya jika ingin bantuan menemukan cerita. Jawab pertanyaan lanjutan singkat untuk mengubah pengalaman menjadi naskah.
Unggah video, pilih dari Pustaka, atau impor tautan video langsung. Tambahkan tujuan di bawah untuk tinjauan yang terarah.
Tinjau, lalu perbaiki
Mulai tinjauan dengan biaya kredit yang ditampilkan. Hasil menghubungkan masukan dengan momen dalam video; Optimalkan membawanya ke proyek yang dapat diedit.
Buat gaya yang dapat digunakan ulang
Pilih Gaya baru untuk menentukan bahasa penyuntingan, tampilan teks, grafis, atau warna. Setiap pengaturan dapat diedit.
Pertahankan bahasa visual Anda
Gaya tersimpan Anda ada di sini. Buka satu gaya, sesuaikan, lalu gunakan dalam suntingan. Menyimpan gaya tidak memulai permintaan AI.
Pilih tujuannya
Pilih platform dan akun yang terhubung, lalu pilih video selesai yang ingin diterbitkan.
Tulis postingan dan pilih waktunya. Simpan draf atau tinjau publikasi lengkap sebelum mengirimnya.`,
  th: `อัปโหลดฟุตเทจครั้งเดียวแล้วนำกลับมาใช้ในการตัดต่อได้ ลากไฟล์มาที่หน้าเว็บหรือเลือกอัปโหลดสื่อ
ค้นหาตามชื่อ กรองประเภทสื่อ แล้วใช้โฟลเดอร์และตัวกรองแหล่งที่มาเพื่อหาไฟล์อัปโหลด ไฟล์ที่สร้าง หรือสื่อสต็อก
อธิบายหัวข้อและผู้ชมที่นี่ เลือกแพลตฟอร์ม น้ำเสียง และความยาวด้านล่างเพื่อกำหนดร่าง
สคริปต์ของคุณจะแสดงที่นี่ แก้ไขส่วนเปิด เนื้อหา และตอนจบ แล้วบันทึกหรือสร้างสื่อต่อ
สร้างผ่านการสนทนา
เลือกสัมภาษณ์ฉันเมื่ออยากได้ความช่วยเหลือในการหาเรื่องราว ตอบคำถามสั้น ๆ เพื่อเปลี่ยนประสบการณ์เป็นสคริปต์
อัปโหลดวิดีโอ เลือกจากคลัง หรือใส่ลิงก์วิดีโอโดยตรง เพิ่มเป้าหมายด้านล่างหากต้องการการประเมินที่เจาะจง
ประเมินแล้วปรับปรุง
เริ่มประเมินตามค่าเครดิตที่แสดง ผลลัพธ์จะเชื่อมข้อเสนอแนะกับช่วงต่าง ๆ ในวิดีโอ และคำสั่งปรับให้เหมาะสมจะนำไปสู่โปรเจกต์ที่แก้ไขได้
สร้างสไตล์ที่นำกลับมาใช้ได้
เลือกสไตล์ใหม่เพื่อกำหนดแนวทางตัดต่อ รูปแบบคำบรรยาย กราฟิก หรือสี คุณแก้ไขได้ทุกการตั้งค่า
เก็บภาษาภาพของคุณ
สไตล์ที่บันทึกอยู่ที่นี่ เปิดสไตล์เพื่อปรับแล้วใช้ในการตัดต่อ การบันทึกสไตล์จะไม่เริ่มคำขอ AI
เลือกปลายทาง
เลือกแพลตฟอร์มและบัญชีที่เชื่อมต่อ แล้วเลือกวิดีโอที่เสร็จแล้วซึ่งต้องการเผยแพร่
เขียนโพสต์และเลือกเวลา บันทึกร่างหรือตรวจทานการเผยแพร่ที่สมบูรณ์ก่อนส่ง`,
};

export const guidedTourUi: Record<string, Record<string, string>> = {
  en: Object.fromEntries(keys.map(key => [key, key])),
  ...Object.fromEntries(
    Object.entries(rows).map(([language, text]) => {
      const translations = text.split("\n");
      return [
        language,
        Object.fromEntries(
          keys.map((key, index) => [key, translations[index]])
        ),
      ];
    })
  ),
};
