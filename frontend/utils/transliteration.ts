const commonNameMap: Record<string, string> = {
  // English to Devanagari
  "rahul": "राहुल",
  "amit": "अमित",
  "sandeep": "संदीप",
  "sandip": "संदीप",
  "vijay": "विजय",
  "ramesh": "रमेश",
  "suresh": "सुरेश",
  "kamlesh": "कमलेश",
  "ganesh": "गणेश",
  "sunil": "सुनील",
  "anil": "अनिल",
  "vikram": "विक्रम",
  "ajay": "अजय",
  "rajesh": "राजेश",
  "karan": "करण",
  "arjun": "अर्जुन",
  "sachin": "सचिन",
  "pooja": "पूजा",
  "aarti": "आरती",
  "sunita": "सुनीता",
  "savita": "सविता",
  "deepak": "दीपक",
  "pradeep": "प्रदीप",
  "sanjay": "संजय",
  "mahesh": "महेश",
  "dinesh": "दिनेश",
  "umesh": "उमेश",
  "rakesh": "राकेश",
  "manoj": "मनोज",
  "pankaj": "पंकज",
  "vinod": "विनोद",
  "ashok": "अशोक",
  "kishore": "किशोर",
  "harish": "हरीश",
  "satish": "सतीश",
  "vikas": "विकास",
  "vishal": "विशाल",
  "siddharth": "सिद्धार्थ",
  "pandit": "पंडित",
  "mistry": "मिस्त्री",
  "bai": "बाई",
  "rahul pandit": "राहुल पंडित",
  "sandip pandit": "संदीप पंडित",
  "sandeep pandit": "संदीप पंडित",
  "aman": "अमन",
  "singh": "सिंह",
  "aman singh": "अमन सिंह",

  // Devanagari to English
  "राहुल": "Rahul",
  "अमित": "Amit",
  "संदीप": "Sandeep",
  "विजय": "Vijay",
  "रमेश": "Ramesh",
  "सुरेश": "Suresh",
  "कमलेश": "Kamlesh",
  "गणेश": "Ganesh",
  "सुनील": "Sunil",
  "अनिल": "Anil",
  "विक्रम": "Vikram",
  "अजय": "Ajay",
  "राजेश": "Rajesh",
  "करण": "Karan",
  "अर्जुन": "Arjun",
  "सचिन": "Sachin",
  "पूजा": "Pooja",
  "आरती": "Aarti",
  "सुनीता": "Sunita",
  "सविता": "Savita",
  "दीपक": "Deepak",
  "प्रदीप": "Pradeep",
  "संजय": "Sanjay",
  "महेश": "Mahesh",
  "दिनेश": "Dinesh",
  "उमेश": "Umesh",
  "राकेश": "Rakesh",
  "मनोज": "Manoj",
  "पंकज": "Pankaj",
  "विनोद": "Vinod",
  "अशोक": "Ashok",
  "किशोर": "Kishore",
  "हरीश": "Harish",
  "सतीश": "Satish",
  "विकास": "Vikas",
  "विशाल": "Vishal",
  "सिद्धार्थ": "Siddharth",
  "पंडित": "Pandit",
  "मिस्त्री": "Mistry",
  "बाई": "Bai",
  "अमन": "Aman",
  "सिंह": "Singh",
  "अमन सिंह": "Aman Singh"
};

function fallbackEnglishToDevanagari(name: string): string {
  let res = name.toLowerCase();

  res = res.replace(/sh/g, "श");
  res = res.replace(/ch/g, "च");
  res = res.replace(/kh/g, "ख");
  res = res.replace(/gh/g, "घ");
  res = res.replace(/th/g, "थ");
  res = res.replace(/bh/g, "भ");
  res = res.replace(/ph/g, "फ");
  res = res.replace(/dh/g, "ध");
  res = res.replace(/jh/g, "झ");

  res = res.replace(/a/g, "ा");
  res = res.replace(/e/g, "े");
  res = res.replace(/i/g, "ि");
  res = res.replace(/o/g, "ो");
  res = res.replace(/u/g, "ु");

  res = res.replace(/b/g, "ब");
  res = res.replace(/c/g, "क");
  res = res.replace(/d/g, "द");
  res = res.replace(/f/g, "फ");
  res = res.replace(/g/g, "ग");
  res = res.replace(/h/g, "ह");
  res = res.replace(/j/g, "ज");
  res = res.replace(/k/g, "क");
  res = res.replace(/l/g, "ल");
  res = res.replace(/m/g, "म");
  res = res.replace(/n/g, "न");
  res = res.replace(/p/g, "प");
  res = res.replace(/r/g, "र");
  res = res.replace(/s/g, "स");
  res = res.replace(/t/g, "त");
  res = res.replace(/v/g, "व");
  res = res.replace(/w/g, "व");
  res = res.replace(/y/g, "य");
  res = res.replace(/z/g, "ज");

  if (res.startsWith("ा")) res = "आ" + res.slice(1);
  else if (res.startsWith("ि")) res = "इ" + res.slice(1);
  else if (res.startsWith("ु")) res = "उ" + res.slice(1);
  else if (res.startsWith("े")) res = "ए" + res.slice(1);
  else if (res.startsWith("ो")) res = "ओ" + res.slice(1);

  return res;
}

export function translateWorkerName(name: string, targetLang: string): string {
  if (!name) return "";
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();

  const isTargetDevanagari = targetLang === "hi" || targetLang === "mr";
  const isInputDevanagari = /[\u0900-\u097F]/.test(trimmed);

  if (isTargetDevanagari && isInputDevanagari) return trimmed;
  if (!isTargetDevanagari && !isInputDevanagari) return trimmed;

  if (commonNameMap[lower]) {
    const match = commonNameMap[lower];
    if (!isTargetDevanagari) {
      return match
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
    return match;
  }

  if (isTargetDevanagari) {
    return trimmed
      .split(" ")
      .map((word) => {
        const wLower = word.toLowerCase();
        if (commonNameMap[wLower]) return commonNameMap[wLower];
        return fallbackEnglishToDevanagari(word);
      })
      .join(" ");
  } else {
    return trimmed
      .split(" ")
      .map((word) => {
        const foundKey = Object.keys(commonNameMap).find((k) => k === word);
        if (foundKey && commonNameMap[foundKey]) {
          const eng = commonNameMap[foundKey];
          return eng.charAt(0).toUpperCase() + eng.slice(1);
        }
        return word;
      })
      .join(" ");
  }
}
