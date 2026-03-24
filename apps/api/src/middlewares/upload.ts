import multer from "multer";

// Aceita apenas CSV e XLSX em memória (sem gravação em disco)
export const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain", // alguns CSVs chegam como text/plain
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(csv|xls|xlsx)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Formato inválido. Aceito: .csv, .xls, .xlsx"));
    }
  },
}).single("arquivo");
