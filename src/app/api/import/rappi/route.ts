import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import { importRappiWorkbook } from "@/lib/rappi-import";

export const runtime = "nodejs";
export const maxDuration = 60; // el archivo trae ~1.400 filas; dale margen a la función

export async function POST(request: NextRequest) {
  const secret = process.env.IMPORT_UPLOAD_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "El servidor no tiene configurada IMPORT_UPLOAD_SECRET." },
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const providedSecret = formData.get("secret");
  if (providedSecret !== secret) {
    return NextResponse.json({ error: "Clave incorrecta." }, { status: 401 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "El archivo debe ser un .xlsx" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    // Los tipos de exceljs declaran su propio `Buffer` (un ArrayBuffer) que
    // choca con el `Buffer` real de Node; en tiempo de ejecución sí acepta
    // un Buffer normal (internamente se lo pasa tal cual a JSZip).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);

    const result = await importRappiWorkbook(workbook, file.name);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
