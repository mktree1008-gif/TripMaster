import { LanguageCode } from '@/lib/types';

export const languageOrder: Array<{ code: LanguageCode; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'ko', label: '한국어' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
];

export const translations: Record<
  LanguageCode,
  {
    appTitle: string;
    appSubtitle: string;
    authTitle: string;
    flight: string;
    hotel: string;
    places: string;
    restaurants: string;
    record: string;
    diary: string;
    tripstargram: string;
    profile: string;
    settings: string;
    recommended: string;
    lowPrice: string;
    imageMode: string;
    listMode: string;
    invite: string;
    comments: string;
    save: string;
  }
> = {
  en: {
    appTitle: 'TripMaster',
    appSubtitle: 'Plan, document, and share your trip in one mobile-friendly web app.',
    authTitle: 'Sign in',
    flight: 'Flight',
    hotel: 'Hotel',
    places: 'Places',
    restaurants: 'Restaurants',
    record: 'Record',
    diary: 'Diary',
    tripstargram: 'Tripstargram',
    profile: 'Profile',
    settings: 'Settings',
    recommended: 'Recommended',
    lowPrice: 'Lowest Price',
    imageMode: 'Images',
    listMode: 'List',
    invite: 'Invite',
    comments: 'Comments',
    save: 'Save',
  },
  ko: {
    appTitle: 'TripMaster',
    appSubtitle: '여행 계획, 기록, 공유를 모바일 친화 웹앱 하나로.',
    authTitle: '로그인',
    flight: '항공',
    hotel: '호텔',
    places: '장소',
    restaurants: '맛집',
    record: '기록',
    diary: '다이어리',
    tripstargram: '트립스타그램',
    profile: '프로필',
    settings: '설정',
    recommended: '추천순',
    lowPrice: '낮은 가격순',
    imageMode: '이미지',
    listMode: '목록',
    invite: '초대',
    comments: '댓글',
    save: '저장',
  },
  zh: {
    appTitle: 'TripMaster',
    appSubtitle: '一站式移动旅行规划、记录与共享应用。',
    authTitle: '登录',
    flight: '航班',
    hotel: '酒店',
    places: '景点',
    restaurants: '餐厅',
    record: '记录',
    diary: '日记',
    tripstargram: '旅行圈',
    profile: '个人资料',
    settings: '设置',
    recommended: '推荐',
    lowPrice: '低价优先',
    imageMode: '图片',
    listMode: '列表',
    invite: '邀请',
    comments: '评论',
    save: '保存',
  },
  ja: {
    appTitle: 'TripMaster',
    appSubtitle: '旅行の計画・記録・共有を一つのモバイルWebアプリで。',
    authTitle: 'ログイン',
    flight: 'フライト',
    hotel: 'ホテル',
    places: 'スポット',
    restaurants: 'レストラン',
    record: '記録',
    diary: '日記',
    tripstargram: 'トリップスタグラム',
    profile: 'プロフィール',
    settings: '設定',
    recommended: 'おすすめ順',
    lowPrice: '料金が安い順',
    imageMode: '画像',
    listMode: 'リスト',
    invite: '招待',
    comments: 'コメント',
    save: '保存',
  },
  fr: {
    appTitle: 'TripMaster',
    appSubtitle: 'Planifiez, enregistrez et partagez votre voyage dans une app web mobile.',
    authTitle: 'Connexion',
    flight: 'Vol',
    hotel: 'Hôtel',
    places: 'Lieux',
    restaurants: 'Restaurants',
    record: 'Record',
    diary: 'Journal',
    tripstargram: 'Tripstargram',
    profile: 'Profil',
    settings: 'Paramètres',
    recommended: 'Recommandé',
    lowPrice: 'Prix Croissant',
    imageMode: 'Images',
    listMode: 'Liste',
    invite: 'Inviter',
    comments: 'Commentaires',
    save: 'Enregistrer',
  },
  de: {
    appTitle: 'TripMaster',
    appSubtitle: 'Reise planen, festhalten und teilen in einer mobilfreundlichen Web-App.',
    authTitle: 'Anmelden',
    flight: 'Flug',
    hotel: 'Hotel',
    places: 'Orte',
    restaurants: 'Restaurants',
    record: 'Aufzeichnungen',
    diary: 'Tagebuch',
    tripstargram: 'Tripstargram',
    profile: 'Profil',
    settings: 'Einstellungen',
    recommended: 'Empfohlen',
    lowPrice: 'Niedrigster Preis',
    imageMode: 'Bilder',
    listMode: 'Liste',
    invite: 'Einladen',
    comments: 'Kommentare',
    save: 'Speichern',
  },
};

export function t(lang: LanguageCode) {
  return translations[lang] ?? translations.en;
}
