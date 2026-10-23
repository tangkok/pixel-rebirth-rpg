import { icon } from "./icons";
import {
  CLASSES,
  CLASS_IDS,
  RACES,
  RARITIES,
  raceById,
  subclassBonus,
  RACE_REROLL_COST,
  SUBCLASS_LEVEL,
  MAX_SKILL_RANK,
  type ClassId,
} from "./game/lineage";
import { skillPointsLeft, type TacticsSave } from "./game/tactics";
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function racePanel(save: TacticsSave) {
  const race = raceById(save.builds[0].raceId),
    tier = race ? RARITIES[race.rarity] : null;
  return `<section class="lineage-section" aria-label="เผ่าตัวละคร"><div class="section-title"><span class="eyebrow">THE BLOODLINE WITHIN</span><h3>สายเลือดแห่งโชคชะตา</h3></div><div class="race-reveal ${race ? "revealed" : ""}" style="--rarity:${tier?.color ?? "#93bab9"}"><div class="race-sigil">${race?.sigil ?? "?"}</div><div class="race-copy"><span class="rarity-label">${tier ? `${tier.english} · ${tier.name}` : "UNKNOWN LINEAGE"}</span><h4>${race?.name ?? "สายเลือดของคุณยังไม่ถูกค้นพบ"}</h4><span class="race-english">${race?.english ?? "15 races. One destiny."}</span><p>${race?.lore ?? "สุ่มเผ่าเพื่อค้นพบพรสวรรค์ที่ติดตัวคุณ"}</p><strong>${race?.trait ?? "เผ่าทุกเผ่ามีโบนัสต่อค่าสถานะจริง"}</strong></div></div><div class="race-roll-row"><button class="button secondary" id="roll-race" type="button" ${save.raceRolls === 0 && save.gold < RACE_REROLL_COST ? "disabled" : ""}>${icon("spark")} ${race ? "สุ่มเผ่าใหม่" : "สุ่มเผ่าของฉัน"} · ${save.raceRolls > 0 ? `ฟรี ${save.raceRolls} ครั้ง` : `${RACE_REROLL_COST} G`}</button><p>ผลใหม่แทนเผ่าเดิมทันที · ไม่เปลี่ยนเลเวลหรือแต้ม<br/>หลังใช้สิทธิ์ฟรี สุ่มครั้งละ ${RACE_REROLL_COST} G จากทองในเกม</p></div><details class="race-odds"><summary>ดูเผ่าทั้ง 15 และโอกาสสุ่ม <span>100% TOTAL</span></summary><div class="race-catalog">${RACES.map((r) => `<div class="race-entry" style="--rarity:${RARITIES[r.rarity].color}"><span>${r.sigil}</span><div><b>${r.name}</b><small>${RARITIES[r.rarity].name} · ${r.trait.split(" · ")[1]}</small></div><em>${r.weight}%</em></div>`).join("")}</div></details></section>`;
}
export function creationPanel(
  save: TacticsSave,
  name: string,
  portraits: Record<string, string>,
) {
  const current = save.builds[0].classId;
  return `<div class="creation-header"><span class="eyebrow">A NEW SOUL. AN UNWRITTEN LEGACY.</span><h2>ตำนานเริ่มที่ตัวคุณ<span>.</span></h2><p>สร้างตัวละครคนเดียว เลือกเส้นทาง และค้นพบสายเลือดของคุณ</p></div><form id="character-create-form" class="creation-form"><label class="create-name-label" for="create-name">01 <span>ชื่อตัวละครของคุณ</span></label><input id="create-name" name="name" maxlength="20" autocomplete="off" placeholder="ชื่อที่จะถูกจารึกในตำนาน…" value="${esc(name)}" required/><div class="create-name-label">02 <span>เลือกอาชีพหลัก</span></div><div class="creation-classes" role="group" aria-label="เลือกอาชีพหลัก">${CLASS_IDS.map(
    (id) => {
      const c = CLASSES[id];
      return `<button type="button" class="creation-class ${current === id ? "selected" : ""}" data-create-class="${id}" aria-pressed="${current === id}" style="--class-color:${c.color}"><img src="${portraits[id]}" alt=""/><span><b>${c.thai}</b><small>${c.name}</small></span><i>${current === id ? "✓" : "◇"}</i></button>`;
    },
  ).join(
    "",
  )}</div><div class="class-introduction"><b>${CLASSES[current].skill}</b><p>${CLASSES[current].description} · ${CLASSES[current].skillHint}</p></div><div class="create-name-label">03 <span>สุ่มเผ่าและรับพรสวรรค์</span></div>${racePanel(save)}<div class="creation-footer"><p>ชื่อและอาชีพเปลี่ยนได้ภายหลัง<br/>ความคืบหน้าเซฟในเบราว์เซอร์นี้</p><button class="button primary" id="begin-journey" type="submit" ${!save.builds[0].raceId ? "disabled" : ""}>เริ่มการผจญภัย ${icon("arrow")}</button></div></form>`;
}
export function subclassPanel(save: TacticsSave) {
  const b = save.builds[0],
    unlocked = save.level >= SUBCLASS_LEVEL,
    bonus = subclassBonus(b.subClassId);
  return `<section class="subclass-section"><div class="section-title"><span class="eyebrow">A SECOND DISCIPLINE</span><h3>อาชีพเสริม <span>${unlocked ? "ปลดล็อกแล้ว" : `ปลดล็อก LV ${SUBCLASS_LEVEL}`}</span></h3><p>เพิ่มโบนัสค่าสถานะและใช้ทักษะอาชีพเสริมได้ที่พลัง 80% เปลี่ยนได้ฟรี</p></div><div class="subclass-options" role="group" aria-label="เลือกอาชีพเสริม"><button data-subclass="none" class="${!b.subClassId ? "selected" : ""}" ${!unlocked ? "disabled" : ""}>ไม่เลือก</button>${CLASS_IDS.filter(
    (id) => id !== b.classId,
  )
    .map(
      (id) =>
        `<button data-subclass="${id}" class="${b.subClassId === id ? "selected" : ""}" ${!unlocked ? "disabled" : ""}>${CLASSES[id].thai}</button>`,
    )
    .join(
      "",
    )}</div><div class="subclass-detail">${b.subClassId ? `${icon("spark")} <b>${CLASSES[b.subClassId].skill}</b><span>${CLASSES[b.subClassId].cost} MP · HP +${bonus.hp}, MP +${bonus.mp}, ATK +${bonus.attack}, MAG +${bonus.magic}, DEF +${bonus.defense}, SPD +${bonus.speed}</span>` : `${icon("book")} <span>${unlocked ? "เลือกศาสตร์อีกแขนงเพื่อสร้างบิลด์ผสมของคุณ" : "ต่อสู้เก็บ XP จนถึงเลเวล 2 เพื่อผสมสองอาชีพ"}</span>`}</div></section>`;
}
export function abilityPanel(save: TacticsSave) {
  const b = save.builds[0],
    c = CLASSES[b.classId];
  return `<section class="ability-section"><div><span class="eyebrow">ABILITY MASTERY</span><h3>${c.skill} <small>RANK ${b.skillRank + 1} / ${MAX_SKILL_RANK + 1}</small></h3><p>${c.skillHint} · พลังทักษะ +${b.skillRank * 12}%</p><span class="ability-pips">${Array.from({ length: MAX_SKILL_RANK + 1 }, (_, i) => `<i class="${i <= b.skillRank ? "lit" : ""}"></i>`).join("")}</span></div><div><b id="ability-points">${skillPointsLeft(save)} AP</b><button class="button secondary" id="upgrade-skill" ${skillPointsLeft(save) <= 0 ? "disabled" : ""}>เพิ่มพลังทักษะ +12%</button><small>เริ่ม 1 AP · ได้อีก 1 ทุก 2 เลเวล</small></div></section>`;
}
