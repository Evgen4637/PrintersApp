import storage from '../services/storage';
import { PRINTER_MODELS } from '../constants/models';

export async function seedDatabase() {
  console.log('Начинаем наполнение базы данных...');

  // Добавляем примеры ошибок в базу знаний
  const knowledgeEntries = [
    {
      errorCode: 'SC542',
      title: 'Ошибка печки (fusing unit)',
      solution: 'Заменить термистор печки. Проверить сопротивление термистора, должно быть 100-120 кОм при комнатной температуре. Также проверить целостность предохранителя на блоке печки.',
      relatedParts: ['TERM-001', 'FUSE-001'],
      steps: [
        'Выключить принтер и отключить от сети',
        'Снять заднюю крышку',
        'Найти блок печки (fusing unit)',
        'Проверить предохранитель на плате печки',
        'Измерить сопротивление термистора',
        'При необходимости заменить термистор',
        'Собрать и протестировать',
      ],
    },
    {
      errorCode: 'J001',
      title: 'Замятие бумаги в податчике',
      solution: 'Очистить ролики подачи бумаги, проверить разделительную пластину. При износе роликов заменить их. Убедиться, что бумага правильно загружена и не превышает максимальную емкость.',
      relatedParts: ['ROLL-001', 'PLATE-002'],
      steps: [
        'Выключить принтер',
        'Открыть задний лоток',
        'Очистить ролики подачи спиртом',
        'Проверить разделительную пластину на износ',
        'Загрузить бумагу правильно, не переполняя лоток',
        'Включить и протестировать',
      ],
    },
    {
      errorCode: 'SC320',
      title: 'Ошибка сканера ( CIS error)',
      solution: 'Проверить соединение кабеля сканера, очистить стекло сканера, проверить двигатель сканера. При необходимости заменить CIS (Contact Image Sensor) или его кабель.',
      relatedParts: ['CIS-001', 'CABLE-002'],
      steps: [
        'Перезагрузить принтер',
        'Открыть крышку сканера',
        'Очистить стекло и CIS-сенсор',
        'Проверить соединение кабеля CIS',
        'Если ошибка persists, заменить CIS-модуль',
      ],
    },
    {
      errorCode: 'U4-13',
      title: 'Ошибка термофиксатора',
      solution: 'Термофиксатор (fuser) достиг конца срока службы. Необходима замена термофиксатора или сброс счетчика (только для опытных пользователей).',
      relatedParts: ['FUSER-001'],
      steps: [
        'Проверить счетчик термофиксатора в сервисном меню',
        'Если достигнут лимит, заменить термофиксатор',
        'После замены сбросить счетчик',
        'Включить принтер и дождаться прогрева',
      ],
    },
    {
      errorCode: 'J002',
      title: 'Замятие в дуплексоре',
      solution: 'Очистить ролики дуплексора, проверить направляющие бумаги. Часто помогает прочистка роликов и проверка на наличие обрывков бумаги.',
      relatedParts: ['ROLL-DUP-001'],
      steps: [
        'Выключить принтер',
        'Открыть заднюю крышку',
        'Найти модуль дуплекса',
        'Очистить все ролики',
        'Проверить направляющие на заусенцы',
        'Собрать и протестировать двустороннюю печать',
      ],
    },
    {
      errorCode: 'SC545',
      title: 'Ошибка температуры печки (low fuser temp)',
      solution: 'Проверить терморезистор (thermistor) и нагревательные лампы. Измерить сопротивление терморезистора, проверить цепь питания ламп.',
      relatedParts: ['THERM-001', 'LAMP-001'],
      steps: [
        'Дождаться, пока принтер остынет',
        'Проверить сопротивление терморезистора',
        'Проверить предохранитель на блоке питания',
        'Проверить лампы нагрева',
        'При необходимости заменить неисправные компоненты',
      ],
    },
  ];

  // Добавляем записи в базу знаний
  for (const entry of knowledgeEntries) {
    try {
      await storage.addKnowledgeEntry(entry);
      console.log(`Добавлена запись: ${entry.errorCode} - ${entry.title}`);
    } catch (error) {
      console.error(`Ошибка добавления записи ${entry.errorCode}:`, error);
    }
  }

  // Добавляем базовые запчасти в склад
  const parts = [
    {
      partNumber: 'TERM-001',
      description: 'Термистор печки для Ricoh IM C300/C2500',
      compatibleModels: [PRINTER_MODELS[0], PRINTER_MODELS[1]],
      quantity: 5,
      location: { building: 'Основной корпус', room: 'Склад запчастей', cabinet: 'A1' },
      minQuantity: 2,
    },
    {
      partNumber: 'FUSE-001',
      description: 'Предохранитель на блоке печки 5A',
      compatibleModels: [PRINTER_MODELS[0], PRINTER_MODELS[1], PRINTER_MODELS[2], PRINTER_MODELS[3]],
      quantity: 10,
      location: { building: 'Основной корпус', room: 'Склад запчастей', cabinet: 'A2' },
      minQuantity: 5,
    },
    {
      partNumber: 'ROLL-001',
      description: 'Ролик подачи бумаги ( pickup roller)',
      compatibleModels: [PRINTER_MODELS[0], PRINTER_MODELS[1], PRINTER_MODELS[2]],
      quantity: 3,
      location: { building: 'Основной корпус', room: 'Склад запчастей', cabinet: 'B1' },
      minQuantity: 2,
    },
    {
      partNumber: 'PLATE-002',
      description: 'Разделительная пластина ( separation pad)',
      compatibleModels: [PRINTER_MODELS[0], PRINTER_MODELS[1], PRINTER_MODELS[2]],
      quantity: 4,
      location: { building: 'Основной корпус', room: 'Склад запчастей', cabinet: 'B2' },
      minQuantity: 2,
    },
    {
      partNumber: 'CIS-001',
      description: 'CIS модуль сканера',
      compatibleModels: [PRINTER_MODELS[0], PRINTER_MODELS[1]],
      quantity: 2,
      location: { building: 'Основной корпус', room: 'Склад запчастей', cabinet: 'C1' },
      minQuantity: 1,
    },
    {
      partNumber: 'CABLE-002',
      description: 'Кабель CIS-сенсора',
      compatibleModels: [PRINTER_MODELS[0], PRINTER_MODELS[1]],
      quantity: 3,
      location: { building: 'Основной корпус', room: 'Склад запчастей', cabinet: 'C2' },
      minQuantity: 1,
    },
    {
      partNumber: 'FUSER-001',
      description: 'Термофиксатор (fuser unit)',
      compatibleModels: [PRINTER_MODELS[0], PRINTER_MODELS[1]],
      quantity: 1,
      location: { building: 'Основной корпус', room: 'Склад запчастей', cabinet: 'D1' },
      minQuantity: 1,
    },
    {
      partNumber: 'ROLL-DUP-001',
      description: 'Ролик дуплексора',
      compatibleModels: [PRINTER_MODELS[0], PRINTER_MODELS[1], PRINTER_MODELS[2], PRINTER_MODELS[3]],
      quantity: 4,
      location: { building: 'Основной корпус', room: 'Склад запчастей', cabinet: 'D2' },
      minQuantity: 2,
    },
    {
      partNumber: 'THERM-001',
      description: 'Терморезистор печки',
      compatibleModels: [PRINTER_MODELS[0], PRINTER_MODELS[1], PRINTER_MODELS[2]],
      quantity: 6,
      location: { building: 'Основной корпус', room: 'Склад запчастей', cabinet: 'E1' },
      minQuantity: 3,
    },
    {
      partNumber: 'LAMP-001',
      description: 'Лампа нагрева печки (halogen lamp)',
      compatibleModels: [PRINTER_MODELS[0], PRINTER_MODELS[1]],
      quantity: 2,
      location: { building: 'Основной корпус', room: 'Склад запчастей', cabinet: 'E2' },
      minQuantity: 1,
    },
  ];

  // Добавляем запчасти
  for (const part of parts) {
    try {
      await storage.addPart(part);
      console.log(`Добавлена запчасть: ${part.partNumber} - ${part.description}`);
    } catch (error) {
      console.error(`Ошибка добавления запчасти ${part.partNumber}:`, error);
    }
  }

  console.log('Наполнение базы данных завершено!');
}

export default seedDatabase;