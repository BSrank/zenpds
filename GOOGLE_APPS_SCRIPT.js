// ============================================
// ВАЖНО: ПРОМЕНИ ТОЗИ ИМЕЙЛ С ТВОЯ ЛИЧЕН!
// ============================================
const NOTIFICATION_EMAIL = 'tvoj_lichen_email@gmail.com';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Добави ред в таблицата
    sheet.appendRow([
      data.date,
      data.time,
      data.name,
      data.phone,
      data.email || '',  // Опционално поле
      data.city,
      data.courier,
      data.office,
      data.products,
      data.totalEur,
      data.totalBgn
    ]);
    
    // Изпрати имейл нотификация до ТЕДЕ
    sendOwnerNotification(data);
    
    // Изпрати имейл потвърждение до КЛИЕНТА (ако има имейл)
    if (data.email && data.email.trim() !== '') {
      sendCustomerConfirmation(data);
    }
    
    return ContentService.createTextOutput(JSON.stringify({success: true}));
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: error.toString()}));
  }
}

// Изпраща нотификация до ТЕДЕ (собственика)
function sendOwnerNotification(data) {
  const subject = `🎧 Нова поръчка от ${data.name} - ZenAirpods`;
  
  const body = `
═══════════════════════════════════════
🎧 НОВА ПОРЪЧКА ОТ ZENAIRPODS.STORE
═══════════════════════════════════════

📦 ПОРЪЧАНИ ПРОДУКТИ:
${data.products}

💰 ОБЩА СУМА:
• EUR: ${data.totalEur}
• BGN: ${data.totalBgn}

─────────────────────────────────────

👤 ДАННИ НА КЛИЕНТА:

Име: ${data.name}
Телефон: ${data.phone}
${data.email ? 'Имейл: ' + data.email : 'Имейл: Не е оставен'}
Град: ${data.city}

📍 ДОСТАВКА:

Куриер: ${data.courier}
Офис: ${data.office}

─────────────────────────────────────

⏰ Дата на поръчка: ${data.date}, ${data.time}

─────────────────────────────────────

СЛЕДВАЩИ СТЪПКИ:
1. Обадете се на клиента за потвърждение
2. Подгответе продуктите за изпращане
3. Информирайте клиента за опцията преглед и тест
4. Изпратете с избрания куриер (наложен платеж)

═══════════════════════════════════════
Изпратено автоматично от zenairpods.store
═══════════════════════════════════════
  `;
  
  MailApp.sendEmail({
    to: NOTIFICATION_EMAIL,
    subject: subject,
    body: body,
    name: 'ZenAirpods'
  });
}

// Изпраща потвърждение до КЛИЕНТА
function sendCustomerConfirmation(data) {
  const subject = `✅ Вашата поръчка от ZenAirpods е получена!`;
  
  const body = `
Здравейте ${data.name.split(' ')[0]},

Благодарим за вашата поръчка! 

═══════════════════════════════════════

📦 ПОРЪЧАНИ ПРОДУКТИ:
${data.products}

💰 ПРОДУКТИ: ${data.totalEur} (${data.totalBgn})
📦 ДОСТАВКА: Наложен платеж (при получаване)

─────────────────────────────────────

💳 ОБЩА СУМА:
• Продукти: ${data.totalEur} (${data.totalBgn})
• Куриер: Заплащане при доставка (варира според куриера)

📌 Забележка: Крайната сума НЕ включва куриерската услуга, която се заплаща на куриера при получаване.

─────────────────────────────────────

📍 АДРЕС ЗА ДОСТАВКА:
Куриер: ${data.courier}
Офис: ${data.office}
Град: ${data.city}
Телефон: ${data.phone}

─────────────────────────────────────

✅ ОПЦИЯ ПРЕГЛЕД И ТЕСТ:

Имате възможност да прегледате и тествате продукта преди заплащане! 
При доставка можете да поискате от куриера да отворите пратката и 
да проверите дали всичко е наред.

─────────────────────────────────────

⏰ СЛЕДВАЩИ СТЪПКИ:

Ще се свържем с вас в рамките на 24 часа за потвърждение на поръчката.

─────────────────────────────────────

📞 Въпроси? Обадете се на 0876 127 997
🌐 zenairpods.store

С уважение,
Екипът на ZenAirpods

═══════════════════════════════════════
ZenAirpods - Вашият надежден партньор
═══════════════════════════════════════
  `;
  
  MailApp.sendEmail({
    to: data.email,
    subject: subject,
    body: body,
    name: 'ZenAirpods'
  });
}
