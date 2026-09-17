/**
 * Importa el Excel de conciliación semanal de Rappi (hojas "Consolidado Semanal"
 * y "Resumen Cuadratura") a Supabase, desde la línea de comandos.
 *
 * Uso:
 *   npx tsx scripts/import-rappi.ts "ruta/al/SEM36_20260831_20260906_RAPPI....xlsx"
 */
import "dotenv/config";
import ExcelJS from "exceljs";
import path from "node:path";
import { importRappiWorkbook } from "../src/lib/rappi-import";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Uso: npx tsx scripts/import-rappi.ts <ruta-al-excel>");
    process.exit(1);
  }

  const fileName = path.basename(filePath);
  console.log(`Leyendo ${fileName}...`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const result = await importRappiWorkbook(workbook, fileName);

  console.log(`Período: ${result.periodStart} → ${result.periodEnd}`);
  console.log(`Pedidos importados: ${result.ordersImported}`);
  console.log(`Filas de resumen ejecutivo: ${result.summaryRowsImported}`);
  if (result.warnings.length > 0) {
    console.log("Avisos:");
    result.warnings.forEach((w) => console.log(`  - ${w}`));
  }
  console.log("Importación completa.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
