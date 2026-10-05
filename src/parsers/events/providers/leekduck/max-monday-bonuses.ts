import type { AvailableLocales } from '../../../services/gamemaster-translator';
import type { RichBlock } from '../../../types/rich-text';

/**
 * What a Max Monday brings, in every language: its three bullet points and the asterisk footnote about when Max Battles are
 * available. It is the text of the "Max Monday" part of the Pokémon GO "Memories in Motion" season post (October 2026), scraped
 * once and kept here as it is, because that page can go away. The same text goes into every Max Monday of LeekDuck (see
 * `EventsParser`). Russian has no post of its own: consumers fall back to English.
 */
export const MAX_MONDAY_BONUSES: Partial<
	Record<AvailableLocales, Array<RichBlock>>
> = {
	'en': [
		{
			kind: 'item',
			runs: [
				{
					text: 'Power Spots will refresh more frequently.',
				},
			],
			level: 0,
		},
		{
			kind: 'item',
			runs: [
				{
					text: 'Additional Power Spots will be active on Mondays compared to the rest of the week.',
				},
			],
			level: 0,
		},
		{
			kind: 'item',
			runs: [
				{
					text: 'Max Battles will rotate to feature different Dynamax Pokémon.',
				},
			],
			level: 0,
		},
		{
			kind: 'note',
			runs: [
				{
					text: '*Max Battles will be available between 6:00 a.m. and 9:00 p.m. local time. Power Spot availability will be limited outside of Max Mondays and Max Battle Days.',
				},
			],
		},
	],
	'pt_br': [
		{
			kind: 'item',
			runs: [
				{
					text: 'Os Pontos de Energia serão atualizados com maior frequência.',
				},
			],
			level: 0,
		},
		{
			kind: 'item',
			runs: [
				{
					text: 'Pontos de Energia adicionais ficarão ativos às segundas-feiras, ao contrário do restante da semana.',
				},
			],
			level: 0,
		},
		{
			kind: 'item',
			runs: [
				{
					text: 'As Batalhas Max terão rotação, com diferentes Pokémon Dinamax em destaque.',
				},
			],
			level: 0,
		},
		{
			kind: 'note',
			runs: [
				{
					text: '*As Batalhas Max ficarão disponíveis entre as 6h e as 21h, horário local. A disponibilidade de Pontos de Energia será limitada fora das Segundas Max e dos Dias de Batalhas Max.',
				},
			],
		},
	],
	'de': [
		{
			kind: 'item',
			runs: [
				{
					text: 'Kraftquellen erneuern sich häufiger.',
				},
			],
			level: 0,
		},
		{
			kind: 'item',
			runs: [
				{
					text: 'Am Montag sind mehr Kraftquellen aktiv als an anderen Wochentagen.',
				},
			],
			level: 0,
		},
		{
			kind: 'item',
			runs: [
				{
					text: 'Dyna-Kämpfe rotieren mit unterschiedlichen Dynamax-Pokémon.',
				},
			],
			level: 0,
		},
		{
			kind: 'note',
			runs: [
				{
					text: '* Dyna-Kämpfe sind zwischen 6 und 21 Uhr (Ortszeit) aktiv. Die Anzahl der Kraftquellen ist außer am Dyna-Montag und an Dyna-Kampftagen begrenzt.',
				},
			],
		},
	],
	'es': [
		{
			kind: 'item',
			runs: [
				{
					text: 'Los nodos energéticos se actualizarán con más frecuencia.',
				},
			],
			level: 0,
		},
		{
			kind: 'item',
			runs: [
				{
					text: 'Los lunes, se activarán más nodos energéticos que otros días de la semana.',
				},
			],
			level: 0,
		},
		{
			kind: 'item',
			runs: [
				{
					text: 'Los Combates Max rotarán para destacar diferentes Pokémon Dinamax.',
				},
			],
			level: 0,
		},
		{
			kind: 'note',
			runs: [
				{
					text: '*Los Combates Max estarán disponibles entre las 6:00 y las 19:00 (hora local). Los nodos energéticos no estarán disponibles los Lunes Max ni los Días de Combates Max.',
				},
			],
		},
	],
	'es-MX': [
		{
			kind: 'item',
			runs: [
				{
					text: 'Los Nodos Energéticos se actualizarán con más frecuencia.',
				},
			],
			level: 0,
		},
		{
			kind: 'item',
			runs: [
				{
					text: 'Los lunes se activarán más Nodos Energéticos que otros días de la semana.',
				},
			],
			level: 0,
		},
		{
			kind: 'item',
			runs: [
				{
					text: 'Los Combates Max rotarán para destacar diferentes Pokémon Dinamax.',
				},
			],
			level: 0,
		},
		{
			kind: 'note',
			runs: [
				{
					text: '*Los Combates Max estarán disponibles entre las 6:00 y las 19:00 (hora local). Los Nodos Energéticos no estarán disponibles los Lunes Max ni los Días de Combates Max.',
				},
			],
		},
	],
	'fr': [
		{
			kind: 'item',
			runs: [
				{
					text: 'Les Sources d’Énergie seront actualisées plus souvent.',
				},
			],
			level: 0,
		},
		{
			kind: 'item',
			runs: [
				{
					text: 'Le lundi sera le jour de la semaine où le plus de Sources d’Énergie seront actives.',
				},
			],
			level: 0,
		},
		{
			kind: 'item',
			runs: [
				{
					text: 'Une rotation aura lieu dans les Combats Dynamax pour laisser la place à plusieurs Pokémon Dynamax différents.',
				},
			],
			level: 0,
		},
		{
			kind: 'note',
			runs: [
				{
					text: '* Les Combats Dynamax seront accessibles de 6 h à 21 h (heure locale). Les Sources d’Énergie seront moins nombreuses en dehors des Lundis Dynamax et des Journées Combat Dynamax.',
				},
			],
		},
	],
	'hi': [
		{
			kind: 'item',
			runs: [
				{
					text: 'पावर स्पॉट अधिक बार रिफ़्रेश होंगे.',
				},
			],
			level: 0,
		},
		{
			kind: 'item',
			runs: [
				{
					text: 'सप्ताह के बाकी दिनों की तुलना में सोमवार को अतिरिक्त पावर स्पॉट सक्रिय रहेंगे।',
				},
			],
			level: 0,
		},
		{
			kind: 'item',
			runs: [
				{
					text: 'मैक्स बैटल में अलग-अलग डायनामैक्स पोकेमॉन शामिल होंगे।',
				},
			],
			level: 0,
		},
		{
			kind: 'note',
			runs: [
				{
					text: '*मैक्स बैटल स्थानीय समयानुसार सुबह 6:00 बजे से रात 9:00 बजे के बीच उपलब्ध रहेगा। मैक्स मंडे और मैक्स बैटल डे के अलावा पावर स्पॉट की उपलब्धता सीमित रहेगी।',
				},
			],
		},
	],
	'id': [
		{
			kind: 'item',
			runs: [
				{
					text: 'Power Spot akan lebih sering diperbarui.',
				},
			],
			level: 0,
		},
		{
			kind: 'item',
			runs: [
				{
					text: 'Power Spot tambahan akan lebih aktif pada hari Senin dibandingkan dengan hari-hari lain dalam seminggu.',
				},
			],
			level: 0,
		},
		{
			kind: 'item',
			runs: [
				{
					text: 'Pertarungan Max akan menampilkan Pokémon Dynamax yang berbeda secara bergantian.',
				},
			],
			level: 0,
		},
		{
			kind: 'note',
			runs: [
				{
					text: '*Pertarungan Max akan tersedia antara pukul 06.00 dan 21.00 waktu setempat. Ketersediaan Power Spot akan dibatasi di luar Senin Max dan Hari Pertarungan Max.',
				},
			],
		},
	],
	'it': [
		{
			kind: 'item',
			runs: [
				{
					text: 'I punti energetici si aggiorneranno più frequentemente.',
				},
			],
			level: 0,
		},
		{
			kind: 'item',
			runs: [
				{
					text: 'Punti energetici extra saranno attivi il lunedì rispetto al resto della settimana.',
				},
			],
			level: 0,
		},
		{
			kind: 'item',
			runs: [
				{
					text: 'Le Lotte Dynamax si alterneranno per lasciare spazio a diversi Pokémon Dynamax.',
				},
			],
			level: 0,
		},
		{
			kind: 'note',
			runs: [
				{
					text: '*Le Lotte Dynamax saranno disponibili tra le 06:00 e le 21:00 (ora locale). La disponibilità dei punti energetici sarà limitata al di fuori dei Dynalunedì e delle giornate Lotte Dynamax.',
				},
			],
		},
	],
	'ja': [
		{
			kind: 'item',
			runs: [
				{
					text: '「パワースポット」の更新間隔が短縮されます。',
				},
			],
			level: 0,
		},
		{
			kind: 'item',
			runs: [
				{
					text: '他の曜日と比べて、月曜日は「パワースポット」がより多く出現します。',
				},
			],
			level: 0,
		},
		{
			kind: 'item',
			runs: [
				{
					text: '「マックスバトル」のローテーションに、異なる「ダイマックスポケモン」が登場するようになります。',
				},
			],
			level: 0,
		},
		{
			kind: 'note',
			runs: [
				{
					text: '*「マックスバトル」には日本時間06:00から21:00まで挑戦できます。「パワースポット」の数は、「マックスマンデー」と「マックスバトルデイ」以外では少なくなります。',
				},
			],
		},
	],
	'ko': [
		{
			kind: 'item',
			runs: [
				{
					text: '파워스폿의 갱신 간격이 단축됩니다.',
				},
			],
			level: 0,
		},
		{
			kind: 'item',
			runs: [
				{
					text: '다른 요일에 비해 월요일에 더 많은 파워스폿이 등장합니다.',
				},
			],
			level: 0,
		},
		{
			kind: 'item',
			runs: [
				{
					text: '"맥스배틀" 로테이션에 다른 다이맥스 포켓몬이 등장합니다.',
				},
			],
			level: 0,
		},
		{
			kind: 'note',
			runs: [
				{
					text: '* 맥스배틀은 한국시간 06:00부터 21:00까지 이용할 수 있습니다. 파워스폿의 수는 "맥스 먼데이"와 "맥스배틀 데이"가 아닐 때는 적어집니다.',
				},
			],
		},
	],
	'th': [
		{
			kind: 'item',
			runs: [
				{
					text: 'พาวเวอร์สป็อตจะรีเฟรชถี่ขึ้น',
				},
			],
			level: 0,
		},
		{
			kind: 'item',
			runs: [
				{
					text: 'ในวันจันทร์จะมีพาวเวอร์สป็อตเปิดใช้งานเพิ่มเติมมากกว่าวันอื่นในสัปดาห์',
				},
			],
			level: 0,
		},
		{
			kind: 'item',
			runs: [
				{
					text: 'แบตเทิลแมกซ์จะหมุนเวียนโปเกมอนไดแมกซ์โดดเด่นที่แตกต่างกัน',
				},
			],
			level: 0,
		},
		{
			kind: 'note',
			runs: [
				{
					text: '*แบตเทิลแมกซ์จะเปิดให้เล่นในช่วงเวลา 06.00 น. ถึง 21.00 น. ตามเวลาไทย การใช้งานพาวเวอร์สป็อตจะถูกจำกัดในช่วงเวลานอกเหนือจากวันจันทร์สุดแมกซ์และวันแบตเทิลแม็กซ์',
				},
			],
		},
	],
	'tr': [
		{
			kind: 'item',
			runs: [
				{
					text: 'Güç Noktaları daha sık yenilenecek.',
				},
			],
			level: 0,
		},
		{
			kind: 'item',
			runs: [
				{
					text: 'Pazartesileri, haftanın diğer günlerine kıyasla ek Güç Noktaları aktif olacak.',
				},
			],
			level: 0,
		},
		{
			kind: 'item',
			runs: [
				{
					text: "Dönüşümlü Maksi Maçlarda farklı Dinamaks Pokémon'lar yer alacak.",
				},
			],
			level: 0,
		},
		{
			kind: 'note',
			runs: [
				{
					text: '*Maksi Maçlar yerel saatle 06.00 ile 21.00 arasında kullanılabilecek. Güç Noktası kullanım durumu, Maksi Pazartesiler ve Maksi Maç Günleri dışında sınırlı olacak.',
				},
			],
		},
	],
	'zh-Hant': [
		{
			kind: 'item',
			runs: [
				{
					text: '能量點會更常刷新。',
				},
			],
			level: 0,
		},
		{
			kind: 'item',
			runs: [
				{
					text: '星期一的地圖上將出現額外能量點。',
				},
			],
			level: 0,
		},
		{
			kind: 'item',
			runs: [
				{
					text: '不同的極巨化寶可夢會在極巨對戰輪替登場。',
				},
			],
			level: 0,
		},
		{
			kind: 'note',
			runs: [
				{
					text: '*極巨對戰會在台灣時間06:00～21:00期間登場。在「極巨星期一」與「極巨對戰日」活動以外的時間，能量點將有所限制。',
				},
			],
		},
	],
};
