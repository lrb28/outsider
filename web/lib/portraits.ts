// Investor portraits from Wikimedia Commons, each with its author and licence
// so the credits on /methodik are exact. Served directly, no runtime lookup.
// Only freely licensed files are listed; people without one get an aura
// monogram. Members of Congress use their official public-domain portraits
// (lib/politicians.ts), not this list.
/** `focus`: where the face is (percent of width/height) and how far to zoom
 *  in, for group shots where the plain top crop shows someone else too. */
export type Portrait = { name: string; src: string; author: string; license: string; page: string; focus?: { x: number; y: number; zoom: number } };

export const PORTRAITS: Record<string, Portrait> = {
  "Warren_Buffett": { name: "Warren Buffett", src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d4/Warren_Buffett_at_the_2015_SelectUSA_Investment_Summit_%28cropped%29.jpg/330px-Warren_Buffett_at_the_2015_SelectUSA_Investment_Summit_%28cropped%29.jpg", author: "USA International Trade Administration", license: "Public domain", page: "https://commons.wikimedia.org/wiki/File:Warren_Buffett_at_the_2015_SelectUSA_Investment_Summit_(cropped).jpg" },
  "Bill_Ackman": { name: "Bill Ackman", src: "https://upload.wikimedia.org/wikipedia/commons/0/07/Valeant_Pharmaceuticals%27_Business_Model_%28headshot%29.jpg", author: "Senate Democrats", license: "CC BY 2.0", page: "https://commons.wikimedia.org/wiki/File:Valeant_Pharmaceuticals%27_Business_Model_(headshot).jpg" },
  "George_Soros": { name: "George Soros", src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/97/George_Soros%2C_Founder_and_Chairman_of_the_Open_Society_Foundations%2C_visits_the_EC_%283x4_cropped%29.jpg/330px-George_Soros%2C_Founder_and_Chairman_of_the_Open_Society_Foundations%2C_visits_the_EC_%283x4_cropped%29.jpg", author: "Aris Oikonomou / European Commission", license: "CC BY 4.0", page: "https://commons.wikimedia.org/wiki/File:George_Soros,_Founder_and_Chairman_of_the_Open_Society_Foundations,_visits_the_EC_(3x4_cropped).jpg" },
  "Charlie_Munger": { name: "Charlie Munger", src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/56/Charlie_Munger_%28cropped%29.jpg/330px-Charlie_Munger_%28cropped%29.jpg", author: "Nick", license: "CC BY 2.0", page: "https://commons.wikimedia.org/wiki/File:Charlie_Munger_(cropped).jpg" },
  "Ray_Dalio": { name: "Ray Dalio", src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1f/Web_Summit_2018_-_Forum_-_Day_2%2C_November_7_HM1_7481_%2844858045925%29.jpg/330px-Web_Summit_2018_-_Forum_-_Day_2%2C_November_7_HM1_7481_%2844858045925%29.jpg", author: "Web Summit", license: "CC BY 2.0", page: "https://commons.wikimedia.org/wiki/File:Web_Summit_2018_-_Forum_-_Day_2,_November_7_HM1_7481_(44858045925).jpg" },
  "Steven_A._Cohen": { name: "Steven A. Cohen", src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Steve_baseball_4_%281%29_%28cropped%29.jpg/330px-Steve_baseball_4_%281%29_%28cropped%29.jpg", author: "Michael Seib", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:Steve_baseball_4_(1)_(cropped).jpg" },
  "Seth_Klarman": { name: "Seth Klarman", src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b8/Seth_Klarman_at_147th_Preakness_Stakes.jpg/330px-Seth_Klarman_at_147th_Preakness_Stakes.jpg", author: "Maryland GovPics", license: "CC BY 2.0", page: "https://commons.wikimedia.org/wiki/File:Seth_Klarman_at_147th_Preakness_Stakes.jpg" },
  "Nancy_Pelosi": { name: "Nancy Pelosi", src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a5/Official_photo_of_Speaker_Nancy_Pelosi_in_2019.jpg/330px-Official_photo_of_Speaker_Nancy_Pelosi_in_2019.jpg", author: "John Harrington", license: "Public domain", page: "https://commons.wikimedia.org/wiki/File:Official_photo_of_Speaker_Nancy_Pelosi_in_2019.jpg" },
  "Mohnish_Pabrai": { name: "Mohnish Pabrai", src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0d/Mohnish_Pabrai.jpg/330px-Mohnish_Pabrai.jpg", author: "Fabarsi", license: "CC BY-SA 3.0", page: "https://commons.wikimedia.org/wiki/File:Mohnish_Pabrai.jpg" },
  "Carl_Icahn": { name: "Carl Icahn", src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ad/Carl_Icahn%2C_1980s.jpg/330px-Carl_Icahn%2C_1980s.jpg", author: "AviateHistory", license: "CC0", page: "https://commons.wikimedia.org/wiki/File:Carl_Icahn,_1980s.jpg" },
  "Bill_Gates": { name: "Bill Gates", src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d9/Bill_Gates_at_the_European_Commission_-_P067383-987995_%28cropped%29_5.jpg/330px-Bill_Gates_at_the_European_Commission_-_P067383-987995_%28cropped%29_5.jpg", author: "Bogdan Hoyaux / European Union", license: "CC BY 4.0", page: "https://commons.wikimedia.org/wiki/File:Bill_Gates_at_the_European_Commission_-_P067383-987995_(cropped)_5.jpg" },
  "Cathie_Wood": { name: "Cathie Wood", src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/44/Cathie_Wood_ARK_Invest_Photo.jpg/330px-Cathie_Wood_ARK_Invest_Photo.jpg", author: "Caroline Wood", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:Cathie_Wood_ARK_Invest_Photo.jpg" },
  "David_Tepper": { name: "David Tepper", src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3d/David_Tepper_01.jpg/330px-David_Tepper_01.jpg", author: "Appaloosa Management", license: "CC BY-SA 3.0", page: "https://commons.wikimedia.org/wiki/File:David_Tepper_01.jpg" },
  "Terry_Smith": { name: "Terry Smith", src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7b/Terry_Smith_MNZM_investiture.jpg/330px-Terry_Smith_MNZM_investiture.jpg", author: "New Zealand Government, Office of the Governor-General", license: "CC BY 4.0", page: "https://commons.wikimedia.org/wiki/File:Terry_Smith_MNZM_investiture.jpg" },
  "Howard_Marks": { name: "Howard Marks", src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8b/Howard_Marks_2.17.12_%28cropped%29.jpg/330px-Howard_Marks_2.17.12_%28cropped%29.jpg", author: "kellywritershouse", license: "CC BY 2.0", page: "https://commons.wikimedia.org/wiki/File:Howard_Marks_2.17.12_(cropped).jpg" },
  "Brad_Gerstner": { name: "Brad Gerstner", src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8d/Brad_Gerstner_at_the_White_House_2025_%2854581192563%29.jpg/330px-Brad_Gerstner_at_the_White_House_2025_%2854581192563%29.jpg", author: "The White House", license: "Public domain", page: "https://commons.wikimedia.org/wiki/File:Brad_Gerstner_at_the_White_House_2025_(54581192563).jpg", focus: { x: 36, y: 28, zoom: 1.9 } },
  "Prem_Watsa": { name: "Prem Watsa", src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c9/Prem_Watsa.jpg/330px-Prem_Watsa.jpg", author: "செல்வா at Tamil Wikipedia", license: "CC BY 3.0", page: "https://commons.wikimedia.org/wiki/File:Prem_Watsa.jpg" },
  "Paul_Singer": { name: "Paul Singer", src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9c/The_Global_Financial_Context_Paul_Singer_%28cropped%29.jpg/330px-The_Global_Financial_Context_Paul_Singer_%28cropped%29.jpg", author: "World Economic Forum", license: "CC BY-SA 2.0", page: "https://commons.wikimedia.org/wiki/File:The_Global_Financial_Context_Paul_Singer_(cropped).jpg" },
  "Jim_Simons": { name: "Jim Simons", src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7f/Jim_Simons_at_MSRI.jpg/330px-Jim_Simons_at_MSRI.jpg", author: "Gleuschk", license: "CC BY-SA 3.0", page: "https://commons.wikimedia.org/wiki/File:Jim_Simons_at_MSRI.jpg" },
  "Paul_Tudor_Jones": { name: "Paul Tudor Jones", src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1d/Paul_Tudor_Jones_2006.jpg/330px-Paul_Tudor_Jones_2006.jpg", author: "U.S. Department of the Interior", license: "Public domain", page: "https://commons.wikimedia.org/wiki/File:Paul_Tudor_Jones_2006.jpg" },
  "Chris_Hohn": { name: "Chris Hohn", src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/31/Chris_Hohn_GFSS_2023.jpg/330px-Chris_Hohn_GFSS_2023.jpg", author: "Foreign, Commonwealth & Development Office", license: "CC BY 2.0", page: "https://commons.wikimedia.org/wiki/File:Chris_Hohn_GFSS_2023.jpg" },
  "Peter_Thiel": { name: "Peter Thiel", src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3e/Peter_Thiel_by_Gage_Skidmore.jpg/330px-Peter_Thiel_by_Gage_Skidmore.jpg", author: "Gage Skidmore", license: "CC BY-SA 3.0", page: "https://commons.wikimedia.org/wiki/File:Peter_Thiel_by_Gage_Skidmore.jpg" },
};

// Investors without a freely licensed portrait show the logo of their fund
// (served from /public/funds: the firm's website icon, or its public-domain
// text logo from Wikimedia Commons, cut down to the mark) instead of
// initials. Keyed like PORTRAITS. `tile` files are finished round-avatar
// tiles with their own background and padding; the others are bare marks
// that get a white disc.
export const FUND_LOGOS: Record<string, { src: string; fund: string; tile?: boolean }> = {
  Philippe_Laffont: { src: "/funds/coatue.png", fund: "Coatue Management", tile: true },
  Tom_Gayner: { src: "/funds/markel.png", fund: "Markel Group" },
  // The Commons file for Stephen Mandel is a caricature, not a photo.
  Stephen_Mandel: { src: "/funds/lone-pine.png", fund: "Lone Pine Capital" },
  Joseph_Edelman: { src: "/funds/perceptive.png", fund: "Perceptive Advisors" },
  Jeff_Smith: { src: "/funds/starboard.png", fund: "Starboard Value" },
  Chase_Coleman_III: { src: "/funds/tiger-global.png", fund: "Tiger Global Management", tile: true },
  Andreas_Halvorsen: { src: "/funds/viking.png", fund: "Viking Global Investors" },
  Leopold_Aschenbrenner: { src: "/funds/situational-awareness.svg", fund: "Situational Awareness" },
  Dan_Sundheim: { src: "/funds/d1.png", fund: "D1 Capital Partners", tile: true },
  Larry_Robbins: { src: "/funds/glenview.png", fund: "Glenview Capital Management", tile: true },
  Daniel_Loeb: { src: "/funds/thirdpoint.svg", fund: "Third Point", tile: true },
  Nelson_Peltz: { src: "/funds/trian.png", fund: "Trian Partners", tile: true },
  Chuck_Akre: { src: "/funds/akre.svg", fund: "Akre Capital Management", tile: true },
  Li_Lu: { src: "/funds/himalaya.png", fund: "Himalaya Capital", tile: true },
  Michael_Burry: { src: "/funds/scion.png", fund: "Scion Asset Management", tile: true },
  // The Commons files for Bruce Berkowitz and Lee Ainslie come from a hedge-fund
  // letters site whose free licence is doubtful, so they get their fund's mark.
  David_Einhorn: { src: "/funds/greenlight.png", fund: "Greenlight Capital" },
  Mason_Hawkins: { src: "/funds/southeastern.png", fund: "Southeastern Asset Management", tile: true },
  Mason_Morfit: { src: "/funds/valueact.png", fund: "ValueAct Capital", tile: true },
  David_Abrams: { src: "/funds/abrams.png", fund: "Abrams Capital", tile: true },
  Bruce_Berkowitz: { src: "/funds/fairholme.png", fund: "Fairholme Capital Management", tile: true },
  Dev_Kantesaria: { src: "/funds/valley-forge.png", fund: "Valley Forge Capital Management" },
  Chris_Bloomstran: { src: "/funds/semper-augustus.png", fund: "Semper Augustus Investments Group" },
  Francois_Rochon: { src: "/funds/giverny.svg", fund: "Giverny Capital" },
  John_Paulson: { src: "/funds/paulson.png", fund: "Paulson & Co." },
  Lee_Ainslie: { src: "/funds/maverick.png", fund: "Maverick Capital", tile: true },
  Nick_Train: { src: "/funds/lindsell-train.svg", fund: "Lindsell Train", tile: true },
  Bill_Nygren: { src: "/funds/oakmark.png", fund: "Harris | Oakmark", tile: true },
  Pat_Dorsey: { src: "/funds/dorsey.png", fund: "Dorsey Asset Management", tile: true },
  Bill_Miller: { src: "/funds/miller-value.svg", fund: "Miller Value Partners" },
  Henry_Ellenbogen: { src: "/funds/durable.svg", fund: "Durable Capital Partners" },
  Barry_Rosenstein: { src: "/funds/jana.svg", fund: "JANA Partners", tile: true },
};
