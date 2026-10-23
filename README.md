# Pixel Rebirth · Solo HD·2D RPG

เกม RPG **เทิร์นเบสที่ปั้นตัวละครของตัวเองเพียงคนเดียว** เล่นผ่านเบราว์เซอร์บนโทรศัพท์และคอมพิวเตอร์ สร้างด้วย **Phaser 3 + TypeScript + Vite** ได้แรงบันดาลใจจากการเติบโตของตัวละครใน Pixel Lineage และบรรยากาศเกม JRPG แบบ HD-2D ใช้โลก ตัวละคร ฉาก และกติกาของโปรเจกต์เอง

เกมออนไลน์: https://tangkok.github.io/pixel-rebirth-rpg/ (เวอร์ชันใหม่จะพร้อมหลัง workflow Publish browser game สำเร็จ)

## การเล่นบนโทรศัพท์

เปิดลิงก์เกมด้วย Chrome หรือ Safari ไม่ต้องติดตั้ง Node.js หรือแอป รองรับแนวตั้งและแนวนอน ใช้ปุ่มคำสั่งบนจอได้โดยตรง

- **โจมตี**: โจมตีศัตรูเป้าหมายหนึ่งตัว
- **ทักษะ**: เลือกทักษะอาชีพ หรือ Starlight Mend เพื่อฟื้นฟูตัวคุณเอง
- **ป้องกัน**: ลดความเสียหาย 55% จนถึงเทิร์นของตัวเองครั้งถัดไป พร้อมคืน 8 MP และเพิ่ม BP
- **ไอเทม**: ใช้ยา ฟื้น 90 HP ให้ตัวคุณเอง ยาจะไม่ถูกใช้ถ้า HP เต็ม
- **BOOST**: ใช้ 2 BP เพิ่มพลังโจมตีหรือเวทฟื้นฟูครั้งถัดไป 65% BP สูงสุด 3 ทุกคำสั่งเพิ่ม 1 BP และ Guard เพิ่มอีก 1
- แตะศัตรูในฉาก หรือใช้ลูกศร **TARGET** เพื่อเปลี่ยนเป้าหมาย
- ปุ่ม **AUTO** ให้ตัวละครโจมตีปกติอัตโนมัติ ปุ่ม **1× / 2×** ปรับความเร็วการแสดงผล
- ลำดับเทิร์นขึ้นอยู่กับ SPD เกมจะรอผู้เล่นเลือกคำสั่งโดยไม่มีเวลาจำกัด ศัตรูลงมือเฉพาะเทิร์นของตัวเอง

บนคอมพิวเตอร์ใช้ `1` โจมตี, `2` เปิดทักษะ, `3` ป้องกัน, `4` ใช้ยา, `B` บูสต์ และลูกศรซ้าย/ขวาเลือกเป้าหมายได้

## ตัวละครของฉัน

มีตัวละครของคุณเพียงคนเดียว ตั้งชื่อได้ในเมนู **ตัวละครของฉัน** เปลี่ยนอาชีพและจัดแต้มให้ตัวละครเดิมได้โดยไม่เพิ่มสมาชิกปาร์ตี้ หรือแตะการ์ดตัวละครขณะต่อสู้:

| อาชีพ       | ทักษะเด่น             | แนวทาง                       |
| ----------- | --------------------- | ---------------------------- |
| Dawn Warden | Sunbreak · 12 MP      | นักดาบแนวหน้า ทลายเกราะศัตรู |
| Starweaver  | Astral Rain · 18 MP   | เวทดวงดาวพลังสูง             |
| Veil Ranger | Piercing Gale · 12 MP | ความเร็วสูง ลูกศรทะลุเกราะ   |

ทุกอาชีพใช้ Starlight Mend ได้ในราคา 16 MP ตัวละครเริ่มด้วยแต้ม 3 แต้ม เมื่อเลเวลเพิ่มได้รับอีก 2 แต้ม คืนแต้มได้ฟรี:

| แต้ม     | ผลต่อสถิติ     |
| -------- | -------------- |
| Might    | ATK +4         |
| Vitality | HP +18, DEF +2 |
| Spirit   | MAG +4, MP +6  |
| Haste    | SPD +3         |

อัปเกรดอาวุธประจำตัวราคา 100 G เพิ่ม ATK +12 และ MAG +10 การเปลี่ยนอาชีพไม่ลบอัปเกรดที่ซื้อแล้ว กด **นำบิลด์ลงสนาม** เพื่อเริ่มการต่อสู้ใหม่และใช้บิลด์ที่ปรับไว้

## การเดินทาง

เวอร์ชันนี้เน้นการเลือกด่านและต่อสู้เป็นเทิร์น แทนระบบเดินฟันแบบเวอร์ชันแรก

1. **The Hollow Sanctuary** — ดวลกับผู้พิทักษ์วิหาร
2. **The Sunken Archive** — เผชิญ Archive Wraith ที่รวดเร็วขึ้น
3. **Throne of the Eclipse** — ดวลกับ Eclipse Sovereign

ชนะเพื่อรับทองและ XP พร้อมปลดล็อกด่านถัดไป เล่นซ้ำเพื่อเก็บทรัพยากรได้ เมื่อแพ้สามารถลองใหม่หรือปรับบิลด์ก่อนได้ ทุกการเริ่มด่านเติม HP/MP เต็ม ซื้อยาเพิ่มได้ใน Settings ราคา 25 G

## ภาพและเทคนิค 2.5D

ฉากเป็นภาพ HD ต้นฉบับที่สร้างสำหรับโปรเจกต์ ใช้มุมมอง perspective แบบฉาก 3D ที่เรนเดอร์ไว้ล่วงหน้า แล้วประกอบกับ sprite ตัวละคร แสงผลึก เงา หมอกเคลื่อนไหว อนุภาค และเอฟเฟกต์การโจมตีใน Phaser เป็น **2.5D แบบจัดองค์ประกอบหลายชั้น** ไม่ใช่โลก 3D ที่หมุนกล้องได้อิสระ

ภาพวิหารและ sprite sheet ฮีโร่เป็นภาพต้นฉบับที่สร้างด้วย image generation สำหรับโปรเจกต์นี้ ไม่มีภาพอ้างอิงของผู้ใช้หรือตัวละครจากเกมอื่นอยู่ในไฟล์เผยแพร่ ศัตรูใช้ sprite sheet HD ต้นฉบับชุดใหม่ ส่วน fallback sprites วาดด้วย Canvas บน pixel grid ภาพถูกบีบอัดเป็น WebP พร้อม alpha และโหลดจากโฮสต์เดียวกับเกม Font รวมอยู่ใน build ไม่ใช้ API ระหว่างเล่น

## ความคมชัดบนมือถือ

เก็บภาพตัวละครที่ 384×576 พิกเซลแทน 96×144 แบบเดิม ภาพศัตรูใช้ frame ความละเอียดสูงจาก sprite sheet และใช้ linear filtering สำหรับงานภาพ HD ไม่ขยายภาพด้วย nearest-neighbor อีกต่อไป

Canvas เรนเดอร์ตาม `devicePixelRatio` ของจอ สูงสุด 3 เท่า เช่นพื้นที่เล่นกว้าง 390 CSS pixels บนจอ DPR 3 ใช้ backing buffer กว้าง 1170 pixels ตัวหนังสือในฉากใช้ความละเอียดเดียวกัน จำกัด GPU buffer ประมาณ 4 ล้านพิกเซลบนจอใหญ่ และปรับ canvas, กล้อง และพิกัดสัมผัสพร้อมกันเมื่อหมุนโทรศัพท์ ไม่ใช้การเพิ่มขนาด CSS เพื่อขยายภาพเล็ก

## เซฟ

เซฟอัตโนมัติใน `localStorage` key `pixel-rebirth-solo-v3`: เลเวล, XP, เงิน, ยา, ด่านที่ปลดล็อก, ด่านที่ผ่าน, ชื่อ, อาชีพ, แต้มบิลด์, อัปเกรดอาวุธ และการตั้งค่าเสียง

รีเฟรชแล้วจะเริ่ม encounter ใหม่ด้วย HP/MP เต็ม โดยรักษาความคืบหน้าและจำนวนยาที่ใช้ไป เซฟปาร์ตี้เวอร์ชันก่อนใน key `pixel-rebirth-tactics-v2` จะถูกอ่านเพื่อย้ายเลเวล XP เงิน ยา ด่าน และอัปเกรดอาวุธมาสู่ตัวละครคนเดียว โดยไม่ลบเซฟปาร์ตี้เดิม เซฟเวอร์ชันแอ็กชันเดิมใน key `pixel-rebirth-save-v1` ยังคงอยู่ และนำทองเดิมมารวมเป็นโบนัสเมื่อเริ่มเวอร์ชันใหม่ครั้งแรก หาก browser storage ใช้ไม่ได้ จะแสดง `SESSION ONLY` และยังเล่นได้ ล้างเซฟเวอร์ชันใหม่นี้ได้ที่ Settings โดยต้องยืนยันอีกครั้ง

เป็นเกมเล่นคนเดียว ไม่มีบัญชีหรือ multiplayer เป็นเวอร์ชันเริ่มต้นที่มี 3 encounter, ฉากหลักหนึ่งฉากพร้อมโทนสีตามด่าน และภาพตัวละครตามอาชีพ การทดสอบมือถือเป็น Chromium emulation ยังไม่ใช่การทดสอบบนอุปกรณ์จริงหรือ Safari จริง

## พัฒนาและทดสอบ

ต้องมี Node.js 22.12+ หรือ 24+ และ npm

```sh
npm ci
npm run dev
npm run build
npm test
npm run test:e2e
npm run preview
```

Playwright ใช้ `/usr/bin/chromium` ถ้ามี หรือ managed Chromium ของ Playwright ติดตั้ง browser ด้วย `npx playwright install chromium` ได้เมื่อจำเป็น หรือกำหนด `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`

```text
src/
  main.ts             UI, controller, touch/keyboard commands, audio, saves
  style.css           Responsive dark fantasy interface
  game/
    tactics.ts        Pure rules: builds, turns, skills, rewards, saves
    BattleScene.ts    Phaser scene, depth layers, hit effects, animations
    battleArt.ts      High-resolution sprite frames, portraits, fallback art
    display.ts        Device-pixel-ratio sizing with a bounded GPU buffer
public/art/           Original compressed environment, hero and enemy sprite sheets
tests/tactics.test.ts Combat/build/save unit tests
tests/browser/        Functional desktop and mobile browser tests
```

`window.__pixelRebirth` มีเฉพาะโหมด Vite development สำหรับทดสอบและ debug ไม่เปิดใน production

## เผยแพร่

Workflow `.github/workflows/pages.yml` ตรวจ unit tests และ build ก่อน deploy ไป GitHub Pages ทุกครั้งที่ push `main` สามารถสั่งผ่าน **Actions → Publish browser game → Run workflow** ได้ โดยตั้งค่า **Settings → Pages → Source: GitHub Actions** ก่อน

Vite ใช้ Asset URL แบบ relative จึงรองรับ path `/pixel-rebirth-rpg/` บน GitHub Pages และ static hosting ทั่วไป ไม่ต้องมี backend หรือ API key
