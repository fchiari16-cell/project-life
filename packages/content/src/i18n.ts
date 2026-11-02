/**
 * User-interface localisation pack (M5).
 *
 * STATUS: Italian (the source language) is complete. The other 19 languages cover only the CORE interface
 * (navigation, main actions, statistics, settings) and were produced with machine assistance: they have NOT
 * been reviewed by native speakers and must not be presented as professional localisations.
 * Everything not listed here (events, professions, most screens) falls back to Italian.
 */
export type LocaleCode =
  | 'it' | 'es' | 'en' | 'fr' | 'de' | 'pt' | 'ja' | 'zh' | 'ko' | 'ar'
  | 'hi' | 'ru' | 'tr' | 'id' | 'nl' | 'pl' | 'sv' | 'th' | 'vi' | 'el';

export interface LocaleInfo {
  code: LocaleCode;
  /** Name in its own language. */
  native: string;
  /** BCP 47 tag for Intl formatting. */
  tag: string;
  dir: 'ltr' | 'rtl';
  /** `source` = written by the authors; `machine-unverified` = machine-assisted, not reviewed by native speakers. */
  status: 'source' | 'machine-unverified';
}

export const LOCALES: readonly LocaleInfo[] = [
  { code: 'it', native: 'Italiano', tag: 'it-IT', dir: 'ltr', status: 'source' },
  { code: 'es', native: 'Español', tag: 'es-ES', dir: 'ltr', status: 'machine-unverified' },
  { code: 'en', native: 'English', tag: 'en-GB', dir: 'ltr', status: 'machine-unverified' },
  { code: 'fr', native: 'Français', tag: 'fr-FR', dir: 'ltr', status: 'machine-unverified' },
  { code: 'de', native: 'Deutsch', tag: 'de-DE', dir: 'ltr', status: 'machine-unverified' },
  { code: 'pt', native: 'Português', tag: 'pt-PT', dir: 'ltr', status: 'machine-unverified' },
  { code: 'ja', native: '日本語', tag: 'ja-JP', dir: 'ltr', status: 'machine-unverified' },
  { code: 'zh', native: '简体中文', tag: 'zh-CN', dir: 'ltr', status: 'machine-unverified' },
  { code: 'ko', native: '한국어', tag: 'ko-KR', dir: 'ltr', status: 'machine-unverified' },
  { code: 'ar', native: 'العربية', tag: 'ar', dir: 'rtl', status: 'machine-unverified' },
  { code: 'hi', native: 'हिन्दी', tag: 'hi-IN', dir: 'ltr', status: 'machine-unverified' },
  { code: 'ru', native: 'Русский', tag: 'ru-RU', dir: 'ltr', status: 'machine-unverified' },
  { code: 'tr', native: 'Türkçe', tag: 'tr-TR', dir: 'ltr', status: 'machine-unverified' },
  { code: 'id', native: 'Bahasa Indonesia', tag: 'id-ID', dir: 'ltr', status: 'machine-unverified' },
  { code: 'nl', native: 'Nederlands', tag: 'nl-NL', dir: 'ltr', status: 'machine-unverified' },
  { code: 'pl', native: 'Polski', tag: 'pl-PL', dir: 'ltr', status: 'machine-unverified' },
  { code: 'sv', native: 'Svenska', tag: 'sv-SE', dir: 'ltr', status: 'machine-unverified' },
  { code: 'th', native: 'ไทย', tag: 'th-TH', dir: 'ltr', status: 'machine-unverified' },
  { code: 'vi', native: 'Tiếng Việt', tag: 'vi-VN', dir: 'ltr', status: 'machine-unverified' },
  { code: 'el', native: 'Ελληνικά', tag: 'el-GR', dir: 'ltr', status: 'machine-unverified' },
];

/** Paths into the UI string table (`apps/web/src/i18n/it.ts`), in the order used by every language row below. */
export const CORE_KEYS = [
  'nav.life', 'nav.relationships', 'nav.career', 'nav.finance', 'nav.more',
  'life.newLifeTitle', 'life.givenName', 'life.familyName', 'life.country', 'life.randomCountry', 'life.create',
  'life.savedLives', 'life.open', 'life.delete', 'life.advance', 'life.age', 'life.stats', 'life.recent',
  'life.money', 'life.cash', 'life.debt', 'life.netWorth', 'life.ended', 'life.closeLife',
  'stats.health', 'stats.happiness', 'stats.intelligence', 'stats.appearance', 'stats.energy', 'stats.stress', 'stats.charisma', 'stats.fitness',
  'dynasty.continueTitle', 'dynasty.continue',
  'more.settings', 'more.theme', 'more.themeSystem', 'more.themeLight', 'more.themeDark', 'more.language', 'more.about',
  'errors.title', 'errors.dismiss', 'world.title', 'society.title', 'finance.balances', 'career.job', 'career.education',
] as const;
export type CoreKey = (typeof CORE_KEYS)[number];

type Row = readonly string[];

const rows: Record<LocaleCode, Row> = {
  it: ['Vita', 'Relazioni', 'Carriera', 'Finanze', 'Altro', 'Nuova vita', 'Nome', 'Cognome', 'Paese di nascita', 'Casuale', 'Nasci', 'Vite salvate', 'Apri', 'Elimina', 'Avanza di un anno', 'Età', 'Statistiche', 'Eventi recenti', 'Situazione economica', 'Contanti', 'Debiti', 'Patrimonio netto', 'La vita è finita', 'Torna alle vite salvate', 'Salute', 'Felicità', 'Intelligenza', 'Aspetto', 'Energia', 'Stress', 'Carisma', 'Fitness', 'Continua la dinastia', 'Nasce la nuova generazione', 'Impostazioni', 'Tema', 'Sistema', 'Chiaro', 'Scuro', 'Lingua', 'Informazioni', 'Qualcosa è andato storto', 'Chiudi', 'Mondo', 'Società', 'Saldi', 'Lavoro', 'Istruzione'],
  en: ['Life', 'Relationships', 'Career', 'Finances', 'More', 'New life', 'First name', 'Surname', 'Country of birth', 'Random', 'Be born', 'Saved lives', 'Open', 'Delete', 'Advance one year', 'Age', 'Statistics', 'Recent events', 'Financial situation', 'Cash', 'Debts', 'Net worth', 'The life is over', 'Back to saved lives', 'Health', 'Happiness', 'Intelligence', 'Appearance', 'Energy', 'Stress', 'Charisma', 'Fitness', 'Continue the dynasty', 'A new generation is born', 'Settings', 'Theme', 'System', 'Light', 'Dark', 'Language', 'About', 'Something went wrong', 'Close', 'World', 'Society', 'Balances', 'Job', 'Education'],
  es: ['Vida', 'Relaciones', 'Carrera', 'Finanzas', 'Más', 'Nueva vida', 'Nombre', 'Apellido', 'País de nacimiento', 'Aleatorio', 'Nacer', 'Vidas guardadas', 'Abrir', 'Eliminar', 'Avanzar un año', 'Edad', 'Estadísticas', 'Eventos recientes', 'Situación económica', 'Efectivo', 'Deudas', 'Patrimonio neto', 'La vida ha terminado', 'Volver a las vidas guardadas', 'Salud', 'Felicidad', 'Inteligencia', 'Aspecto', 'Energía', 'Estrés', 'Carisma', 'Forma física', 'Continuar la dinastía', 'Nace la nueva generación', 'Ajustes', 'Tema', 'Sistema', 'Claro', 'Oscuro', 'Idioma', 'Información', 'Algo salió mal', 'Cerrar', 'Mundo', 'Sociedad', 'Saldos', 'Trabajo', 'Educación'],
  fr: ['Vie', 'Relations', 'Carrière', 'Finances', 'Plus', 'Nouvelle vie', 'Prénom', 'Nom', 'Pays de naissance', 'Aléatoire', 'Naître', 'Vies enregistrées', 'Ouvrir', 'Supprimer', 'Avancer d’un an', 'Âge', 'Statistiques', 'Événements récents', 'Situation financière', 'Espèces', 'Dettes', 'Patrimoine net', 'La vie est terminée', 'Retour aux vies enregistrées', 'Santé', 'Bonheur', 'Intelligence', 'Apparence', 'Énergie', 'Stress', 'Charisme', 'Forme physique', 'Poursuivre la dynastie', 'Une nouvelle génération naît', 'Paramètres', 'Thème', 'Système', 'Clair', 'Sombre', 'Langue', 'À propos', 'Un problème est survenu', 'Fermer', 'Monde', 'Société', 'Soldes', 'Emploi', 'Éducation'],
  de: ['Leben', 'Beziehungen', 'Karriere', 'Finanzen', 'Mehr', 'Neues Leben', 'Vorname', 'Nachname', 'Geburtsland', 'Zufällig', 'Geboren werden', 'Gespeicherte Leben', 'Öffnen', 'Löschen', 'Ein Jahr weiter', 'Alter', 'Statistiken', 'Letzte Ereignisse', 'Finanzielle Lage', 'Bargeld', 'Schulden', 'Nettovermögen', 'Das Leben ist zu Ende', 'Zurück zu den gespeicherten Leben', 'Gesundheit', 'Glück', 'Intelligenz', 'Aussehen', 'Energie', 'Stress', 'Charisma', 'Fitness', 'Dynastie fortsetzen', 'Eine neue Generation wird geboren', 'Einstellungen', 'Design', 'System', 'Hell', 'Dunkel', 'Sprache', 'Info', 'Etwas ist schiefgelaufen', 'Schließen', 'Welt', 'Gesellschaft', 'Kontostände', 'Beruf', 'Bildung'],
  pt: ['Vida', 'Relações', 'Carreira', 'Finanças', 'Mais', 'Nova vida', 'Nome', 'Apelido', 'País de nascimento', 'Aleatório', 'Nascer', 'Vidas guardadas', 'Abrir', 'Eliminar', 'Avançar um ano', 'Idade', 'Estatísticas', 'Eventos recentes', 'Situação financeira', 'Dinheiro', 'Dívidas', 'Património líquido', 'A vida terminou', 'Voltar às vidas guardadas', 'Saúde', 'Felicidade', 'Inteligência', 'Aparência', 'Energia', 'Stress', 'Carisma', 'Condição física', 'Continuar a dinastia', 'Nasce a nova geração', 'Definições', 'Tema', 'Sistema', 'Claro', 'Escuro', 'Idioma', 'Informações', 'Algo correu mal', 'Fechar', 'Mundo', 'Sociedade', 'Saldos', 'Trabalho', 'Educação'],
  ja: ['人生', '人間関係', 'キャリア', '財務', 'その他', '新しい人生', '名', '姓', '出生国', 'ランダム', '誕生', '保存した人生', '開く', '削除', '1年進める', '年齢', '統計', '最近の出来事', '経済状況', '現金', '借金', '純資産', '人生は終わりました', '保存した人生に戻る', '健康', '幸福', '知性', '外見', 'エネルギー', 'ストレス', 'カリスマ', '体力', '家系を続ける', '新しい世代が誕生', '設定', 'テーマ', 'システム', 'ライト', 'ダーク', '言語', '情報', '問題が発生しました', '閉じる', '世界', '社会', '残高', '仕事', '教育'],
  zh: ['人生', '人际关系', '职业', '财务', '更多', '新人生', '名', '姓', '出生国家', '随机', '出生', '已保存的人生', '打开', '删除', '前进一年', '年龄', '统计', '近期事件', '经济状况', '现金', '债务', '净资产', '人生已结束', '返回已保存的人生', '健康', '幸福', '智力', '外貌', '精力', '压力', '魅力', '体能', '延续家族', '新一代诞生', '设置', '主题', '系统', '浅色', '深色', '语言', '关于', '出了点问题', '关闭', '世界', '社会', '余额', '工作', '教育'],
  ko: ['인생', '관계', '경력', '재무', '더보기', '새 인생', '이름', '성', '출생 국가', '무작위', '태어나기', '저장된 인생', '열기', '삭제', '1년 진행', '나이', '통계', '최근 사건', '경제 상황', '현금', '부채', '순자산', '인생이 끝났습니다', '저장된 인생으로 돌아가기', '건강', '행복', '지능', '외모', '에너지', '스트레스', '카리스마', '체력', '가문 이어가기', '새로운 세대가 태어납니다', '설정', '테마', '시스템', '밝게', '어둡게', '언어', '정보', '문제가 발생했습니다', '닫기', '세계', '사회', '잔액', '직업', '교육'],
  ar: ['الحياة', 'العلاقات', 'المسيرة المهنية', 'المالية', 'المزيد', 'حياة جديدة', 'الاسم الأول', 'اسم العائلة', 'بلد الولادة', 'عشوائي', 'وُلِد', 'الحيوات المحفوظة', 'فتح', 'حذف', 'تقدّم سنة', 'العمر', 'الإحصاءات', 'الأحداث الأخيرة', 'الوضع المالي', 'النقد', 'الديون', 'صافي الثروة', 'انتهت الحياة', 'العودة إلى الحيوات المحفوظة', 'الصحة', 'السعادة', 'الذكاء', 'المظهر', 'الطاقة', 'التوتر', 'الكاريزما', 'اللياقة', 'مواصلة السلالة', 'ولادة جيل جديد', 'الإعدادات', 'المظهر', 'النظام', 'فاتح', 'داكن', 'اللغة', 'حول', 'حدث خطأ ما', 'إغلاق', 'العالم', 'المجتمع', 'الأرصدة', 'العمل', 'التعليم'],
  hi: ['जीवन', 'रिश्ते', 'करियर', 'वित्त', 'और', 'नया जीवन', 'नाम', 'उपनाम', 'जन्म का देश', 'यादृच्छिक', 'जन्म लें', 'सहेजे गए जीवन', 'खोलें', 'हटाएँ', 'एक वर्ष आगे बढ़ें', 'आयु', 'आँकड़े', 'हाल की घटनाएँ', 'आर्थिक स्थिति', 'नकद', 'कर्ज़', 'कुल संपत्ति', 'जीवन समाप्त हो गया', 'सहेजे गए जीवनों पर वापस जाएँ', 'स्वास्थ्य', 'खुशी', 'बुद्धि', 'रूप-रंग', 'ऊर्जा', 'तनाव', 'करिश्मा', 'फिटनेस', 'वंश आगे बढ़ाएँ', 'नई पीढ़ी का जन्म', 'सेटिंग', 'थीम', 'सिस्टम', 'हल्का', 'गहरा', 'भाषा', 'जानकारी', 'कुछ गलत हो गया', 'बंद करें', 'विश्व', 'समाज', 'शेष राशि', 'नौकरी', 'शिक्षा'],
  ru: ['Жизнь', 'Отношения', 'Карьера', 'Финансы', 'Ещё', 'Новая жизнь', 'Имя', 'Фамилия', 'Страна рождения', 'Случайно', 'Родиться', 'Сохранённые жизни', 'Открыть', 'Удалить', 'Прожить год', 'Возраст', 'Статистика', 'Недавние события', 'Финансовое положение', 'Наличные', 'Долги', 'Чистый капитал', 'Жизнь закончилась', 'К сохранённым жизням', 'Здоровье', 'Счастье', 'Интеллект', 'Внешность', 'Энергия', 'Стресс', 'Харизма', 'Физическая форма', 'Продолжить династию', 'Рождается новое поколение', 'Настройки', 'Тема', 'Системная', 'Светлая', 'Тёмная', 'Язык', 'О программе', 'Что-то пошло не так', 'Закрыть', 'Мир', 'Общество', 'Остатки', 'Работа', 'Образование'],
  tr: ['Hayat', 'İlişkiler', 'Kariyer', 'Finans', 'Daha fazla', 'Yeni hayat', 'Ad', 'Soyad', 'Doğum ülkesi', 'Rastgele', 'Dünyaya gel', 'Kayıtlı hayatlar', 'Aç', 'Sil', 'Bir yıl ilerle', 'Yaş', 'İstatistikler', 'Son olaylar', 'Mali durum', 'Nakit', 'Borçlar', 'Net servet', 'Hayat sona erdi', 'Kayıtlı hayatlara dön', 'Sağlık', 'Mutluluk', 'Zeka', 'Görünüm', 'Enerji', 'Stres', 'Karizma', 'Kondisyon', 'Soyu sürdür', 'Yeni nesil doğuyor', 'Ayarlar', 'Tema', 'Sistem', 'Açık', 'Koyu', 'Dil', 'Hakkında', 'Bir şeyler ters gitti', 'Kapat', 'Dünya', 'Toplum', 'Bakiyeler', 'İş', 'Eğitim'],
  id: ['Kehidupan', 'Hubungan', 'Karier', 'Keuangan', 'Lainnya', 'Kehidupan baru', 'Nama depan', 'Nama belakang', 'Negara kelahiran', 'Acak', 'Lahir', 'Kehidupan tersimpan', 'Buka', 'Hapus', 'Maju satu tahun', 'Usia', 'Statistik', 'Peristiwa terbaru', 'Kondisi keuangan', 'Uang tunai', 'Utang', 'Kekayaan bersih', 'Kehidupan telah berakhir', 'Kembali ke kehidupan tersimpan', 'Kesehatan', 'Kebahagiaan', 'Kecerdasan', 'Penampilan', 'Energi', 'Stres', 'Karisma', 'Kebugaran', 'Lanjutkan dinasti', 'Generasi baru lahir', 'Pengaturan', 'Tema', 'Sistem', 'Terang', 'Gelap', 'Bahasa', 'Tentang', 'Terjadi kesalahan', 'Tutup', 'Dunia', 'Masyarakat', 'Saldo', 'Pekerjaan', 'Pendidikan'],
  nl: ['Leven', 'Relaties', 'Carrière', 'Financiën', 'Meer', 'Nieuw leven', 'Voornaam', 'Achternaam', 'Geboorteland', 'Willekeurig', 'Word geboren', 'Opgeslagen levens', 'Openen', 'Verwijderen', 'Een jaar verder', 'Leeftijd', 'Statistieken', 'Recente gebeurtenissen', 'Financiële situatie', 'Contant geld', 'Schulden', 'Nettovermogen', 'Het leven is voorbij', 'Terug naar opgeslagen levens', 'Gezondheid', 'Geluk', 'Intelligentie', 'Uiterlijk', 'Energie', 'Stress', 'Charisma', 'Conditie', 'Dynastie voortzetten', 'Een nieuwe generatie wordt geboren', 'Instellingen', 'Thema', 'Systeem', 'Licht', 'Donker', 'Taal', 'Over', 'Er is iets misgegaan', 'Sluiten', 'Wereld', 'Samenleving', 'Saldi', 'Werk', 'Opleiding'],
  pl: ['Życie', 'Relacje', 'Kariera', 'Finanse', 'Więcej', 'Nowe życie', 'Imię', 'Nazwisko', 'Kraj urodzenia', 'Losowo', 'Urodź się', 'Zapisane życia', 'Otwórz', 'Usuń', 'Przesuń o rok', 'Wiek', 'Statystyki', 'Ostatnie wydarzenia', 'Sytuacja finansowa', 'Gotówka', 'Długi', 'Wartość netto', 'Życie dobiegło końca', 'Wróć do zapisanych żyć', 'Zdrowie', 'Szczęście', 'Inteligencja', 'Wygląd', 'Energia', 'Stres', 'Charyzma', 'Kondycja', 'Kontynuuj dynastię', 'Rodzi się nowe pokolenie', 'Ustawienia', 'Motyw', 'Systemowy', 'Jasny', 'Ciemny', 'Język', 'Informacje', 'Coś poszło nie tak', 'Zamknij', 'Świat', 'Społeczeństwo', 'Salda', 'Praca', 'Edukacja'],
  sv: ['Liv', 'Relationer', 'Karriär', 'Ekonomi', 'Mer', 'Nytt liv', 'Förnamn', 'Efternamn', 'Födelseland', 'Slumpmässigt', 'Bli född', 'Sparade liv', 'Öppna', 'Ta bort', 'Gå ett år framåt', 'Ålder', 'Statistik', 'Senaste händelser', 'Ekonomisk situation', 'Kontanter', 'Skulder', 'Nettoförmögenhet', 'Livet är slut', 'Tillbaka till sparade liv', 'Hälsa', 'Lycka', 'Intelligens', 'Utseende', 'Energi', 'Stress', 'Karisma', 'Kondition', 'Fortsätt dynastin', 'En ny generation föds', 'Inställningar', 'Tema', 'System', 'Ljust', 'Mörkt', 'Språk', 'Om', 'Något gick fel', 'Stäng', 'Världen', 'Samhälle', 'Saldon', 'Arbete', 'Utbildning'],
  th: ['ชีวิต', 'ความสัมพันธ์', 'อาชีพ', 'การเงิน', 'เพิ่มเติม', 'ชีวิตใหม่', 'ชื่อ', 'นามสกุล', 'ประเทศที่เกิด', 'สุ่ม', 'เกิด', 'ชีวิตที่บันทึกไว้', 'เปิด', 'ลบ', 'เดินหน้าหนึ่งปี', 'อายุ', 'สถิติ', 'เหตุการณ์ล่าสุด', 'สถานะทางการเงิน', 'เงินสด', 'หนี้สิน', 'ทรัพย์สินสุทธิ', 'ชีวิตสิ้นสุดแล้ว', 'กลับไปยังชีวิตที่บันทึกไว้', 'สุขภาพ', 'ความสุข', 'สติปัญญา', 'รูปลักษณ์', 'พลังงาน', 'ความเครียด', 'เสน่ห์', 'ความฟิต', 'สืบทอดวงศ์ตระกูลต่อ', 'คนรุ่นใหม่ถือกำเนิด', 'การตั้งค่า', 'ธีม', 'ระบบ', 'สว่าง', 'มืด', 'ภาษา', 'เกี่ยวกับ', 'เกิดข้อผิดพลาด', 'ปิด', 'โลก', 'สังคม', 'ยอดคงเหลือ', 'งาน', 'การศึกษา'],
  vi: ['Cuộc sống', 'Mối quan hệ', 'Sự nghiệp', 'Tài chính', 'Thêm', 'Cuộc sống mới', 'Tên', 'Họ', 'Quốc gia sinh', 'Ngẫu nhiên', 'Chào đời', 'Cuộc sống đã lưu', 'Mở', 'Xóa', 'Tiến thêm một năm', 'Tuổi', 'Thống kê', 'Sự kiện gần đây', 'Tình hình tài chính', 'Tiền mặt', 'Nợ', 'Tài sản ròng', 'Cuộc đời đã kết thúc', 'Quay lại các cuộc sống đã lưu', 'Sức khỏe', 'Hạnh phúc', 'Trí tuệ', 'Ngoại hình', 'Năng lượng', 'Căng thẳng', 'Sức hút', 'Thể lực', 'Tiếp nối gia tộc', 'Thế hệ mới chào đời', 'Cài đặt', 'Giao diện', 'Hệ thống', 'Sáng', 'Tối', 'Ngôn ngữ', 'Giới thiệu', 'Đã xảy ra sự cố', 'Đóng', 'Thế giới', 'Xã hội', 'Số dư', 'Công việc', 'Giáo dục'],
  el: ['Ζωή', 'Σχέσεις', 'Καριέρα', 'Οικονομικά', 'Περισσότερα', 'Νέα ζωή', 'Όνομα', 'Επώνυμο', 'Χώρα γέννησης', 'Τυχαία', 'Γεννήσου', 'Αποθηκευμένες ζωές', 'Άνοιγμα', 'Διαγραφή', 'Προχώρα ένα χρόνο', 'Ηλικία', 'Στατιστικά', 'Πρόσφατα γεγονότα', 'Οικονομική κατάσταση', 'Μετρητά', 'Χρέη', 'Καθαρή περιουσία', 'Η ζωή τελείωσε', 'Επιστροφή στις αποθηκευμένες ζωές', 'Υγεία', 'Ευτυχία', 'Ευφυΐα', 'Εμφάνιση', 'Ενέργεια', 'Άγχος', 'Χάρισμα', 'Φυσική κατάσταση', 'Συνέχεια της δυναστείας', 'Γεννιέται η νέα γενιά', 'Ρυθμίσεις', 'Θέμα', 'Σύστημα', 'Φωτεινό', 'Σκούρο', 'Γλώσσα', 'Πληροφορίες', 'Κάτι πήγε στραβά', 'Κλείσιμο', 'Κόσμος', 'Κοινωνία', 'Υπόλοιπα', 'Εργασία', 'Εκπαίδευση'],
};

export const translations: Readonly<Record<LocaleCode, Record<CoreKey, string>>> = Object.fromEntries(
  (Object.entries(rows) as [LocaleCode, Row][]).map(([code, row]) => [code, Object.fromEntries(CORE_KEYS.map((k, i) => [k, row[i] ?? ''])) as Record<CoreKey, string>]),
) as Record<LocaleCode, Record<CoreKey, string>>;

/** Per-language report for the missing-translation tool. */
export function coverage(): { code: LocaleCode; present: number; missing: CoreKey[]; total: number }[] {
  return LOCALES.map((l) => {
    const t = translations[l.code];
    const missing = CORE_KEYS.filter((k) => !t[k] || t[k].trim() === '');
    return { code: l.code, present: CORE_KEYS.length - missing.length, missing, total: CORE_KEYS.length };
  });
}
