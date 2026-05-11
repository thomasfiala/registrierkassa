const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.json');
const configTplPath = path.join(__dirname, 'config.template.json');

[configPath, configTplPath].forEach(p => {
    if (fs.existsSync(p)) {
        let d = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (!d.invoiceTexts.customMessageDefault) {
            d.invoiceTexts.customMessageDefault = "Vielen Dank für Ihren Einkauf!";
        }
        fs.writeFileSync(p, JSON.stringify(d, null, 2));
    }
});

