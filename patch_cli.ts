import fs from 'fs';
import path from 'path';

function updateConfig() {
    for (const f of ['config.json', 'config.template.json']) {
        const p = path.join(__dirname, f);
        if (fs.existsSync(p)) {
            const data = JSON.parse(fs.readFileSync(p, 'utf8'));
            if (!data.invoiceTexts.customMessageDefault) {
                data.invoiceTexts.customMessageDefault = "Vielen Dank für Ihren Einkauf!";
                fs.writeFileSync(p, JSON.stringify(data, null, 2));
            }
        }
    }
}

updateConfig();
