// Canonical English internally; Tamil only for farmer-facing text.
const DISTRICT_TA = {
  Salem: 'சேலம்',
  Thanjavur: 'தஞ்சாவூர்',
  Erode: 'ஈரோடு',
  Coimbatore: 'கோயம்புத்தூர்',
  Madurai: 'மதுரை',
  Tiruchirappalli: 'திருச்சிராப்பள்ளி',
  Dindigul: 'திண்டுக்கல்',
  Dharmapuri: 'தர்மபுரி',
  Krishnagiri: 'கிருஷ்ணகிரி',
  Tirunelveli: 'திருநெல்வேலி',
  Thoothukkudi: 'தூத்துக்குடி',
  Cuddalore: 'கடலூர்',
  Viluppuram: 'விழுப்புரம்',
  Vellore: 'வேலூர்',
  Kancheepuram: 'காஞ்சிபுரம்',
  Chengalpattu: 'செங்கல்பட்டு',
  Thiruvallur: 'திருவள்ளூர்',
  Tiruppur: 'திருப்பூர்',
  Namakkal: 'நாமக்கல்',
  Karur: 'கரூர்',
  Perambalur: 'பெரம்பலூர்',
  Ariyalur: 'அரியலூர்',
  Nagapattinam: 'நாகப்பட்டினம்',
  Thiruvarur: 'திருவாரூர்',
  Mayiladuthurai: 'மயிலாடுதுறை',
  Pudukkottai: 'புதுக்கோட்டை',
  Sivaganga: 'சிவகங்கை',
  Ramanathapuram: 'ராமநாதபுரம்',
  Virudhunagar: 'விருதுநகர்',
  Tenkasi: 'தென்காசி',
  Kanniyakumari: 'கன்னியாகுமரி',
  Theni: 'தேனி',
  'The Nilgiris': 'நீலகிரி',
  Tirupathur: 'திருப்பத்தூர்',
  Ranipet: 'ராணிப்பேட்டை',
  Kallakurichi: 'கள்ளக்குறிச்சி',
  Tiruvannamalai: 'திருவண்ணாமலை'
};

const CROP_TA = {
  rice: 'நெல்',
  groundnut: 'நிலக்கடலை',
  maize: 'மக்காச்சோளம்',
  sorghum: 'சோளம்',
  'Pearl millet': 'கம்பு',
  ragi: 'கேழ்வரகு',
  horsegram: 'கொள்ளு',
  blackgram: 'உளுந்து',
  greengram: 'பாசிப்பயறு',
  sugarcane: 'கரும்பு',
  cotton: 'பருத்தி',
  onion: 'வெங்காயம்',
  'small onion': 'சின்ன வெங்காயம்',
  brinjal: 'கத்தரிக்காய்',
  bhendi: 'வெண்டைக்காய்',
  chillies: 'மிளகாய்',
  tapoica: 'மரவள்ளிக்கிழங்கு',
  turmeric: 'மஞ்சள்',
  wheat: 'கோதுமை',
  Cabbage: 'முட்டைக்கோஸ்',
  cauliflower: 'காலிஃபிளவர்',
  'elephant foot yam': 'சேனைக்கிழங்கு',
  gingely: 'எள்',
  soyabean: 'சோயா',
  sunflower: 'சூரியகாந்தி',
  'sweet potato': 'சர்க்கரைவள்ளிக்கிழங்கு',
  watermelon: 'தர்பூசணி'
};

function displayDistrict(name, isTamil) {
  if (!name) return name;
  if (!isTamil) return name;
  return DISTRICT_TA[name] || DISTRICT_TA[String(name).trim()] || name;
}

function displayCrop(name, isTamil) {
  if (!name) return name;
  if (!isTamil) return name;
  const key = String(name).trim();
  return CROP_TA[key] || CROP_TA[key.toLowerCase()] || name;
}

function prettyCropEn(name) {
  if (!name) return '';
  const s = String(name);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

module.exports = { DISTRICT_TA, CROP_TA, displayDistrict, displayCrop, prettyCropEn };
