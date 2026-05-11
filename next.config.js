/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  allowedDevOrigins: ['sunny'],
  serverExternalPackages: ['pdfkit', 'fontkit'],
  turbopack: {
    root: path.join(__dirname),
  },
};

module.exports = nextConfig;
