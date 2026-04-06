#!/usr/bin/env node
/**
 * Cross-platform packaging script.
 * Creates dist/uipath-xaml-viewer.zip containing extension files.
 */
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const outFile = path.join(distDir, 'uipath-xaml-viewer.zip');

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);

const output = fs.createWriteStream(outFile);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  const kb = (archive.pointer() / 1024).toFixed(1);
  console.log(`Packaged ${outFile} (${kb} KB)`);
});

archive.on('error', (err) => { throw err; });
archive.pipe(output);

// Add extension directories and files (exclude test artifacts)
archive.file(path.join(root, 'manifest.json'), { name: 'manifest.json' });
archive.directory(path.join(root, 'icons'), 'icons');
archive.directory(path.join(root, 'lib'), 'lib');
archive.directory(path.join(root, 'src'), 'src');

archive.finalize();
