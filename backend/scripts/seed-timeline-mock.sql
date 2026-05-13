-- Seed de mocks para Timeline de deudor con documento 25501071
-- Crea: 1 Deudor + 3 contactos (WA legacy, Email, WAPI) + reportes + eventos
-- Idempotente: borra los mocks previos identificados por marker antes de insertar.

START TRANSACTION;

-- 1) Limpiar mocks previos por marker (campaña 'MOCK_TIMELINE_*')
DELETE r FROM `Reporte` r INNER JOIN `Campaña` c ON c.id = r.`campañaId` WHERE c.nombre LIKE 'MOCK_TIMELINE_%';
DELETE co FROM `Contacto` co INNER JOIN `Campaña` c ON c.id = co.`campañaId` WHERE c.nombre LIKE 'MOCK_TIMELINE_%';
DELETE FROM `Campaña` WHERE nombre LIKE 'MOCK_TIMELINE_%';

DELETE ev FROM `EmailEvento` ev INNER JOIN `ReporteEmail` re ON re.id = ev.`reporteId` INNER JOIN `CampañaEmail` ce ON ce.id = re.`campañaId` WHERE ce.nombre LIKE 'MOCK_TIMELINE_%';
DELETE re FROM `ReporteEmail` re INNER JOIN `CampañaEmail` ce ON ce.id = re.`campañaId` WHERE ce.nombre LIKE 'MOCK_TIMELINE_%';
DELETE co FROM `ContactoEmail` co INNER JOIN `CampañaEmail` ce ON ce.id = co.`campañaId` WHERE ce.nombre LIKE 'MOCK_TIMELINE_%';
DELETE FROM `CampañaEmail` WHERE nombre LIKE 'MOCK_TIMELINE_%';

DELETE wr FROM `WaApiReporte` wr INNER JOIN `WaApiCampaña` wc ON wc.id = wr.`campañaId` WHERE wc.nombre LIKE 'MOCK_TIMELINE_%';
DELETE wco FROM `WaApiContacto` wco INNER JOIN `WaApiCampaña` wc ON wc.id = wco.`campañaId` WHERE wc.nombre LIKE 'MOCK_TIMELINE_%';
DELETE FROM `WaApiCampaña` WHERE nombre LIKE 'MOCK_TIMELINE_%';

DELETE FROM `Deudor` WHERE documento = '25501071';

-- 2) Crear Deudor
INSERT INTO `Deudor` (nombre, documento, empresa, nroEmpresa, remesa, creadoEn, actualizadoEn)
VALUES ('Ramiro Pablo Fernandez (mock)', '25501071', 'PEUGEOT', '001', 'REM-MOCK-001', NOW(3), NOW(3));
SET @deudorId = LAST_INSERT_ID();

-- 3) WhatsApp legacy: campaña + contacto + reporte
INSERT INTO `Campaña` (nombre, createdAt, enviadoAt, estado, pausada, templateId, archivada)
VALUES ('MOCK_TIMELINE_WA', NOW(3) - INTERVAL 5 DAY, NOW(3) - INTERVAL 5 DAY, 'finalizada', 0, 1, 0);
SET @waCampId = LAST_INSERT_ID();

INSERT INTO `Contacto` (numero, mensaje, `campañaId`, deudorId)
VALUES ('5491150001234', 'Recordatorio cuota vencida', @waCampId, @deudorId);

INSERT INTO `Reporte` (numero, mensaje, estado, enviadoAt, `campañaId`)
VALUES ('5491150001234', 'Recordatorio cuota vencida', 'enviado', NOW(3) - INTERVAL 5 DAY, @waCampId);

-- Un segundo reporte WA, mismo número, fallido
INSERT INTO `Reporte` (numero, mensaje, estado, enviadoAt, `campañaId`)
VALUES ('5491150001234', 'Segundo intento', 'fallido', NOW(3) - INTERVAL 3 DAY, @waCampId);

-- 4) Email: campaña + contacto + reportes + eventos
INSERT INTO `CampañaEmail` (nombre, createdAt, enviadoAt, estado, pausada, templateId, archivada, userId)
VALUES ('MOCK_TIMELINE_EMAIL', NOW(3) - INTERVAL 4 DAY, NOW(3) - INTERVAL 4 DAY, 'finalizada', 0, 3, 0, 3);
SET @emCampId = LAST_INSERT_ID();

INSERT INTO `ContactoEmail` (email, nombre, `campañaId`, deudorId)
VALUES ('mock+ramiro@example.com', 'Ramiro mock', @emCampId, @deudorId);
SET @emContId = LAST_INSERT_ID();

INSERT INTO `ReporteEmail` (`campañaId`, contactoId, estado, enviadoAt, asunto, creadoAt, trackingTok, smtpMessageId)
VALUES (@emCampId, @emContId, 'enviado', NOW(3) - INTERVAL 4 DAY, 'Recordatorio de pago - mock', NOW(3) - INTERVAL 4 DAY, CONCAT('mock-tok-', UUID_SHORT()), CONCAT('mock-msgid-', UUID_SHORT()));
SET @emRepId = LAST_INSERT_ID();

-- Evento OPEN
INSERT INTO `EmailEvento` (reporteId, tipo, fecha, deviceFamily, osName, browserName)
VALUES (@emRepId, 'OPEN', NOW(3) - INTERVAL 4 DAY + INTERVAL 2 HOUR, 'Desktop', 'Windows', 'Chrome');

-- Evento CLICK
INSERT INTO `EmailEvento` (reporteId, tipo, urlDestino, dominioDestino, fecha, deviceFamily, osName, browserName)
VALUES (@emRepId, 'CLICK', 'https://amsa.example.com/pagar/abc123', 'amsa.example.com', NOW(3) - INTERVAL 4 DAY + INTERVAL 3 HOUR, 'Desktop', 'Windows', 'Chrome');

-- Un segundo email, fallido (rebote)
INSERT INTO `ReporteEmail` (`campañaId`, contactoId, estado, enviadoAt, asunto, error, creadoAt, trackingTok, smtpMessageId)
VALUES (@emCampId, @emContId, 'fallido', NOW(3) - INTERVAL 2 DAY, 'Segundo recordatorio - mock', 'Bounce 5.1.1 user unknown', NOW(3) - INTERVAL 2 DAY, CONCAT('mock-tok-', UUID_SHORT()), CONCAT('mock-msgid-', UUID_SHORT()));

-- 5) WAPI Meta: campaña + contacto + reporte
INSERT INTO `WaApiCampaña` (nombre, templateId, estado, pausada, archivada, createdAt, enviadoAt, userId)
VALUES ('MOCK_TIMELINE_WAPI', 5, 'finalizada', 0, 0, NOW(3) - INTERVAL 1 DAY, NOW(3) - INTERVAL 1 DAY, 3);
SET @wapiCampId = LAST_INSERT_ID();

INSERT INTO `WaApiContacto` (numero, nombre, `campañaId`, deudorId)
VALUES ('5491150001234', 'Ramiro mock WAPI', @wapiCampId, @deudorId);
SET @wapiContId = LAST_INSERT_ID();

INSERT INTO `WaApiReporte` (`campañaId`, contactoId, numero, waMessageId, estado, enviadoAt, entregadoAt, leidoAt, creadoAt)
VALUES (@wapiCampId, @wapiContId, '5491150001234', CONCAT('wamid.mock-', UUID_SHORT()), 'read', NOW(3) - INTERVAL 1 DAY, NOW(3) - INTERVAL 1 DAY + INTERVAL 5 MINUTE, NOW(3) - INTERVAL 1 DAY + INTERVAL 10 MINUTE, NOW(3) - INTERVAL 1 DAY);

COMMIT;

-- Resumen
SELECT @deudorId AS deudorIdSender;
SELECT 'Reporte WA' AS tipo, COUNT(*) n FROM `Reporte` r INNER JOIN `Campaña` c ON c.id = r.`campañaId` WHERE c.nombre = 'MOCK_TIMELINE_WA'
UNION ALL
SELECT 'ReporteEmail', COUNT(*) FROM `ReporteEmail` re INNER JOIN `CampañaEmail` ce ON ce.id = re.`campañaId` WHERE ce.nombre = 'MOCK_TIMELINE_EMAIL'
UNION ALL
SELECT 'EmailEvento', COUNT(*) FROM `EmailEvento` ev INNER JOIN `ReporteEmail` re ON re.id = ev.`reporteId` INNER JOIN `CampañaEmail` ce ON ce.id = re.`campañaId` WHERE ce.nombre = 'MOCK_TIMELINE_EMAIL'
UNION ALL
SELECT 'WaApiReporte', COUNT(*) FROM `WaApiReporte` wr INNER JOIN `WaApiCampaña` wc ON wc.id = wr.`campañaId` WHERE wc.nombre = 'MOCK_TIMELINE_WAPI';
