/** Documented MiniMax system IDs, checked 2026-09-15. Keep IDs verbatim.
 * https://platform.minimax.io/docs/faq/system-voice-id
 * https://openrouter.ai/minimax/speech-2.8-turbo
 * Native voice languages differ from the model's multilingual text coverage.
 */
export const VOICE_CATALOG_SOURCE =
  "https://platform.minimax.io/docs/faq/system-voice-id";
export const VOICE_CATALOG_CHECKED_AT = "2026-09-15";
export type VoiceDefinition = {
  id: string;
  name: string;
  language: string;
  tags: readonly string[];
};

// Tags describe the provider's names; they are browse aids, not quality ratings.
function voiceTags(name: string): string[] {
  const rules: [RegExp, string][] = [
    [/narrator|storyteller/i, "narration"],
    [/anchor|announcer|presenter|host|executive/i, "presenting"],
    [/calm|serene|tranquil|soothing|patient/i, "calm"],
    [/warm|kind|caring|gentle|sweet|soft|friendly/i, "warm"],
    [/upbeat|jovial|cheerful|energetic|optimistic|playful/i, "upbeat"],
    [/jovial|cheerful|optimistic/i, "happy"],
    [/comedian|humorous|whimsical|quirky/i, "playful"],
    [/graceful|elegant|sophisticated/i, "elegant"],
    [/reserved|shy|bashful/i, "reserved"],
    [/deep|magnetic/i, "deep"],
    [/whisper|soft-spoken/i, "soft"],
    [
      /confident|assertive|determined|assured|brave|strong|powerful/i,
      "confident",
    ],
    [/trust|reliable|steady|diligent|sincere|conscientious/i, "steady"],
    [
      /expressive|passionate|theatrical|dramatist|compelling|sentimental/i,
      "expressive",
    ],
    [/casual|laid.back|chatty|neighbor|friend|partner/i, "conversational"],
    [
      /scholar|mentor|wise|teacher|instructor|intellectual|thoughtful/i,
      "thoughtful",
    ],
    [/mature|elder|senior/i, "mature"],
    [
      /queen|warrior|sorcerer|knight|anime|ghost|elf|heroine|character/i,
      "character",
    ],
  ];
  const tags = rules
    .filter(([pattern]) => pattern.test(name))
    .map(([, tag]) => tag);
  return tags.length ? [...new Set(tags)].slice(0, 3) : ["character"];
}

const documentedVoices: readonly [
  language: string,
  id: string,
  name: string,
][] = [
  ["English", "English_expressive_narrator", "Expressive Narrator"],
  ["English", "English_radiant_girl", "Radiant Girl"],
  ["English", "English_magnetic_voiced_man", "Magnetic-voiced Male"],
  ["English", "English_compelling_lady1", "Compelling Lady"],
  ["English", "English_Aussie_Bloke", "Aussie Bloke"],
  ["English", "English_captivating_female1", "Captivating Female"],
  ["English", "English_Upbeat_Woman", "Upbeat Woman"],
  ["English", "English_Trustworth_Man", "Trustworthy Man"],
  ["English", "English_CalmWoman", "Calm Woman"],
  ["English", "English_UpsetGirl", "Upset Girl"],
  ["English", "English_Gentle-voiced_man", "Gentle-voiced Man"],
  ["English", "English_Whispering_girl", "Whispering girl"],
  ["English", "English_Diligent_Man", "Diligent Man"],
  ["English", "English_Graceful_Lady", "Graceful Lady"],
  ["English", "English_ReservedYoungMan", "Reserved Young Man"],
  ["English", "English_PlayfulGirl", "Playful Girl"],
  ["English", "English_ManWithDeepVoice", "Man With Deep Voice"],
  ["English", "English_MaturePartner", "Mature Partner"],
  ["English", "English_FriendlyPerson", "Friendly Guy"],
  ["English", "English_MatureBoss", "Bossy Lady"],
  ["English", "English_Debator", "Male Debater"],
  ["English", "English_LovelyGirl", "Lovely Girl"],
  ["English", "English_Steadymentor", "Reliable Man"],
  ["English", "English_Deep-VoicedGentleman", "Deep-voiced Gentleman"],
  ["English", "English_Wiselady", "Wise Lady"],
  ["English", "English_CaptivatingStoryteller", "Captivating Storyteller"],
  ["English", "English_DecentYoungMan", "Decent Young Man"],
  ["English", "English_SentimentalLady", "Sentimental Lady"],
  ["English", "English_ImposingManner", "Imposing Queen"],
  ["English", "English_SadTeen", "Teen Boy"],
  ["English", "English_PassionateWarrior", "Passionate Warrior"],
  ["English", "English_WiseScholar", "Wise Scholar"],
  ["English", "English_Soft-spokenGirl", "Soft-Spoken Girl"],
  ["English", "English_SereneWoman", "Serene Woman"],
  ["English", "English_ConfidentWoman", "Confident Woman"],
  ["English", "English_PatientMan", "Patient Man"],
  ["English", "English_Comedian", "Comedian"],
  ["English", "English_BossyLeader", "Bossy Leader"],
  ["English", "English_Strong-WilledBoy", "Strong-Willed Boy"],
  ["English", "English_StressedLady", "Stressed Lady"],
  ["English", "English_AssertiveQueen", "Assertive Queen"],
  ["English", "English_AnimeCharacter", "Female Narrator"],
  ["English", "English_Jovialman", "Jovial Man"],
  ["English", "English_WhimsicalGirl", "Whimsical Girl"],
  ["English", "English_Kind-heartedGirl", "Kind-Hearted Girl"],
  [
    "Chinese (Mandarin)",
    "Chinese (Mandarin)_Reliable_Executive",
    "Reliable Executive",
  ],
  ["Chinese (Mandarin)", "Chinese (Mandarin)_News_Anchor", "News Anchor"],
  [
    "Chinese (Mandarin)",
    "Chinese (Mandarin)_Unrestrained_Young_Man",
    "Unrestrained Young Man",
  ],
  ["Chinese (Mandarin)", "Chinese (Mandarin)_Mature_Woman", "Mature Woman"],
  ["Chinese (Mandarin)", "Arrogant_Miss", "Arrogant Miss"],
  ["Chinese (Mandarin)", "Robot_Armor", "Robot Armor"],
  [
    "Chinese (Mandarin)",
    "Chinese (Mandarin)_Kind-hearted_Antie",
    "Kind-hearted Antie",
  ],
  [
    "Chinese (Mandarin)",
    "Chinese (Mandarin)_HK_Flight_Attendant",
    "HK Flight Attendant",
  ],
  ["Chinese (Mandarin)", "Chinese (Mandarin)_Humorous_Elder", "Humorous Elder"],
  ["Chinese (Mandarin)", "Chinese (Mandarin)_Gentleman", "Gentleman"],
  ["Chinese (Mandarin)", "Chinese (Mandarin)_Warm_Bestie", "Warm Bestie"],
  [
    "Chinese (Mandarin)",
    "Chinese (Mandarin)_Stubborn_Friend",
    "Stubborn Friend",
  ],
  ["Chinese (Mandarin)", "Chinese (Mandarin)_Sweet_Lady", "Sweet Lady"],
  [
    "Chinese (Mandarin)",
    "Chinese (Mandarin)_Southern_Young_Man",
    "Southern Young Man",
  ],
  ["Chinese (Mandarin)", "Chinese (Mandarin)_Wise_Women", "Wise Women"],
  ["Chinese (Mandarin)", "Chinese (Mandarin)_Gentle_Youth", "Gentle Youth"],
  ["Chinese (Mandarin)", "Chinese (Mandarin)_Warm_Girl", "Warm Girl"],
  ["Chinese (Mandarin)", "Chinese (Mandarin)_Male_Announcer", "Male Announcer"],
  [
    "Chinese (Mandarin)",
    "Chinese (Mandarin)_Kind-hearted_Elder",
    "Kind-hearted Elder",
  ],
  ["Chinese (Mandarin)", "Chinese (Mandarin)_Cute_Spirit", "Cute Spirit"],
  ["Chinese (Mandarin)", "Chinese (Mandarin)_Radio_Host", "Radio Host"],
  ["Chinese (Mandarin)", "Chinese (Mandarin)_Lyrical_Voice", "Lyrical Voice"],
  [
    "Chinese (Mandarin)",
    "Chinese (Mandarin)_Straightforward_Boy",
    "Straightforward Boy",
  ],
  ["Chinese (Mandarin)", "Chinese (Mandarin)_Sincere_Adult", "Sincere Adult"],
  ["Chinese (Mandarin)", "Chinese (Mandarin)_Gentle_Senior", "Gentle Senior"],
  ["Chinese (Mandarin)", "Chinese (Mandarin)_Crisp_Girl", "Crisp Girl"],
  [
    "Chinese (Mandarin)",
    "Chinese (Mandarin)_Pure-hearted_Boy",
    "Pure-hearted Boy",
  ],
  ["Chinese (Mandarin)", "Chinese (Mandarin)_Soft_Girl", "Soft Girl"],
  [
    "Chinese (Mandarin)",
    "Chinese (Mandarin)_IntellectualGirl",
    "Intellectual Girl",
  ],
  [
    "Chinese (Mandarin)",
    "Chinese (Mandarin)_Warm_HeartedGirl",
    "Warm-hearted Girl",
  ],
  ["Chinese (Mandarin)", "Chinese (Mandarin)_Laid_BackGirl", "Laid-back Girl"],
  [
    "Chinese (Mandarin)",
    "Chinese (Mandarin)_ExplorativeGirl",
    "Explorative Girl",
  ],
  [
    "Chinese (Mandarin)",
    "Chinese (Mandarin)_Warm-HeartedAunt",
    "Warm-hearted Aunt",
  ],
  ["Chinese (Mandarin)", "Chinese (Mandarin)_BashfulGirl", "Bashful Girl"],
  ["Japanese", "Japanese_IntellectualSenior", "Intellectual Senior"],
  ["Japanese", "Japanese_DecisivePrincess", "Decisive Princess"],
  ["Japanese", "Japanese_LoyalKnight", "Loyal Knight"],
  ["Japanese", "Japanese_DominantMan", "Dominant Man"],
  ["Japanese", "Japanese_SeriousCommander", "Serious Commander"],
  ["Japanese", "Japanese_ColdQueen", "Cold Queen"],
  ["Japanese", "Japanese_DependableWoman", "Dependable Woman"],
  ["Japanese", "Japanese_GentleButler", "Gentle Butler"],
  ["Japanese", "Japanese_KindLady", "Kind Lady"],
  ["Japanese", "Japanese_CalmLady", "Calm Lady"],
  ["Japanese", "Japanese_OptimisticYouth", "Optimistic Youth"],
  ["Japanese", "Japanese_GenerousIzakayaOwner", "Generous Izakaya Owner"],
  ["Japanese", "Japanese_SportyStudent", "Sporty Student"],
  ["Japanese", "Japanese_InnocentBoy", "Innocent Boy"],
  ["Japanese", "Japanese_GracefulMaiden", "Graceful Maiden"],
  ["Cantonese", "Cantonese_ProfessionalHost (F)", "Professional Female Host"],
  ["Cantonese", "Cantonese_GentleLady", "Gentle Lady"],
  ["Cantonese", "Cantonese_ProfessionalHost (M)", "Professional Male Host"],
  ["Cantonese", "Cantonese_PlayfulMan", "Playful Man"],
  ["Cantonese", "Cantonese_CuteGirl", "Cute Girl"],
  ["Cantonese", "Cantonese_KindWoman", "Kind Woman"],
  ["Korean", "Korean_AirheadedGirl", "Airheaded Girl"],
  ["Korean", "Korean_AthleticGirl", "Athletic Girl"],
  ["Korean", "Korean_AthleticStudent", "Athletic Student"],
  ["Korean", "Korean_BraveAdventurer", "Brave Adventurer"],
  ["Korean", "Korean_BraveFemaleWarrior", "Brave Female Warrior"],
  ["Korean", "Korean_BraveYouth", "Brave Youth"],
  ["Korean", "Korean_CalmGentleman", "Calm Gentleman"],
  ["Korean", "Korean_CalmLady", "Calm Lady"],
  ["Korean", "Korean_CaringWoman", "Caring Woman"],
  ["Korean", "Korean_CharmingElderSister", "Charming Elder Sister"],
  ["Korean", "Korean_CharmingSister", "Charming Sister"],
  ["Korean", "Korean_CheerfulBoyfriend", "Cheerful Boyfriend"],
  ["Korean", "Korean_CheerfulCoolJunior", "Cheerful Cool Junior"],
  ["Korean", "Korean_CheerfulLittleSister", "Cheerful Little Sister"],
  ["Korean", "Korean_ChildhoodFriendGirl", "Childhood Friend Girl"],
  ["Korean", "Korean_CockyGuy", "Cocky Guy"],
  ["Korean", "Korean_ColdGirl", "Cold Girl"],
  ["Korean", "Korean_ColdYoungMan", "Cold Young Man"],
  ["Korean", "Korean_ConfidentBoss", "Confident Boss"],
  ["Korean", "Korean_ConsiderateSenior", "Considerate Senior"],
  ["Korean", "Korean_DecisiveQueen", "Decisive Queen"],
  ["Korean", "Korean_DominantMan", "Dominant Man"],
  ["Korean", "Korean_ElegantPrincess", "Elegant Princess"],
  ["Korean", "Korean_EnchantingSister", "Enchanting Sister"],
  ["Korean", "Korean_EnthusiasticTeen", "Enthusiastic Teen"],
  ["Korean", "Korean_FriendlyBigSister", "Friendly Big Sister"],
  ["Korean", "Korean_GentleBoss", "Gentle Boss"],
  ["Korean", "Korean_GentleWoman", "Gentle Woman"],
  ["Korean", "Korean_HaughtyLady", "Haughty Lady"],
  ["Korean", "Korean_InnocentBoy", "Innocent Boy"],
  ["Korean", "Korean_IntellectualMan", "Intellectual Man"],
  ["Korean", "Korean_IntellectualSenior", "Intellectual Senior"],
  ["Korean", "Korean_LonelyWarrior", "Lonely Warrior"],
  ["Korean", "Korean_MatureLady", "Mature Lady"],
  ["Korean", "Korean_MysteriousGirl", "Mysterious Girl"],
  ["Korean", "Korean_OptimisticYouth", "Optimistic Youth"],
  ["Korean", "Korean_PlayboyCharmer", "Playboy Charmer"],
  ["Korean", "Korean_PossessiveMan", "Possessive Man"],
  ["Korean", "Korean_QuirkyGirl", "Quirky Girl"],
  ["Korean", "Korean_ReliableSister", "Reliable Sister"],
  ["Korean", "Korean_ReliableYouth", "Reliable Youth"],
  ["Korean", "Korean_SassyGirl", "Sassy Girl"],
  ["Korean", "Korean_ShyGirl", "Shy Girl"],
  ["Korean", "Korean_SoothingLady", "Soothing Lady"],
  ["Korean", "Korean_StrictBoss", "Strict Boss"],
  ["Korean", "Korean_SweetGirl", "Sweet Girl"],
  ["Korean", "Korean_ThoughtfulWoman", "Thoughtful Woman"],
  ["Korean", "Korean_WiseElf", "Wise Elf"],
  ["Korean", "Korean_WiseTeacher", "Wise Teacher"],
  ["Spanish", "Spanish_SereneWoman", "Serene Woman"],
  ["Spanish", "Spanish_MaturePartner", "Mature Partner"],
  ["Spanish", "Spanish_CaptivatingStoryteller", "Captivating Storyteller"],
  ["Spanish", "Spanish_Narrator", "Narrator"],
  ["Spanish", "Spanish_WiseScholar", "Wise Scholar"],
  ["Spanish", "Spanish_Kind-heartedGirl", "Kind-hearted Girl"],
  ["Spanish", "Spanish_DeterminedManager", "Determined Manager"],
  ["Spanish", "Spanish_BossyLeader", "Bossy Leader"],
  ["Spanish", "Spanish_ReservedYoungMan", "Reserved Young Man"],
  ["Spanish", "Spanish_ConfidentWoman", "Confident Woman"],
  ["Spanish", "Spanish_ThoughtfulMan", "Thoughtful Man"],
  ["Spanish", "Spanish_Strong-WilledBoy", "Strong-willed Boy"],
  ["Spanish", "Spanish_SophisticatedLady", "Sophisticated Lady"],
  ["Spanish", "Spanish_RationalMan", "Rational Man"],
  ["Spanish", "Spanish_AnimeCharacter", "Anime Character"],
  ["Spanish", "Spanish_Deep-tonedMan", "Deep-toned Man"],
  ["Spanish", "Spanish_Fussyhostess", "Fussy hostess"],
  ["Spanish", "Spanish_SincereTeen", "Sincere Teen"],
  ["Spanish", "Spanish_FrankLady", "Frank Lady"],
  ["Spanish", "Spanish_Comedian", "Comedian"],
  ["Spanish", "Spanish_Debator", "Debator"],
  ["Spanish", "Spanish_ToughBoss", "Tough Boss"],
  ["Spanish", "Spanish_Wiselady", "Wise Lady"],
  ["Spanish", "Spanish_Steadymentor", "Steady Mentor"],
  ["Spanish", "Spanish_Jovialman", "Jovial Man"],
  ["Spanish", "Spanish_SantaClaus", "Santa Claus"],
  ["Spanish", "Spanish_Rudolph", "Rudolph"],
  ["Spanish", "Spanish_Intonategirl", "Intonate Girl"],
  ["Spanish", "Spanish_Arnold", "Arnold"],
  ["Spanish", "Spanish_Ghost", "Ghost"],
  ["Spanish", "Spanish_HumorousElder", "Humorous Elder"],
  ["Spanish", "Spanish_EnergeticBoy", "Energetic Boy"],
  ["Spanish", "Spanish_WhimsicalGirl", "Whimsical Girl"],
  ["Spanish", "Spanish_StrictBoss", "Strict Boss"],
  ["Spanish", "Spanish_ReliableMan", "Reliable Man"],
  ["Spanish", "Spanish_SereneElder", "Serene Elder"],
  ["Spanish", "Spanish_AngryMan", "Angry Man"],
  ["Spanish", "Spanish_AssertiveQueen", "Assertive Queen"],
  ["Spanish", "Spanish_CaringGirlfriend", "Caring Girlfriend"],
  ["Spanish", "Spanish_PowerfulSoldier", "Powerful Soldier"],
  ["Spanish", "Spanish_PassionateWarrior", "Passionate Warrior"],
  ["Spanish", "Spanish_ChattyGirl", "Chatty Girl"],
  ["Spanish", "Spanish_RomanticHusband", "Romantic Husband"],
  ["Spanish", "Spanish_CompellingGirl", "Compelling Girl"],
  ["Spanish", "Spanish_PowerfulVeteran", "Powerful Veteran"],
  ["Spanish", "Spanish_SensibleManager", "Sensible Manager"],
  ["Spanish", "Spanish_ThoughtfulLady", "Thoughtful Lady"],
  ["Portuguese", "Portuguese_SentimentalLady", "Sentimental Lady"],
  ["Portuguese", "Portuguese_BossyLeader", "Bossy Leader"],
  ["Portuguese", "Portuguese_Wiselady", "Wise lady"],
  ["Portuguese", "Portuguese_Strong-WilledBoy", "Strong-willed Boy"],
  ["Portuguese", "Portuguese_Deep-VoicedGentleman", "Deep-voiced Gentleman"],
  ["Portuguese", "Portuguese_UpsetGirl", "Upset Girl"],
  ["Portuguese", "Portuguese_PassionateWarrior", "Passionate Warrior"],
  ["Portuguese", "Portuguese_AnimeCharacter", "Anime Character"],
  ["Portuguese", "Portuguese_ConfidentWoman", "Confident Woman"],
  ["Portuguese", "Portuguese_AngryMan", "Angry Man"],
  [
    "Portuguese",
    "Portuguese_CaptivatingStoryteller",
    "Captivating Storyteller",
  ],
  ["Portuguese", "Portuguese_Godfather", "Godfather"],
  ["Portuguese", "Portuguese_ReservedYoungMan", "Reserved Young Man"],
  ["Portuguese", "Portuguese_SmartYoungGirl", "Smart Young Girl"],
  ["Portuguese", "Portuguese_Kind-heartedGirl", "Kind-hearted Girl"],
  ["Portuguese", "Portuguese_Pompouslady", "Pompous lady"],
  ["Portuguese", "Portuguese_Grinch", "Grinch"],
  ["Portuguese", "Portuguese_Debator", "Debator"],
  ["Portuguese", "Portuguese_SweetGirl", "Sweet Girl"],
  ["Portuguese", "Portuguese_AttractiveGirl", "Attractive Girl"],
  ["Portuguese", "Portuguese_ThoughtfulMan", "Thoughtful Man"],
  ["Portuguese", "Portuguese_PlayfulGirl", "Playful Girl"],
  ["Portuguese", "Portuguese_GorgeousLady", "Gorgeous Lady"],
  ["Portuguese", "Portuguese_LovelyLady", "Lovely Lady"],
  ["Portuguese", "Portuguese_SereneWoman", "Serene Woman"],
  ["Portuguese", "Portuguese_SadTeen", "Sad Teen"],
  ["Portuguese", "Portuguese_MaturePartner", "Mature Partner"],
  ["Portuguese", "Portuguese_Comedian", "Comedian"],
  ["Portuguese", "Portuguese_NaughtySchoolgirl", "Naughty Schoolgirl"],
  ["Portuguese", "Portuguese_Narrator", "Narrator"],
  ["Portuguese", "Portuguese_ToughBoss", "Tough Boss"],
  ["Portuguese", "Portuguese_Fussyhostess", "Fussy hostess"],
  ["Portuguese", "Portuguese_Dramatist", "Dramatist"],
  ["Portuguese", "Portuguese_Steadymentor", "Steady Mentor"],
  ["Portuguese", "Portuguese_Jovialman", "Jovial Man"],
  ["Portuguese", "Portuguese_CharmingQueen", "Charming Queen"],
  ["Portuguese", "Portuguese_SantaClaus", "Santa Claus"],
  ["Portuguese", "Portuguese_Rudolph", "Rudolph"],
  ["Portuguese", "Portuguese_Arnold", "Arnold"],
  ["Portuguese", "Portuguese_CharmingSanta", "Charming Santa"],
  ["Portuguese", "Portuguese_CharmingLady", "Charming Lady"],
  ["Portuguese", "Portuguese_Ghost", "Ghost"],
  ["Portuguese", "Portuguese_HumorousElder", "Humorous Elder"],
  ["Portuguese", "Portuguese_CalmLeader", "Calm Leader"],
  ["Portuguese", "Portuguese_GentleTeacher", "Gentle Teacher"],
  ["Portuguese", "Portuguese_EnergeticBoy", "Energetic Boy"],
  ["Portuguese", "Portuguese_ReliableMan", "Reliable Man"],
  ["Portuguese", "Portuguese_SereneElder", "Serene Elder"],
  ["Portuguese", "Portuguese_GrimReaper", "Grim Reaper"],
  ["Portuguese", "Portuguese_AssertiveQueen", "Assertive Queen"],
  ["Portuguese", "Portuguese_WhimsicalGirl", "Whimsical Girl"],
  ["Portuguese", "Portuguese_StressedLady", "Stressed Lady"],
  ["Portuguese", "Portuguese_FriendlyNeighbor", "Friendly Neighbor"],
  ["Portuguese", "Portuguese_CaringGirlfriend", "Caring Girlfriend"],
  ["Portuguese", "Portuguese_PowerfulSoldier", "Powerful Soldier"],
  ["Portuguese", "Portuguese_FascinatingBoy", "Fascinating Boy"],
  ["Portuguese", "Portuguese_RomanticHusband", "Romantic Husband"],
  ["Portuguese", "Portuguese_StrictBoss", "Strict Boss"],
  ["Portuguese", "Portuguese_InspiringLady", "Inspiring Lady"],
  ["Portuguese", "Portuguese_PlayfulSpirit", "Playful Spirit"],
  ["Portuguese", "Portuguese_ElegantGirl", "Elegant Girl"],
  ["Portuguese", "Portuguese_CompellingGirl", "Compelling Girl"],
  ["Portuguese", "Portuguese_PowerfulVeteran", "Powerful Veteran"],
  ["Portuguese", "Portuguese_SensibleManager", "Sensible Manager"],
  ["Portuguese", "Portuguese_ThoughtfulLady", "Thoughtful Lady"],
  ["Portuguese", "Portuguese_TheatricalActor", "Theatrical Actor"],
  ["Portuguese", "Portuguese_FragileBoy", "Fragile Boy"],
  ["Portuguese", "Portuguese_ChattyGirl", "Chatty Girl"],
  [
    "Portuguese",
    "Portuguese_Conscientiousinstructor",
    "Conscientious Instructor",
  ],
  ["Portuguese", "Portuguese_RationalMan", "Rational Man"],
  ["Portuguese", "Portuguese_WiseScholar", "Wise Scholar"],
  ["Portuguese", "Portuguese_FrankLady", "Frank Lady"],
  ["Portuguese", "Portuguese_DeterminedManager", "Determined Manager"],
  ["French", "French_Male_Speech_New", "Level-Headed Man"],
  ["French", "French_Female_News Anchor", "Patient Female Presenter"],
  ["French", "French_CasualMan", "Casual Man"],
  ["French", "French_MovieLeadFemale", "Movie Lead Female"],
  ["French", "French_FemaleAnchor", "Female Anchor"],
  ["French", "French_MaleNarrator", "Male Narrator"],
  ["Indonesian", "Indonesian_SweetGirl", "Sweet Girl"],
  ["Indonesian", "Indonesian_ReservedYoungMan", "Reserved Young Man"],
  ["Indonesian", "Indonesian_CharmingGirl", "Charming Girl"],
  ["Indonesian", "Indonesian_CalmWoman", "Calm Woman"],
  ["Indonesian", "Indonesian_ConfidentWoman", "Confident Woman"],
  ["Indonesian", "Indonesian_CaringMan", "Caring Man"],
  ["Indonesian", "Indonesian_BossyLeader", "Bossy Leader"],
  ["Indonesian", "Indonesian_DeterminedBoy", "Determined Boy"],
  ["Indonesian", "Indonesian_GentleGirl", "Gentle Girl"],
  ["German", "German_FriendlyMan", "Friendly Man"],
  ["German", "German_SweetLady", "Sweet Lady"],
  ["German", "German_PlayfulMan", "Playful Man"],
  ["Russian", "Russian_HandsomeChildhoodFriend", "Handsome Childhood Friend"],
  ["Russian", "Russian_BrightHeroine", "Bright Queen"],
  ["Russian", "Russian_AmbitiousWoman", "Ambitious Woman"],
  ["Russian", "Russian_ReliableMan", "Reliable Man"],
  ["Russian", "Russian_CrazyQueen", "Crazy Girl"],
  ["Russian", "Russian_PessimisticGirl", "Pessimistic Girl"],
  ["Russian", "Russian_AttractiveGuy", "Attractive Guy"],
  ["Russian", "Russian_Bad-temperedBoy", "Bad-tempered Boy"],
  ["Italian", "Italian_BraveHeroine", "Brave Heroine"],
  ["Italian", "Italian_Narrator", "Narrator"],
  ["Italian", "Italian_WanderingSorcerer", "Wandering Sorcerer"],
  ["Italian", "Italian_DiligentLeader", "Diligent Leader"],
  ["Dutch", "Dutch_kindhearted_girl", "Kind-hearted girl"],
  ["Dutch", "Dutch_bossy_leader", "Bossy leader"],
  ["Vietnamese", "Vietnamese_kindhearted_girl", "Kind-hearted girl"],
  ["Arabic", "Arabic_CalmWoman", "Calm Woman"],
  ["Arabic", "Arabic_FriendlyGuy", "Friendly Guy"],
  ["Turkish", "Turkish_CalmWoman", "Calm Woman"],
  ["Turkish", "Turkish_Trustworthyman", "Trustworthy man"],
  ["Ukrainian", "Ukrainian_CalmWoman", "Calm Woman"],
  ["Ukrainian", "Ukrainian_WiseScholar", "Wise Scholar"],
  ["Thai", "Thai_male_1_sample8", "Serene Man"],
  ["Thai", "Thai_male_2_sample2", "Friendly Man"],
  ["Thai", "Thai_female_1_sample1", "Confident Woman"],
  ["Thai", "Thai_female_2_sample2", "Energetic Woman"],
  ["Polish", "Polish_male_1_sample4", "Male Narrator"],
  ["Polish", "Polish_male_2_sample3", "Male Anchor"],
  ["Polish", "Polish_female_1_sample1", "Calm Woman"],
  ["Polish", "Polish_female_2_sample3", "Casual Woman"],
  ["Romanian", "Romanian_male_1_sample2", "Reliable Man"],
  ["Romanian", "Romanian_male_2_sample1", "Energetic Youth"],
  ["Romanian", "Romanian_female_1_sample4", "Optimistic Youth"],
  ["Romanian", "Romanian_female_2_sample1", "Gentle Woman"],
  ["Greek", "greek_male_1a_v1", "Thoughtful Mentor"],
  ["Greek", "Greek_female_1_sample1", "Gentle Lady"],
  ["Greek", "Greek_female_2_sample3", "Girl Next Door"],
  ["Czech", "czech_male_1_v1", "Assured Presenter"],
  ["Czech", "czech_female_5_v7", "Steadfast Narrator"],
  ["Czech", "czech_female_2_v2", "Elegant Lady"],
  ["Finnish", "finnish_male_3_v1", "Upbeat Man"],
  ["Finnish", "finnish_male_1_v2", "Friendly Boy"],
  ["Finnish", "finnish_female_4_v1", "Assetive Woman"],
  ["Hindi", "hindi_male_1_v2", "Trustworthy Advisor"],
  ["Hindi", "hindi_female_2_v1", "Tranquil Woman"],
  ["Hindi", "hindi_female_1_v2", "News Anchor"],
];
export const VOICE_CATALOG: readonly VoiceDefinition[] = documentedVoices.map(
  ([language, id, name]) => ({ id, name, language, tags: voiceTags(name) })
);
export const VOICE_LANGUAGES = [
  ...new Set(VOICE_CATALOG.map(voice => voice.language)),
].sort();
export const VOICE_TAGS = [
  ...new Set(VOICE_CATALOG.flatMap(voice => voice.tags)),
].sort();
export function findVoice(id: string): VoiceDefinition | undefined {
  return VOICE_CATALOG.find(voice => voice.id === id);
}
export function filterVoices(
  query = "",
  language = "all",
  tag = "all"
): VoiceDefinition[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return VOICE_CATALOG.filter(
    voice =>
      (language === "all" || voice.language === language) &&
      (tag === "all" || voice.tags.includes(tag)) &&
      words.every(word =>
        `${voice.name} ${voice.language} ${voice.tags.join(" ")}`
          .toLocaleLowerCase()
          .includes(word)
      )
  );
}

const previewByLanguage: Record<string, string> = {
  English:
    "Every story starts with an idea. Let's find the right voice to bring yours to life.",
  Italian:
    "Ogni storia inizia con un'idea. Troviamo la voce giusta per darle vita.",
  French:
    "Chaque histoire commence par une idée. Trouvons la bonne voix pour lui donner vie.",
  German:
    "Jede Geschichte beginnt mit einer Idee. Finden wir die richtige Stimme, um sie zum Leben zu erwecken.",
  Spanish:
    "Cada historia empieza con una idea. Encontremos la voz adecuada para darle vida.",
  Portuguese:
    "Toda história começa com uma ideia. Vamos encontrar a voz certa para dar vida à sua.",
  "Chinese (Mandarin)":
    "每一个故事都从一个想法开始。让我们找到合适的声音，让你的故事生动起来。",
  Cantonese:
    "每個故事都由一個諗法開始。等我哋搵到啱嘅聲音，令你嘅故事變得生動。",
  Japanese:
    "すべての物語はひとつのアイデアから始まります。あなたの物語にぴったりの声を見つけましょう。",
  Korean:
    "모든 이야기는 하나의 생각에서 시작됩니다. 여러분의 이야기에 생명을 불어넣을 목소리를 찾아보세요.",
  Indonesian:
    "Setiap cerita dimulai dari sebuah ide. Mari temukan suara yang tepat untuk menghidupkannya.",
  Russian:
    "Каждая история начинается с идеи. Давайте найдём голос, который поможет ей ожить.",
  Dutch:
    "Elk verhaal begint met een idee. Laten we de juiste stem vinden om het tot leven te brengen.",
  Vietnamese:
    "Mỗi câu chuyện bắt đầu từ một ý tưởng. Hãy tìm giọng nói phù hợp để khiến câu chuyện sống động hơn.",
  Arabic: "تبدأ كل قصة بفكرة. لنجد الصوت المناسب الذي يمنح قصتك الحياة.",
  Turkish:
    "Her hikâye bir fikirle başlar. Hikâyenize hayat verecek doğru sesi birlikte bulalım.",
  Ukrainian:
    "Кожна історія починається з ідеї. Знайдімо голос, який допоможе їй ожити.",
  Thai: "ทุกเรื่องราวเริ่มต้นจากความคิด มาค้นหาเสียงที่เหมาะสมเพื่อทำให้เรื่องราวของคุณมีชีวิตชีวา",
  Polish:
    "Każda historia zaczyna się od pomysłu. Znajdźmy głos, który nada jej życie.",
  Romanian:
    "Fiecare poveste începe cu o idee. Să găsim vocea potrivită pentru a-i da viață.",
  Greek:
    "Κάθε ιστορία ξεκινά με μια ιδέα. Ας βρούμε τη σωστή φωνή για να της δώσουμε ζωή.",
  Czech:
    "Každý příběh začíná nápadem. Najděme ten správný hlas, který mu vdechne život.",
  Finnish:
    "Jokainen tarina alkaa ideasta. Etsitään oikea ääni herättämään se eloon.",
  Hindi:
    "हर कहानी एक विचार से शुरू होती है। आइए आपकी कहानी में जान डालने के लिए सही आवाज़ खोजें।",
};

// Preserve existing preview text so previously cached samples remain reusable.
const legacyPreviews: Record<string, string> = {
  English_Graceful_Lady:
    "A small idea can become a story worth sharing. Let us make yours clear, confident, and memorable.",
  English_CalmWoman:
    "A small idea can become a story worth sharing. Let us make yours clear, confident, and memorable.",
  English_Trustworth_Man:
    "A small idea can become a story worth sharing. Let us make yours clear, confident, and memorable.",
  English_Diligent_Man:
    "A small idea can become a story worth sharing. Let us make yours clear, confident, and memorable.",
  Italian_Narrator:
    "Una piccola idea può diventare una storia da condividere. Rendiamo la tua chiara, autentica e memorabile.",
  Italian_BraveHeroine:
    "Una piccola idea può diventare una storia da condividere. Rendiamo la tua chiara, autentica e memorabile.",
  French_MaleNarrator:
    "Une petite idée peut devenir une histoire à partager. Rendons la vôtre claire, authentique et mémorable.",
  German_FriendlyMan:
    "Eine kleine Idee kann zu einer Geschichte werden. Machen wir deine Geschichte klar, authentisch und unvergesslich.",
};

export const VOICE_PREVIEWS: Record<string, string> = Object.fromEntries(
  VOICE_CATALOG.map(voice => [
    voice.id,
    legacyPreviews[voice.id] ?? previewByLanguage[voice.language],
  ])
);
