# Orchardia Online V3.0.3 — Utility Rail Always Visible

แก้ปัญหา:
- แถบกระเป๋า / ร้านค้า / เควสต์ / ล็อกเป้า โผล่มาเป็นบางช่วง
- ตอน AUTO หรือ Combat แถบด้านขวาจาง/หาย
- ตอนซ่อนปุ่มต่อสู้ Utility Rail หายไปด้วย

## แก้แล้ว
- กระเป๋า / ร้านค้า / เควสต์ / ล็อกเป้า แสดงตลอดเวลา
- Quest Tracker แสดงตลอดเวลา
- Mini-map แสดงตลอดเวลา
- ไม่ถูกซ่อนหรือทำจางเมื่อเข้า Combat/AUTO
- โหมด “ซ่อนปุ่ม” จะซ่อนเฉพาะ Combat Cluster + Joystick เท่านั้น
- เพิ่ม cleanup สำหรับ Safari bfcache / class ค้าง
- cache bust เป็น v303

คงระบบเดิม:
AUTO / Auto Skill / Auto Loot / Auto Respawn / Hide HUD / Open World / World Map
