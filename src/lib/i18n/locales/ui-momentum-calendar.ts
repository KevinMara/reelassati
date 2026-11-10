import type { InterfaceLanguage } from "@contracts/interface-language";

const keys = [
  "Activity calendar",
  "Longest streak",
  "Consecutive days",
  "Less activity",
  "More activity",
];
const rows: Partial<Record<InterfaceLanguage, string>> = {
  it: "Calendario attività|Serie più lunga|Giorni consecutivi|Meno attività|Più attività",
  fr: "Calendrier d’activité|Plus longue série|Jours consécutifs|Moins d’activité|Plus d’activité",
  es: "Calendario de actividad|Racha más larga|Días consecutivos|Menos actividad|Más actividad",
  de: "Aktivitätskalender|Längste Serie|Tage in Folge|Weniger Aktivität|Mehr Aktivität",
  pt: "Calendário de atividade|Maior sequência|Dias consecutivos|Menos atividade|Mais atividade",
  nl: "Activiteitenkalender|Langste reeks|Opeenvolgende dagen|Minder activiteit|Meer activiteit",
  pl: "Kalendarz aktywności|Najdłuższa seria|Kolejne dni|Mniej aktywności|Więcej aktywności",
  ro: "Calendar de activitate|Cea mai lungă serie|Zile consecutive|Mai puțină activitate|Mai multă activitate",
  tr: "Etkinlik takvimi|En uzun seri|Ardışık günler|Daha az etkinlik|Daha fazla etkinlik",
  uk: "Календар активності|Найдовша серія|Дні поспіль|Менше активності|Більше активності",
  ru: "Календарь активности|Самая длинная серия|Дни подряд|Меньше активности|Больше активности",
  ar: "تقويم النشاط|أطول سلسلة|أيام متتالية|نشاط أقل|نشاط أكثر",
  hi: "गतिविधि कैलेंडर|सबसे लंबा सिलसिला|लगातार दिन|कम गतिविधि|अधिक गतिविधि",
  ja: "活動カレンダー|最長連続記録|連続日数|活動が少ない|活動が多い",
  ko: "활동 달력|최장 연속 기록|연속 일수|적은 활동|많은 활동",
  zh: "活动日历|最长连续记录|连续天数|较少活动|较多活动",
  vi: "Lịch hoạt động|Chuỗi dài nhất|Ngày liên tiếp|Ít hoạt động|Nhiều hoạt động",
  da: "Aktivitetskalender|Længste række|Dage i træk|Mindre aktivitet|Mere aktivitet",
  sv: "Aktivitetskalender|Längsta svit|Dagar i rad|Mindre aktivitet|Mer aktivitet",
  no: "Aktivitetskalender|Lengste rekke|Dager på rad|Mindre aktivitet|Mer aktivitet",
  fi: "Aktiivisuuskalenteri|Pisin sarja|Peräkkäiset päivät|Vähemmän toimintaa|Enemmän toimintaa",
  cs: "Kalendář aktivity|Nejdelší série|Dny v řadě|Méně aktivity|Více aktivity",
  hu: "Aktivitásnaptár|Leghosszabb sorozat|Egymást követő napok|Kevesebb aktivitás|Több aktivitás",
  el: "Ημερολόγιο δραστηριότητας|Μεγαλύτερο σερί|Συνεχόμενες ημέρες|Λιγότερη δραστηριότητα|Περισσότερη δραστηριότητα",
  he: "לוח פעילות|הרצף הארוך ביותר|ימים רצופים|פחות פעילות|יותר פעילות",
  id: "Kalender aktivitas|Rangkaian terpanjang|Hari berturut-turut|Lebih sedikit aktivitas|Lebih banyak aktivitas",
  th: "ปฏิทินกิจกรรม|ช่วงต่อเนื่องนานที่สุด|วันติดต่อกัน|กิจกรรมน้อย|กิจกรรมมาก",
};
export const momentumCalendarUi = Object.fromEntries(
  Object.entries(rows).map(([code, row]) => [
    code,
    Object.fromEntries(keys.map((key, index) => [key, row.split("|")[index]])),
  ])
) as Partial<Record<InterfaceLanguage, Record<string, string>>>;
