const fs = require('fs');
const PDFParser = require("pdf2json");

let pdfParser = new PDFParser();

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError) );
pdfParser.on("pdfParser_dataReady", pdfData => {
    const page = pdfData.formImage.Pages[0];
    console.log("Texts on page 1:", page.Texts.slice(0, 15).map(t => ({
        x: t.x, y: t.y, text: decodeURIComponent(t.R[0].T)
    })));
});

pdfParser.loadPDF("../voters.pdf.pdf");
