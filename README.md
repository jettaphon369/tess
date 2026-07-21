# Orchardia Online V2.0.1 — Startup Hotfix

แก้ปัญหา V2.0 เปิดเกมแล้วฉากไม่ขึ้นและขึ้น Error:

`null is not an object (evaluating document.getElementById("exitBtn").onclick...)`

## แก้แล้ว
- เพิ่ม/ยืนยันปุ่ม `exitBtn` ใน HTML
- เปลี่ยนการผูก event ของปุ่มเสริมให้เป็นแบบ null-safe
- ป้องกัน UI บางปุ่มที่ไม่มีในบาง layout ทำให้ JavaScript หยุดทั้งเกม
- คง Responsive HUD สำหรับ iPhone / Android / Tablet / PC
- คง Smart Auto, Auto Skill, Combat, Inventory, Shop, Quest, Save
- เพิ่ม cache version `v=201` เพื่อให้ Safari โหลดไฟล์ใหม่

## วิธีอัป
อัปทั้ง 4 ไฟล์แทน V2.0:
- index.html
- style.css
- game.js
- README.md

หลัง Commit ให้ปิดแท็บเกมเดิม แล้วเปิด GitHub Pages ใหม่
