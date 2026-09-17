const fs = require('fs');
const path = require('path');
const readline = require('readline');

class SoilService {
  constructor() {
    this.isLoaded = false;
    this.isLoading = false;
    this.districtCropMap = new Map(); // `${district.toLowerCase()}___${crop.toLowerCase()}` -> stats
    this.districtCropsList = new Map(); // `${district.toLowerCase()}` -> sorted array of crops
    this.cropMetaMap = new Map(); // `${crop.toLowerCase()}` -> crop requirement info
    this.districtsSet = new Set();
    this.cropsSet = new Set();

    // Mapping for crop aliases (English, Tamil, Tanglish)
    this.cropAliases = {
      'paddy': 'rice',
      'nellu': 'rice',
      'nel': 'rice',
      'நெல்': 'rice',
      'peanut': 'groundnut',
      'ground nuts': 'groundnut',
      'nilakadalai': 'groundnut',
      'verkadalai': 'groundnut',
      'நிலக்கடலை': 'groundnut',
      'வேர்க்கடலை': 'groundnut',
      'corn': 'maize',
      'makka cholam': 'maize',
      'மக்காச்சோளம்': 'maize',
      'cholam': 'sorghum',
      'great millet': 'sorghum',
      'சோளம்': 'sorghum',
      'kambu': 'Pearl millet',
      'bajra': 'Pearl millet',
      'கம்பு': 'Pearl millet',
      'ragi': 'ragi',
      'kelvaragu': 'ragi',
      'finger millet': 'ragi',
      'கேழ்வரகு': 'ragi',
      'kelvaraku': 'ragi',
      'sugar cane': 'sugarcane',
      'karumbu': 'sugarcane',
      'கரும்பு': 'sugarcane',
      'paruthi': 'cotton',
      'பருத்தி': 'cotton',
      'ulundhu': 'blackgram',
      'black gram': 'blackgram',
      'உளுந்து': 'blackgram',
      'pachai payaru': 'greengram',
      'green gram': 'greengram',
      'பாசிப்பயறு': 'greengram',
      'kollu': 'horsegram',
      'horse gram': 'horsegram',
      'கொள்ளு': 'horsegram',
      'thovarai': 'redgram',
      'red gram': 'redgram',
      'துவரை': 'redgram',
      'kondakadalai': 'bengalgram',
      'bengal gram': 'bengalgram',
      'chana': 'bengalgram',
      'கொண்டைக்கடலை': 'bengalgram',
      'thakkali': 'tomato',
      'தக்காளி': 'tomato',
      'vengayam': 'onion',
      'chinna vengayam': 'small onion',
      'வெங்காயம்': 'onion',
      'சின்ன வெங்காயம்': 'small onion',
      'kathirikai': 'brinjal',
      'eggplant': 'brinjal',
      'கத்தரிக்காய்': 'brinjal',
      'vendaikai': 'bhendi',
      'okra': 'bhendi',
      'ladyfinger': 'bhendi',
      'வெண்டைக்காய்': 'bhendi',
      'milagai': 'chillies',
      'chilli': 'chillies',
      'chilli pepper': 'chillies',
      'மிளகாய்': 'chillies',
      'maravalli': 'tapoica',
      'tapioca': 'tapoica',
      'மரவள்ளிக்கிழங்கு': 'tapoica',
      'manjal': 'turmeric',
      'மஞ்சள்': 'turmeric',
      'gothumai': 'wheat',
      'கோதுமை': 'wheat',
      'muttakose': 'Cabbage',
      'முட்டைக்கோஸ்': 'Cabbage',
      'cauliflower': 'cauliflower',
      'காலிஃபிளவர்': 'cauliflower',
      'karunai kizhangu': 'elephant foot yam',
      'சேனைக்கிழங்கு': 'elephant foot yam',
      'ellu': 'gingely',
      'sesame': 'gingely',
      'எள்': 'gingely',
      'soya': 'soyabean',
      'soybean': 'soyabean',
      'சோயா': 'soyabean',
      'suriyagandhi': 'sunflower',
      'சூரியகாந்தி': 'sunflower',
      'sakkaravalli': 'sweet potato',
      'சர்க்கரைவள்ளிக்கிழங்கு': 'sweet potato',
      'tharpoosani': 'watermelon',
      'தர்பூசணி': 'watermelon'
    };

    // Mapping for district aliases (English, Tamil, Tanglish)
    this.districtAliases = {
      'salem': 'Salem',
      'சேலம்': 'Salem',
      'thanjavur': 'Thanjavur',
      'tanjore': 'Thanjavur',
      'தஞ்சாவூர்': 'Thanjavur',
      'தஞ்சை': 'Thanjavur',
      'erode': 'Erode',
      'ஈரோடு': 'Erode',
      'coimbatore': 'Coimbatore',
      'kovai': 'Coimbatore',
      'கோயம்புத்தூர்': 'Coimbatore',
      'கோவை': 'Coimbatore',
      'madurai': 'Madurai',
      'மதுரை': 'Madurai',
      'tiruchirappalli': 'Tiruchirappalli',
      'trichy': 'Tiruchirappalli',
      'திருச்சிராப்பள்ளி': 'Tiruchirappalli',
      'திருச்சி': 'Tiruchirappalli',
      'dindigul': 'Dindigul',
      'திண்டுக்கல்': 'Dindigul',
      'dharmapuri': 'Dharmapuri',
      'தர்மபுரி': 'Dharmapuri',
      'krishnagiri': 'Krishnagiri',
      'கிருஷ்ணகிரி': 'Krishnagiri',
      'tirunelveli': 'Tirunelveli',
      'nellai': 'Tirunelveli',
      'திருநெல்வேலி': 'Tirunelveli',
      'thoothukkudi': 'Thoothukkudi',
      'tuticorin': 'Thoothukkudi',
      'தூத்துக்குடி': 'Thoothukkudi',
      'cuddalore': 'Cuddalore',
      'கடலூர்': 'Cuddalore',
      'viluppuram': 'Viluppuram',
      'villupuram': 'Viluppuram',
      'விழுப்புரம்': 'Viluppuram',
      'vellore': 'Vellore',
      'வேலூர்': 'Vellore',
      'kancheepuram': 'Kancheepuram',
      'kanchipuram': 'Kancheepuram',
      'காஞ்சிபுரம்': 'Kancheepuram',
      'chengalpattu': 'Chengalpattu',
      'chengalpet': 'Chengalpattu',
      'செங்கல்பட்டு': 'Chengalpattu',
      'thiruvallur': 'Thiruvallur',
      'tiruvallur': 'Thiruvallur',
      'திருவள்ளூர்': 'Thiruvallur',
      'tiruppur': 'Tiruppur',
      'tirupur': 'Tiruppur',
      'திருப்பூர்': 'Tiruppur',
      'namakkal': 'Namakkal',
      'நாமக்கல்': 'Namakkal',
      'karur': 'Karur',
      'கரூர்': 'Karur',
      'perambalur': 'Perambalur',
      'பெரம்பலூர்': 'Perambalur',
      'ariyalur': 'Ariyalur',
      'அரியலூர்': 'Ariyalur',
      'nagapattinam': 'Nagapattinam',
      'nagai': 'Nagapattinam',
      'நாகப்பட்டினம்': 'Nagapattinam',
      'thiruvarur': 'Thiruvarur',
      'tiruvarur': 'Thiruvarur',
      'திருவாரூர்': 'Thiruvarur',
      'mayiladuthurai': 'Mayiladuthurai',
      'மயிலாடுதுறை': 'Mayiladuthurai',
      'pudukkottai': 'Pudukkottai',
      'புதுக்கோட்டை': 'Pudukkottai',
      'sivaganga': 'Sivaganga',
      'sivagangai': 'Sivaganga',
      'சிவகங்கை': 'Sivaganga',
      'ramanathapuram': 'Ramanathapuram',
      'ramnad': 'Ramanathapuram',
      'ராமநாதபுரம்': 'Ramanathapuram',
      'virudhunagar': 'Virudhunagar',
      'விருதுநகர்': 'Virudhunagar',
      'tenkasi': 'Tenkasi',
      'தென்காசி': 'Tenkasi',
      'kanniyakumari': 'Kanniyakumari',
      'kanyakumari': 'Kanniyakumari',
      'கன்னியாகுமரி': 'Kanniyakumari',
      'theni': 'Theni',
      'தேனி': 'Theni',
      'the nilgiris': 'The Nilgiris',
      'nilgiris': 'The Nilgiris',
      'ooty': 'The Nilgiris',
      'நீலகிரி': 'The Nilgiris',
      'tirupathur': 'Tirupathur',
      'திருப்பத்தூர்': 'Tirupathur',
      'ranipet': 'Ranipet',
      'ராணிப்பேட்டை': 'Ranipet',
      'kallakurichi': 'Kallakurichi',
      'கள்ளக்குறிச்சி': 'Kallakurichi',
      'tiruvannamalai': 'Tiruvannamalai',
      'thiruvannamalai': 'Tiruvannamalai',
      'திருவண்ணாமலை': 'Tiruvannamalai'
    };

    // Load dataset immediately in background
    this.initPromise = this.loadDataset();
  }

  async loadDataset() {
    if (this.isLoaded) return true;
    if (this.isLoading) return this.initPromise;
    this.isLoading = true;

    const dataPath = path.resolve(__dirname, '../../data/FINAL_SOIL_SUITABILITY_DATASET.csv');
    if (!fs.existsSync(dataPath)) {
      console.error('Soil dataset not found at:', dataPath);
      this.isLoading = false;
      return false;
    }

    console.log('Loading Soil Suitability Dataset into memory...');
    const startTime = Date.now();

    try {
      const fileStream = fs.createReadStream(dataPath);
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

      let count = 0;
      for await (const line of rl) {
        if (count === 0) { count++; continue; }
        const cols = line.split(',');
        const dist = cols[1];
        const crop = cols[4];
        if (!dist || !crop) continue;

        const temp = parseFloat(cols[5]) || 0;
        const hum = parseFloat(cols[6]) || 0;
        const moist = parseFloat(cols[7]) || 0;
        const suitScore = parseFloat(cols[14]) || 0;
        const suitStatus = cols[15] || 'Suitable';

        this.districtsSet.add(dist);
        this.cropsSet.add(crop);

        const distKey = dist.toLowerCase().trim();
        const cropKey = crop.toLowerCase().trim();
        const key = `${distKey}___${cropKey}`;

        let stat = this.districtCropMap.get(key);
        if (!stat) {
          stat = {
            district: dist,
            crop: crop,
            total: 0,
            suitable: 0,
            needsImprovement: 0,
            notSuitable: 0,
            sumScore: 0,
            sumTemp: 0,
            sumHum: 0,
            sumMoist: 0,
            min_temp: parseFloat(cols[24]) || 0,
            max_temp: parseFloat(cols[25]) || 0,
            min_ph: parseFloat(cols[22]) || 0,
            max_ph: parseFloat(cols[23]) || 0,
            min_hum: parseFloat(cols[30]) || 0,
            max_hum: parseFloat(cols[31]) || 0,
            N_req: cols[26] || 'Medium',
            P_req: cols[27] || 'Medium',
            K_req: cols[28] || 'Medium',
            water_req: cols[29] || 'Medium'
          };
          this.districtCropMap.set(key, stat);
        }

        stat.total++;
        stat.sumScore += suitScore;
        stat.sumTemp += temp;
        stat.sumHum += hum;
        stat.sumMoist += moist;
        if (suitStatus === 'Suitable') stat.suitable++;
        else if (suitStatus === 'Needs Improvement') stat.needsImprovement++;
        else stat.notSuitable++;

        if (!this.cropMetaMap.has(cropKey)) {
          this.cropMetaMap.set(cropKey, {
            crop,
            min_temp: parseFloat(cols[24]) || 0,
            max_temp: parseFloat(cols[25]) || 0,
            min_ph: parseFloat(cols[22]) || 0,
            max_ph: parseFloat(cols[23]) || 0,
            min_hum: parseFloat(cols[30]) || 0,
            max_hum: parseFloat(cols[31]) || 0,
            N_req: cols[26] || 'Medium',
            P_req: cols[27] || 'Medium',
            K_req: cols[28] || 'Medium',
            water_req: cols[29] || 'Medium'
          });
        }

        count++;
      }

      // Compute averages and compile ranked district crop lists
      for (const stat of this.districtCropMap.values()) {
        stat.avgScore = parseFloat((stat.sumScore / stat.total).toFixed(2));
        stat.avgTemp = parseFloat((stat.sumTemp / stat.total).toFixed(2));
        stat.avgHum = parseFloat((stat.sumHum / stat.total).toFixed(2));
        stat.avgMoist = parseFloat((stat.sumMoist / stat.total).toFixed(2));
        stat.suitablePercentage = parseFloat(((stat.suitable / stat.total) * 100).toFixed(2));
        stat.needsImprovementPercentage = parseFloat(((stat.needsImprovement / stat.total) * 100).toFixed(2));
        stat.notSuitablePercentage = parseFloat(((stat.notSuitable / stat.total) * 100).toFixed(2));

        const distKey = stat.district.toLowerCase().trim();
        if (!this.districtCropsList.has(distKey)) {
          this.districtCropsList.set(distKey, []);
        }
        this.districtCropsList.get(distKey).push(stat);
      }

      // Sort district crop lists by: 1) avgScore desc, 2) suitablePercentage desc, 3) notSuitablePercentage asc
      for (const list of this.districtCropsList.values()) {
        list.sort((a, b) => {
          if (b.avgScore !== a.avgScore) return b.avgScore - a.avgScore;
          if (b.suitablePercentage !== a.suitablePercentage) return b.suitablePercentage - a.suitablePercentage;
          return a.notSuitablePercentage - b.notSuitablePercentage;
        });
      }

      this.isLoaded = true;
      this.isLoading = false;
      const duration = Date.now() - startTime;
      console.log(`Soil dataset loaded: ${count - 1} rows across ${this.districtsSet.size} districts & ${this.cropsSet.size} crops in ${duration}ms`);
      return true;
    } catch (err) {
      console.error('Error loading soil dataset:', err);
      this.isLoading = false;
      return false;
    }
  }

  async ensureLoaded() {
    if (!this.isLoaded) {
      await this.initPromise;
    }
  }

  normalizeCrop(inputCrop) {
    if (!inputCrop || typeof inputCrop !== 'string') return null;
    const clean = inputCrop.toLowerCase().trim().replace(/^(crop|பயிர்)\s+/i, '');
    
    // Direct match
    if (this.cropsSet.has(clean)) return clean;
    
    // Case-insensitive match in set
    for (const c of this.cropsSet) {
      if (c.toLowerCase() === clean) return c;
    }

    // Check alias dictionary
    if (this.cropAliases[clean]) return this.cropAliases[clean];

    // Partial contains check
    for (const [alias, standard] of Object.entries(this.cropAliases)) {
      if (clean.includes(alias) || alias.includes(clean)) {
        return standard;
      }
    }

    for (const c of this.cropsSet) {
      if (clean.includes(c.toLowerCase()) || c.toLowerCase().includes(clean)) {
        return c;
      }
    }

    return null;
  }

  normalizeDistrict(inputDist) {
    if (!inputDist || typeof inputDist !== 'string') return { isChennai: false, district: null };
    const clean = inputDist.toLowerCase().trim().replace(/(district|மாவட்டம்|dist|dt)$/i, '').trim();

    // Check Chennai specifically
    if (clean === 'chennai' || clean === 'சென்னை') {
      return { isChennai: true, district: null };
    }

    // Direct match
    for (const d of this.districtsSet) {
      if (d.toLowerCase() === clean) return { isChennai: false, district: d };
    }

    // Check alias dictionary
    if (this.districtAliases[clean]) {
      return { isChennai: false, district: this.districtAliases[clean] };
    }

    // Partial match
    for (const [alias, standard] of Object.entries(this.districtAliases)) {
      if (clean.includes(alias) || alias.includes(clean)) {
        return { isChennai: false, district: standard };
      }
    }

    for (const d of this.districtsSet) {
      if (clean.includes(d.toLowerCase()) || d.toLowerCase().includes(clean)) {
        return { isChennai: false, district: d };
      }
    }

    return { isChennai: false, district: null };
  }

  async getCropSuitability(rawCrop, rawDistrict) {
    await this.ensureLoaded();

    const distObj = this.normalizeDistrict(rawDistrict);
    if (distObj.isChennai) {
      return {
        success: false,
        error: 'Chennai is not present in the Tamil Nadu soil dataset (NPK records are not available for urban Chennai).',
        isChennai: true
      };
    }
    const district = distObj.district;
    if (!district) {
      return {
        success: false,
        error: `District "${rawDistrict}" not found in Tamil Nadu soil records. Please provide a valid Tamil Nadu district.`,
        availableDistricts: Array.from(this.districtsSet).sort()
      };
    }

    const crop = this.normalizeCrop(rawCrop);
    if (!crop) {
      return {
        success: false,
        error: `Crop "${rawCrop}" not found in dataset. Please check the crop name.`,
        availableCrops: Array.from(this.cropsSet).sort()
      };
    }

    const key = `${district.toLowerCase().trim()}___${crop.toLowerCase().trim()}`;
    const stat = this.districtCropMap.get(key);

    if (!stat) {
      // Fallback: get crop meta and district average climate
      const cropMeta = this.cropMetaMap.get(crop.toLowerCase().trim());
      return {
        success: true,
        crop,
        district,
        suitablePercentage: 0,
        avgSuitabilityScore: 0,
        classification: 'Data Not Available',
        summary: `No direct suitability records found for ${crop} in ${district}.`,
        cropRequirements: cropMeta || null
      };
    }

    let classification = 'Suitable';
    if (stat.avgScore < 50) classification = 'Not Suitable';
    else if (stat.avgScore < 75) classification = 'Needs Improvement';

    return {
      success: true,
      crop: stat.crop,
      district: stat.district,
      suitablePercentage: stat.suitablePercentage,
      needsImprovementPercentage: stat.needsImprovementPercentage,
      notSuitablePercentage: stat.notSuitablePercentage,
      avgSuitabilityScore: stat.avgScore,
      classification,
      summary: `${stat.crop} is ${classification} in ${stat.district} with an average suitability score of ${stat.avgScore}/100 (${stat.suitablePercentage}% suitable records).`,
      climateRecorded: {
        avgTemperature: stat.avgTemp,
        avgHumidity: stat.avgHum,
        avgMoisture: stat.avgMoist
      },
      cropRequirements: {
        minTemp: stat.min_temp,
        maxTemp: stat.max_temp,
        minHumidity: stat.min_hum,
        maxHumidity: stat.max_hum,
        minPh: stat.min_ph,
        maxPh: stat.max_ph,
        nitrogenReq: stat.N_req,
        phosphorusReq: stat.P_req,
        potassiumReq: stat.K_req,
        waterReq: stat.water_req
      }
    };
  }

  async getWaterRequirement(rawCrop, rawDistrict) {
    await this.ensureLoaded();

    const crop = this.normalizeCrop(rawCrop);
    if (!crop) {
      return {
        success: false,
        error: `Crop "${rawCrop}" not found in dataset.`
      };
    }

    const cropMeta = this.cropMetaMap.get(crop.toLowerCase().trim());
    const waterVal = cropMeta?.water_req || 'Medium';

    // Format description without producing NaN
    const isNum = !isNaN(parseFloat(waterVal)) && isFinite(waterVal);
    const formattedRequirement = isNum 
      ? `The water requirement for ${crop} is approximately ${waterVal} mm.`
      : `The water requirement for ${crop} is ${waterVal}.`;

    return {
      success: true,
      crop: cropMeta?.crop || crop,
      waterRequirement: waterVal,
      isNumeric: isNum,
      formattedRequirement
    };
  }

  async getCropClimate(rawCrop, rawDistrict) {
    await this.ensureLoaded();

    const crop = this.normalizeCrop(rawCrop);
    if (!crop) {
      return {
        success: false,
        error: `Crop "${rawCrop}" not found in dataset.`
      };
    }

    const cropMeta = this.cropMetaMap.get(crop.toLowerCase().trim());
    const distObj = rawDistrict ? this.normalizeDistrict(rawDistrict) : { district: null };
    const district = distObj.district;

    let recordedClimate = null;
    if (district) {
      const key = `${district.toLowerCase().trim()}___${crop.toLowerCase().trim()}`;
      const stat = this.districtCropMap.get(key);
      if (stat) {
        recordedClimate = {
          district: stat.district,
          avgTemperature: stat.avgTemp,
          avgHumidity: stat.avgHum,
          avgMoisture: stat.avgMoist
        };
      }
    }

    const minTemp = cropMeta?.min_temp || 0;
    const maxTemp = cropMeta?.max_temp || 0;
    const minHum = cropMeta?.min_hum || 0;
    const maxHum = cropMeta?.max_hum || 0;

    let explanation = `${cropMeta?.crop || crop} generally requires a temperature range of ${minTemp}–${maxTemp}°C and humidity around ${minHum}–${maxHum}%.`;
    if (recordedClimate) {
      explanation += ` In ${recordedClimate.district}, the recorded average temperature is ${recordedClimate.avgTemperature}°C and average humidity is ${recordedClimate.avgHumidity}%.`;
    }

    return {
      success: true,
      crop: cropMeta?.crop || crop,
      district: district || null,
      cropRequirements: {
        minTemperature: minTemp,
        maxTemperature: maxTemp,
        minHumidity: minHum,
        maxHumidity: maxHum
      },
      recordedClimate,
      explanation
    };
  }

  async getSuitableCrops(rawDistrict) {
    await this.ensureLoaded();

    const distObj = this.normalizeDistrict(rawDistrict);
    if (distObj.isChennai) {
      return {
        success: false,
        error: 'Chennai is not present in the Tamil Nadu soil dataset (NPK records are not available for urban Chennai).',
        isChennai: true
      };
    }
    const district = distObj.district;
    if (!district) {
      return {
        success: false,
        error: `District "${rawDistrict}" not found. Please specify a valid Tamil Nadu district.`,
        availableDistricts: Array.from(this.districtsSet).sort()
      };
    }

    const cropsList = this.districtCropsList.get(district.toLowerCase().trim()) || [];
    const topCrops = cropsList.slice(0, 10).map(stat => {
      let classification = 'Suitable';
      if (stat.avgScore < 50) classification = 'Not Suitable';
      else if (stat.avgScore < 75) classification = 'Needs Improvement';

      return {
        crop: stat.crop,
        avgSuitabilityScore: stat.avgScore,
        suitablePercentage: stat.suitablePercentage,
        classification,
        waterRequirement: stat.water_req,
        temperatureRange: `${stat.min_temp}–${stat.max_temp}°C`,
        humidityRange: `${stat.min_hum}–${stat.max_hum}%`
      };
    });

    return {
      success: true,
      district,
      totalCropsAnalyzed: cropsList.length,
      topCrops,
      primaryRecommendation: topCrops[0] || null
    };
  }

  async checkManualSoilSuitability(params) {
    await this.ensureLoaded();

    const {
      district: rawDistrict,
      soilType,
      crop: rawCrop,
      nitrogen,
      phosphorus,
      potassium,
      temperature,
      humidity,
      moisture
    } = params;

    // 1. Validation of required inputs
    const N = parseFloat(nitrogen);
    const P = parseFloat(phosphorus);
    const K = parseFloat(potassium);
    const Temp = parseFloat(temperature);
    const Hum = parseFloat(humidity);
    const Moist = parseFloat(moisture);

    if (isNaN(N) || isNaN(P) || isNaN(K) || isNaN(Temp) || isNaN(Hum) || isNaN(Moist)) {
      return {
        success: false,
        error: 'Invalid input. Nitrogen, Phosphorus, Potassium, Temperature, Humidity, and Moisture must all be valid numbers.'
      };
    }

    if (N < 0 || P < 0 || K < 0 || Hum < 0 || Hum > 100 || Moist < 0) {
      return {
        success: false,
        error: 'Invalid sensor/manual values. Values cannot be negative, and humidity must be between 0 and 100.'
      };
    }

    const crop = this.normalizeCrop(rawCrop);
    if (!crop) {
      return {
        success: false,
        error: `Crop "${rawCrop}" is not recognized in the dataset. Please provide a valid crop name.`,
        availableCrops: Array.from(this.cropsSet).sort()
      };
    }

    const distObj = rawDistrict ? this.normalizeDistrict(rawDistrict) : { district: null };
    const district = distObj.district || 'Tamil Nadu (General)';

    const cropMeta = this.cropMetaMap.get(crop.toLowerCase().trim());
    if (!cropMeta) {
      return {
        success: false,
        error: `Crop metadata not found for ${crop}.`
      };
    }

    // 2. Compute individual parameter scores (0 to 1 scale)
    // NPK Status estimation: Low (<25 mg/kg), Medium (25-55 mg/kg), High (>55 mg/kg)
    const getNStatus = (val) => val < 25 ? 'Low' : val <= 55 ? 'Medium' : 'High';
    const getPStatus = (val) => val < 15 ? 'Low' : val <= 35 ? 'Medium' : 'High';
    const getKStatus = (val) => val < 20 ? 'Low' : val <= 45 ? 'Medium' : 'High';

    const nStatus = getNStatus(N);
    const pStatus = getPStatus(P);
    const kStatus = getKStatus(K);

    const calcStatusScore = (actualStatus, reqStatus) => {
      const order = { 'Low': 1, 'Medium': 2, 'High': 3 };
      const diff = Math.abs((order[actualStatus] || 2) - (order[reqStatus] || 2));
      if (diff === 0) return 1.0;
      if (diff === 1) return 0.75;
      return 0.40;
    };

    const nScore = calcStatusScore(nStatus, cropMeta.N_req);
    const pScore = calcStatusScore(pStatus, cropMeta.P_req);
    const kScore = calcStatusScore(kStatus, cropMeta.K_req);

    // Temperature Score
    let tempScore = 1.0;
    if (Temp < cropMeta.min_temp) {
      const diff = cropMeta.min_temp - Temp;
      tempScore = Math.max(0.2, 1.0 - (diff * 0.08));
    } else if (Temp > cropMeta.max_temp) {
      const diff = Temp - cropMeta.max_temp;
      tempScore = Math.max(0.2, 1.0 - (diff * 0.08));
    }
    tempScore = parseFloat(tempScore.toFixed(2));

    // Humidity Score
    let humScore = 1.0;
    const minHum = cropMeta.min_hum || 50;
    const maxHum = cropMeta.max_hum || 85;
    if (Hum < minHum) {
      const diff = minHum - Hum;
      humScore = Math.max(0.2, 1.0 - (diff * 0.03));
    } else if (Hum > maxHum) {
      const diff = Hum - maxHum;
      humScore = Math.max(0.2, 1.0 - (diff * 0.03));
    }
    humScore = parseFloat(humScore.toFixed(2));

    // Moisture Score (Normal acceptable moisture is 2% - 15%)
    let moistScore = 1.0;
    if (Moist < 1.0) moistScore = 0.5;
    else if (Moist < 2.0) moistScore = 0.8;
    else if (Moist > 20.0) moistScore = 0.6;
    else if (Moist > 12.0) moistScore = 0.85;

    // 3. Overall suitability score (0-100 scale)
    const overallScore = parseFloat((((nScore + pScore + kScore + tempScore + humScore + moistScore) / 6) * 100).toFixed(1));

    // 4. Final Classification
    let classification = 'Suitable';
    let statusEmoji = '✅';
    if (overallScore < 50) {
      classification = 'Not Suitable';
      statusEmoji = '❌';
    } else if (overallScore < 75) {
      classification = 'Needs Improvement';
      statusEmoji = '⚠️';
    }

    // 5. Strengths & Improvements & Recommendations
    const strengths = [];
    const improvements = [];

    if (tempScore >= 0.85) strengths.push(`Temperature (${Temp}°C) is well within the preferred range (${cropMeta.min_temp}–${cropMeta.max_temp}°C).`);
    else improvements.push(`Temperature (${Temp}°C) is outside the optimal range (${cropMeta.min_temp}–${cropMeta.max_temp}°C).`);

    if (humScore >= 0.85) strengths.push(`Humidity (${Hum}%) is favorable for ${cropMeta.crop}.`);
    else improvements.push(`Humidity (${Hum}%) deviates from the preferred level (${minHum}–${maxHum}%).`);

    if (moistScore >= 0.85) strengths.push(`Soil moisture (${Moist}%) is adequate.`);
    else improvements.push(`Soil moisture (${Moist}%) needs monitoring.`);

    if (nScore >= 0.8) strengths.push(`Nitrogen level (${N} mg/kg) satisfies crop requirement (${cropMeta.N_req}).`);
    else improvements.push(`Nitrogen (${N} mg/kg - ${nStatus}) is ${nStatus === 'Low' ? 'below' : 'above'} the recommended ${cropMeta.N_req} requirement.`);

    if (pScore >= 0.8) strengths.push(`Phosphorus level (${P} mg/kg) is adequate.`);
    else improvements.push(`Phosphorus (${P} mg/kg) requires adjustment for optimal yield.`);

    if (kScore >= 0.8) strengths.push(`Potassium level (${K} mg/kg) is optimal.`);
    else improvements.push(`Potassium (${K} mg/kg) could be balanced.`);

    // Recommendations
    let recommendation = '';
    if (classification === 'Suitable') {
      recommendation = `${cropMeta.crop} is well-suited for planting under these conditions. Ensure standard irrigation and basal fertilizer application as per agricultural guidelines.`;
    } else if (classification === 'Needs Improvement') {
      recommendation = `Consider enriching the soil with recommended organic manure or targeted fertilizer (${improvements[0] || 'NPK adjustment'}) prior to sowing to achieve optimal yield.`;
    } else {
      recommendation = `Soil and environmental conditions are currently unfavorable for ${cropMeta.crop}. Consider choosing an alternative crop or undertaking soil remediation.`;
    }

    return {
      success: true,
      crop: cropMeta.crop,
      district,
      soilType: soilType || 'Not specified (Recorded)',
      soilTypeNote: soilType ? 'Soil type was recorded for reference.' : 'No soil type specified.',
      inputs: {
        nitrogen: N,
        phosphorus: P,
        potassium: K,
        temperature: Temp,
        humidity: Hum,
        moisture: Moist
      },
      scores: {
        nitrogenScore: nScore,
        phosphorusScore: pScore,
        potassiumScore: kScore,
        temperatureScore: tempScore,
        humidityScore: humScore,
        moistureScore: moistScore,
        overallSuitabilityScore: overallScore
      },
      classification,
      statusEmoji,
      strengths,
      improvements,
      recommendation,
      cropRequirements: {
        minTemp: cropMeta.min_temp,
        maxTemp: cropMeta.max_temp,
        minHumidity: cropMeta.min_hum,
        maxHumidity: cropMeta.max_hum,
        minPh: cropMeta.min_ph,
        maxPh: cropMeta.max_ph,
        nitrogenReq: cropMeta.N_req,
        phosphorusReq: cropMeta.P_req,
        potassiumReq: cropMeta.K_req,
        waterReq: cropMeta.water_req
      }
    };
  }
}

const soilService = new SoilService();
module.exports = soilService;
