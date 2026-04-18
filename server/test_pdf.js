const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('../voters.pdf.pdf');

pdf(dataBuffer).then(function(data) {
    console.log("Number of pages:", data.numpages);
    console.log("Text snapshot of first 1000 characters:");
    console.log(data.text.substring(0, 1000));
}).catch(err => {
    console.error("Error reading PDF:", err);
});
