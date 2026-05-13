-- Backfill: linkear ContactoEmail.deudorId para emails enviados desde Gestión
-- antes del fix que pasaba deudorDocumento al internal-api.
--
-- Estrategia: por cada envio_email en Gestión se conocen los reporteIds que
-- generó en Sender (senderReporteIds JSON). Match documento Gestión ↔ Sender.

START TRANSACTION;

-- Preview de filas a actualizar
SELECT co.id AS contactoId, co.email, co.deudorId AS antes, sd.id AS nuevoDeudorId, sd.documento
FROM whatsapp_automation.`ContactoEmail` co
INNER JOIN whatsapp_automation.`ReporteEmail` re ON re.contactoId = co.id
INNER JOIN `amsa-gestion`.envio_email ee ON JSON_CONTAINS(ee.senderReporteIds, CAST(re.id AS JSON))
INNER JOIN `amsa-gestion`.deudor gd ON gd.id = ee.deudorId
INNER JOIN whatsapp_automation.`Deudor` sd ON sd.documento = gd.documento
WHERE co.deudorId IS NULL;

UPDATE whatsapp_automation.`ContactoEmail` co
INNER JOIN whatsapp_automation.`ReporteEmail` re ON re.contactoId = co.id
INNER JOIN `amsa-gestion`.envio_email ee ON JSON_CONTAINS(ee.senderReporteIds, CAST(re.id AS JSON))
INNER JOIN `amsa-gestion`.deudor gd ON gd.id = ee.deudorId
INNER JOIN whatsapp_automation.`Deudor` sd ON sd.documento = gd.documento
SET co.deudorId = sd.id
WHERE co.deudorId IS NULL;

SELECT ROW_COUNT() AS filas_actualizadas;

COMMIT;
