import * as pdfToImg from "pdf-to-img";
import Tesseract from "tesseract.js";
import sharp from "sharp";
import fs from "fs";
import path from "path";

async function run() {
  try {
    const uploadsDir = "uploads";
    const files = fs.readdirSync(uploadsDir);
    const targetFile = files.find(f => f.startsWith("1782840957933-"));
    
    if (!targetFile) {
      console.error("Target file not found");
      return;
    }
    
    const pdfPath = path.join(uploadsDir, targetFile);
    console.log("Loading PDF from path:", pdfPath);
    
    const documentPages = await pdfToImg.pdf(pdfPath, { scale: 2.5 });
    
    // Get first page
    let pageBuffer = null;
    for await (const p of documentPages) {
      pageBuffer = p;
      break; 
    }
    
    if (!pageBuffer) {
      console.error("No pages found");
      return;
    }
    
    console.log("Preparing optimized images...");
    
    // Method A: Current threshold(160) + PSM 6
    const imgA = await sharp(pageBuffer)
      .resize({ width: 2500 })
      .threshold(160)
      .toBuffer();
      
    // Method B: Grayscale + Normalize + PSM 3 (Auto)
    const imgB = await sharp(pageBuffer)
      .resize({ width: 2500 })
      .grayscale()
      .normalize()
      .toBuffer();

    // Method C: Grayscale + Normalize + PSM 6
    const imgC = await sharp(pageBuffer)
      .resize({ width: 2500 })
      .grayscale()
      .normalize()
      .toBuffer();

    console.log("Running OCR Method A (Current: threshold 160 + PSM 6)...");
    const resA = await Tesseract.recognize(imgA, "eng+urd", {
      tessedit_pageseg_mode: "6"
    });
    
    console.log("Running OCR Method B (Proposed: grayscale + normalize + PSM 3)...");
    const resB = await Tesseract.recognize(imgB, "eng+urd", {
      tessedit_pageseg_mode: "3"
    });

    console.log("Running OCR Method C (Proposed: grayscale + normalize + PSM 6)...");
    const resC = await Tesseract.recognize(imgC, "eng+urd", {
      tessedit_pageseg_mode: "6"
    });

    const output = `--- METHOD A (Current: threshold 160 + PSM 6) ---
${resA.data.text.substring(0, 1500)}

--- METHOD B (Proposed: grayscale + normalize + PSM 3) ---
${resB.data.text.substring(0, 1500)}

--- METHOD C (Proposed: grayscale + normalize + PSM 6) ---
${resC.data.text.substring(0, 1500)}
`;

    fs.writeFileSync("ocr-results.txt", output, "utf-8");
    console.log("OCR results written to ocr-results.txt");

  } catch (err) {
    console.error("Error:", err);
  }
}

run();
